import json
from pathlib import Path

import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import AsyncOpenAI

from ..core.config import settings

chroma_client = chromadb.PersistentClient(path=settings.chroma_persist_dir)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=settings.chunk_size,
    chunk_overlap=settings.chunk_overlap,
    separators=["\n\n", "\n", "。", ".", " ", ""],
)

llm_client = AsyncOpenAI(
    api_key=settings.deepseek_api_key,
    base_url=settings.deepseek_base_url,
)


def get_collection(kb_id: str) -> chromadb.Collection:
    return chroma_client.get_or_create_collection(
        name=f"kb_{kb_id}",
        metadata={"hnsw:space": "cosine"},
    )


def _parse_legacy_doc(file_path: Path) -> str:
    """Parse old-format .doc (OLE2) files using olefile + regex text extraction."""
    import re
    import olefile

    if not olefile.isOleFile(str(file_path)):
        return file_path.read_text(encoding="utf-8", errors="ignore")

    ole = olefile.OleFileIO(str(file_path))
    raw = b""
    for stream in ole.listdir():
        try:
            raw += ole.openstream(stream).read()
        except Exception:
            pass
    ole.close()

    text = raw.decode("utf-8", errors="ignore")
    # Extract CJK + ASCII readable text segments
    segments = re.findall(
        r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\w\s.,;:!?\-，。；：！？、""''（）\[\]【】]+",
        text,
    )
    result = "\n".join(s.strip() for s in segments if len(s.strip()) > 2)
    if not result:
        # Fallback: extract all printable characters
        result = re.sub(r"[^\x20-\x7e\u4e00-\u9fff\n]+", " ", text)
        result = re.sub(r"\s+", " ", result).strip()
    return result


def parse_document(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix in (".txt", ".md"):
        return file_path.read_text(encoding="utf-8")
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


async def ingest_document(kb_id: str, doc_id: str, file_path: Path) -> int:
    text = parse_document(file_path)
    chunks = text_splitter.split_text(text)

    if not chunks:
        return 0

    collection = get_collection(kb_id)
    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    metadatas = [
        {"doc_id": doc_id, "filename": file_path.name, "chunk_index": i}
        for i in range(len(chunks))
    ]

    collection.add(documents=chunks, ids=ids, metadatas=metadatas)
    return len(chunks)


def retrieve_context(kb_id: str, query: str, top_k: int = None) -> list[dict]:
    top_k = top_k or settings.top_k
    collection = get_collection(kb_id)

    if collection.count() == 0:
        return []

    results = collection.query(query_texts=[query], n_results=min(top_k, collection.count()))

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


def delete_document_chunks(kb_id: str, doc_id: str):
    collection = get_collection(kb_id)
    try:
        collection.delete(where={"doc_id": doc_id})
    except Exception:
        pass


def build_prompt(query: str, contexts: list[dict]) -> list[dict]:
    context_text = "\n\n---\n\n".join(
        f"[来源: {c['filename']}]\n{c['content']}" for c in contexts
    )

    return [
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
        {
            "role": "user",
            "content": f"参考文档：\n{context_text}\n\n用户问题：{query}",
        },
    ]


async def stream_chat(kb_id: str, query: str):
    contexts = retrieve_context(kb_id, query)

    sources = [
        {"filename": c["filename"], "chunk": c["content"][:100] + "..."}
        for c in contexts
    ]

    yield f"data: {json.dumps({'type': 'sources', 'sources': sources}, ensure_ascii=False)}\n\n"

    messages = build_prompt(query, contexts)

    stream = await llm_client.chat.completions.create(
        model=settings.deepseek_model,
        messages=messages,
        stream=True,
        temperature=0.3,
        max_tokens=2000,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield f"data: {json.dumps({'type': 'token', 'content': delta.content}, ensure_ascii=False)}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
