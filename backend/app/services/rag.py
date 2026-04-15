"""
RAG 编排层 — 串联解析、向量存储和 LLM 调用。

各模块职责:
- parser.py       文档解析（扩展新格式）
- vector_store.py 向量存储（切换向量数据库）
- llm.py          LLM 客户端（切换模型提供商）
- rag.py          本文件，负责编排上述模块
"""

import json
import logging
from pathlib import Path

from ..core.config import settings
from .llm import get_llm_client
from .parser import parse_document
from . import vector_store

logger = logging.getLogger(__name__)

# 保持对外接口不变，其他模块继续 from .rag import xxx
retrieve_context = vector_store.retrieve
get_document_chunks = vector_store.get_chunks
delete_document_chunks = vector_store.delete_chunks


async def ingest_document(kb_id: str, doc_id: str, file_path: Path) -> int:
    text = parse_document(file_path)
    return await vector_store.ingest(kb_id, doc_id, file_path.name, text)


def build_prompt(
    query: str,
    contexts: list[dict],
    history: list[dict] | None = None,
) -> list[dict]:
    context_text = "\n\n---\n\n".join(
        f"[来源: {c['filename']}]\n{c['content']}" for c in contexts
    )

    messages = [
        {
            "role": "system",
            "content": (
                "你是一个知识库问答助手。根据提供的文档内容回答用户问题。\n"
                "规则：\n"
                "1. 只基于提供的文档内容回答，不要编造信息\n"
                "2. 如果文档中没有相关信息，诚实地说明\n"
                "3. 回答时引用来源文档名称\n"
                "4. 使用 Markdown 格式组织回答\n"
                "5. 保持回答简洁、准确"
            ),
        },
    ]

    if history:
        for msg in history[-10:]:
            content = msg["content"][:2000]
            messages.append({"role": msg["role"], "content": content})

    messages.append(
        {"role": "user", "content": f"参考文档：\n{context_text}\n\n用户问题：{query}"},
    )

    return messages


async def stream_chat(
    kb_id: str,
    query: str,
    history: list[dict] | None = None,
):
    contexts = await vector_store.retrieve(kb_id, query)

    sources = [
        {"filename": c["filename"], "chunk": c["content"][:100] + "..."}
        for c in contexts
    ]

    yield f"data: {json.dumps({'type': 'sources', 'sources': sources}, ensure_ascii=False)}\n\n"

    messages = build_prompt(query, contexts, history)
    client = get_llm_client()

    try:
        stream = await client.chat.completions.create(
            model=settings.deepseek_model,
            messages=messages,
            stream=True,
            temperature=0.3,
            max_tokens=2000,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield f"data: {json.dumps({'type': 'token', 'content': chunk.choices[0].delta.content}, ensure_ascii=False)}\n\n"
    except Exception as e:
        logger.error("LLM stream error: %s", e)
        yield f"data: {json.dumps({'type': 'error', 'content': 'LLM 服务暂时不可用，请稍后重试'}, ensure_ascii=False)}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
