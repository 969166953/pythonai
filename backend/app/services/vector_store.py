"""
向量存储模块 — 后续切换向量数据库在这里改。

当前使用 ChromaDB，后续如需切换为:
- Milvus
- Qdrant
- Pinecone
- pgvector

只需实现相同的函数接口（ingest / retrieve / delete / get_chunks），
然后在 rag.py 中替换 import 即可。
"""

import asyncio
import logging

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from langchain_text_splitters import RecursiveCharacterTextSplitter

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
        "\n\n\n", "\n\n", "\n",
        "。", "！", "？", "；",
        ".", "!", "?", ";",
        " ", "",
    ],
)


def _get_collection(kb_id: str) -> chromadb.Collection:
    return chroma_client.get_or_create_collection(
        name=f"kb_{kb_id}",
        metadata={"hnsw:space": "cosine"},
        embedding_function=embedding_fn,
    )


def _ingest_sync(kb_id: str, doc_id: str, filename: str, text: str) -> int:
    chunks = text_splitter.split_text(text)
    if not chunks:
        return 0

    collection = _get_collection(kb_id)
    batch_size = 100
    for start in range(0, len(chunks), batch_size):
        batch = chunks[start : start + batch_size]
        ids = [f"{doc_id}_{i}" for i in range(start, start + len(batch))]
        metadatas = [
            {"doc_id": doc_id, "filename": filename, "chunk_index": i}
            for i in range(start, start + len(batch))
        ]
        collection.add(documents=batch, ids=ids, metadatas=metadatas)

    return len(chunks)


async def ingest(kb_id: str, doc_id: str, filename: str, text: str) -> int:
    return await asyncio.to_thread(_ingest_sync, kb_id, doc_id, filename, text)


def _retrieve_sync(kb_id: str, query: str, top_k: int | None = None) -> list[dict]:
    effective_top_k = top_k if top_k is not None else settings.top_k
    collection = _get_collection(kb_id)

    if collection.count() == 0:
        return []

    results = collection.query(
        query_texts=[query],
        n_results=min(effective_top_k, collection.count()),
    )

    return [
        {
            "content": results["documents"][0][i],
            "filename": results["metadatas"][0][i].get("filename", ""),
            "chunk_index": results["metadatas"][0][i].get("chunk_index", 0),
        }
        for i in range(len(results["documents"][0]))
    ]


async def retrieve(kb_id: str, query: str, top_k: int | None = None) -> list[dict]:
    return await asyncio.to_thread(_retrieve_sync, kb_id, query, top_k)


def _get_chunks_sync(kb_id: str, doc_id: str) -> list[dict]:
    collection = _get_collection(kb_id)
    try:
        results = collection.get(where={"doc_id": doc_id}, include=["documents", "metadatas"])
        chunks = [
            {"index": results["metadatas"][i].get("chunk_index", i), "content": results["documents"][i]}
            for i in range(len(results["ids"]))
        ]
        return sorted(chunks, key=lambda c: c["index"])
    except Exception as e:
        logger.error("Failed to get document chunks: %s", e)
        return []


async def get_chunks(kb_id: str, doc_id: str) -> list[dict]:
    return await asyncio.to_thread(_get_chunks_sync, kb_id, doc_id)


def _delete_chunks_sync(kb_id: str, doc_id: str) -> None:
    collection = _get_collection(kb_id)
    collection.delete(where={"doc_id": doc_id})


async def delete_chunks(kb_id: str, doc_id: str) -> None:
    try:
        await asyncio.to_thread(_delete_chunks_sync, kb_id, doc_id)
    except Exception as e:
        logger.error("Failed to delete chunks kb=%s doc=%s: %s", kb_id, doc_id, e)
        raise
