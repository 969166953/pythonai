import asyncio
import json
import logging
from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import AsyncOpenAI

from ..core.config import settings

logger = logging.getLogger(__name__)

chroma_client = chromadb.PersistentClient(path=settings.chroma_persist_dir)

embedding_fn = SentenceTransformerEmbeddingFunction(
    model_name=settings.embedding_model,
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=settings.chunk_size,
    chunk_overlap=settings.chunk_overlap,
    separators=[
        "\n\n\n",
        "\n\n",
        "\n",
        "。", "！", "？", "；",
        ".", "!", "?", ";",
        " ",
        "",
    ],
)

llm_client = AsyncOpenAI(
    api_key=settings.deepseek_api_key,
    base_url=settings.deepseek_base_url,
)


def get_collection(kb_id: str) -> chromadb.Collection:
    return chroma_client.get_or_create_collection(
        name=f"kb_{kb_id}",
        metadata={"hnsw:space": "cosine"},
        embedding_function=embedding_fn,
    )


def _parse_legacy_doc(file_path: Path) -> str:
    import re
    import olefile

    if not olefile.isOleFile(str(file_path)):
        return file_path.read_text(encoding="utf-8", errors="ignore")

    ole = olefile.OleFileIO(str(file_path))
    raw = b""
    for stream in ole.listdir():
        try:
            raw += ole.openstream(stream).read()
        except Exception as e:
            logger.debug("Skipping OLE stream %s: %s", stream, e)
    ole.close()

    text = raw.decode("utf-8", errors="ignore")
    segments = re.findall(
        r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\w\s.,;:!?\-，。；：！？、\u201c\u201d\u2018\u2019（）\[\]【】]+",
        text,
    )
    result = "\n".join(s.strip() for s in segments if len(s.strip()) > 2)
    if not result:
        result = re.sub(r"[^\x20-\x7e\u4e00-\u9fff\n]+", " ", text)
        result = re.sub(r"\s+", " ", result).strip()
    return result


def parse_document(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix in (".txt", ".md"):
        return file_path.read_text(encoding="utf-8", errors="replace")
    elif suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(file_path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    elif suffix == ".docx":
        import docx

        doc = docx.Document(str(file_path))
        return "\n".join(p.text for p in doc.paragraphs)
    elif suffix == ".doc":
        return _parse_legacy_doc(file_path)
    else:
        return file_path.read_text(encoding="utf-8", errors="ignore")


def _ingest_sync(kb_id: str, doc_id: str, file_path: Path) -> int:
    text = parse_document(file_path)
    chunks = text_splitter.split_text(text)

    if not chunks:
        return 0

    collection = get_collection(kb_id)

    batch_size = 100
    for start in range(0, len(chunks), batch_size):
        batch = chunks[start : start + batch_size]
        ids = [f"{doc_id}_{i}" for i in range(start, start + len(batch))]
        metadatas = [
            {"doc_id": doc_id, "filename": file_path.name, "chunk_index": i}
            for i in range(start, start + len(batch))
        ]
        collection.add(documents=batch, ids=ids, metadatas=metadatas)

    return len(chunks)


async def ingest_document(kb_id: str, doc_id: str, file_path: Path) -> int:
    return await asyncio.to_thread(_ingest_sync, kb_id, doc_id, file_path)


def _retrieve_context_sync(kb_id: str, query: str, top_k: int | None = None) -> list[dict]:
    effective_top_k = top_k if top_k is not None else settings.top_k
    collection = get_collection(kb_id)

    if collection.count() == 0:
        return []

    results = collection.query(
        query_texts=[query],
        n_results=min(effective_top_k, collection.count()),
    )

    contexts = []
    for i in range(len(results["documents"][0])):
        contexts.append(
            {
                "content": results["documents"][0][i],
                "filename": results["metadatas"][0][i].get("filename", ""),
                "chunk_index": results["metadatas"][0][i].get("chunk_index", 0),
            }
        )
    return contexts


async def retrieve_context(kb_id: str, query: str, top_k: int | None = None) -> list[dict]:
    return await asyncio.to_thread(_retrieve_context_sync, kb_id, query, top_k)


def _get_document_chunks_sync(kb_id: str, doc_id: str) -> list[dict]:
    collection = get_collection(kb_id)
    try:
        results = collection.get(where={"doc_id": doc_id}, include=["documents", "metadatas"])
        chunks = []
        for i in range(len(results["ids"])):
            chunks.append({
                "index": results["metadatas"][i].get("chunk_index", i),
                "content": results["documents"][i],
            })
        return sorted(chunks, key=lambda c: c["index"])
    except Exception as e:
        logger.error("Failed to get document chunks: %s", e)
        return []


async def get_document_chunks(kb_id: str, doc_id: str) -> list[dict]:
    return await asyncio.to_thread(_get_document_chunks_sync, kb_id, doc_id)


def _delete_document_chunks_sync(kb_id: str, doc_id: str) -> None:
    collection = get_collection(kb_id)
    collection.delete(where={"doc_id": doc_id})


async def delete_document_chunks(kb_id: str, doc_id: str) -> None:
    try:
        await asyncio.to_thread(_delete_document_chunks_sync, kb_id, doc_id)
    except Exception as e:
        logger.error("Failed to delete document chunks kb=%s doc=%s: %s", kb_id, doc_id, e)
        raise


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
        {
            "role": "user",
            "content": f"参考文档：\n{context_text}\n\n用户问题：{query}",
        },
    )

    return messages


async def stream_chat(
    kb_id: str,
    query: str,
    history: list[dict] | None = None,
):
    contexts = await retrieve_context(kb_id, query)

    sources = [
        {"filename": c["filename"], "chunk": c["content"][:100] + "..."}
        for c in contexts
    ]

    yield f"data: {json.dumps({'type': 'sources', 'sources': sources}, ensure_ascii=False)}\n\n"

    messages = build_prompt(query, contexts, history)

    try:
        stream = await llm_client.chat.completions.create(
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
