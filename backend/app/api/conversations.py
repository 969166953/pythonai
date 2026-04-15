import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..models.schemas import ConversationModel, MessageModel, KnowledgeBaseModel

router = APIRouter(
    prefix="/knowledge-bases/{kb_id}/conversations", tags=["conversations"]
)


class ConvResponse(BaseModel):
    id: str
    title: str
    created_at: str

    class Config:
        from_attributes = True


class UpdateConvRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class MessageResponse(BaseModel):
    role: str
    content: str
    sources: list[dict] | None = None


@router.get("", response_model=list[ConvResponse])
async def list_conversations(kb_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ConversationModel)
        .where(ConversationModel.kb_id == kb_id)
        .order_by(ConversationModel.created_at.desc())
    )
    convs = result.scalars().all()
    return [
        ConvResponse(
            id=c.id, title=c.title, created_at=c.created_at.isoformat()
        )
        for c in convs
    ]


@router.post("", response_model=ConvResponse)
async def create_conversation(kb_id: str, db: AsyncSession = Depends(get_db)):
    kb = await db.get(KnowledgeBaseModel, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    conv = ConversationModel(kb_id=kb_id)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return ConvResponse(
        id=conv.id, title=conv.title, created_at=conv.created_at.isoformat()
    )


@router.patch("/{conv_id}", response_model=ConvResponse)
async def update_conversation(
    kb_id: str,
    conv_id: str,
    req: UpdateConvRequest,
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(ConversationModel, conv_id)
    if not conv or conv.kb_id != kb_id:
        raise HTTPException(status_code=404, detail="对话不存在")
    conv.title = req.title
    await db.commit()
    await db.refresh(conv)
    return ConvResponse(
        id=conv.id, title=conv.title, created_at=conv.created_at.isoformat()
    )


@router.delete("/{conv_id}")
async def delete_conversation(
    kb_id: str, conv_id: str, db: AsyncSession = Depends(get_db)
):
    conv = await db.get(ConversationModel, conv_id)
    if not conv or conv.kb_id != kb_id:
        raise HTTPException(status_code=404, detail="对话不存在")
    await db.delete(conv)
    await db.commit()
    return {"success": True}


@router.get("/{conv_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    kb_id: str, conv_id: str, db: AsyncSession = Depends(get_db)
):
    conv = await db.get(ConversationModel, conv_id)
    if not conv or conv.kb_id != kb_id:
        raise HTTPException(status_code=404, detail="对话不存在")

    result = await db.execute(
        select(MessageModel)
        .where(MessageModel.conversation_id == conv_id)
        .order_by(MessageModel.created_at.asc())
    )
    msgs = result.scalars().all()
    return [
        MessageResponse(
            role=m.role,
            content=m.content,
            sources=json.loads(m.sources) if m.sources else None,
        )
        for m in msgs
    ]
