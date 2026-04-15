import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..models.schemas import MessageModel, ConversationModel
from ..services.rag import stream_chat

router = APIRouter(prefix="/chat", tags=["chat"])

MAX_MESSAGE_LENGTH = 5000


@router.get("/stream")
async def chat_stream(
    message: str = Query(..., max_length=MAX_MESSAGE_LENGTH),
    kb_id: str = Query(...),
    conversation_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(ConversationModel, conversation_id)
    if not conv or conv.kb_id != kb_id:
        raise HTTPException(status_code=404, detail="对话不存在")

    user_msg = MessageModel(
        conversation_id=conversation_id,
        role="user",
        content=message,
    )
    db.add(user_msg)
    await db.commit()

    if conv.title == "新对话":
        conv.title = message[:50]
        await db.commit()

    result = await db.execute(
        select(MessageModel)
        .where(MessageModel.conversation_id == conversation_id)
        .order_by(MessageModel.created_at.asc())
    )
    all_msgs = result.scalars().all()
    history = [
        {"role": m.role, "content": m.content}
        for m in all_msgs
        if m.id != user_msg.id
    ]

    collected_content = []
    collected_sources = None

    async def generate():
        nonlocal collected_sources
        async for chunk in stream_chat(kb_id, message, history=history):
            data_str = chunk.split("data: ", 1)[-1].strip()
            if data_str:
                try:
                    data = json.loads(data_str)
                    if data.get("type") == "token":
                        collected_content.append(data["content"])
                    elif data.get("type") == "sources":
                        collected_sources = data["sources"]
                except json.JSONDecodeError:
                    pass
            yield chunk

        assistant_msg = MessageModel(
            conversation_id=conversation_id,
            role="assistant",
            content="".join(collected_content),
            sources=json.dumps(collected_sources, ensure_ascii=False)
            if collected_sources
            else None,
        )
        db.add(assistant_msg)
        await db.commit()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
