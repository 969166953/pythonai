# Code Review 修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 TDD 严格流程修复 code-review 发现的 4 个 CRITICAL 和 7 个 IMPORTANT 问题，并将测试覆盖率从 0% 提升到 80%。

**Architecture:** 每个问题一个任务，任务内走 RED → GREEN → REFACTOR → COMMIT。先搭测试基础设施，再按依赖顺序修复问题。单分支 `fix/code-review-issues`。

**Tech Stack:** pytest + httpx + Jest + React Testing Library + Playwright

---

## Task 0: 创建 worktree 和切换分支

**Files:**
- 无文件变更

- [ ] **Step 1: 创建 worktree 分支**

```bash
cd /Users/yx/Code/ai-knowledge-base
git worktree add ../ai-knowledge-base-fix fix/code-review-issues
cd ../ai-knowledge-base-fix
```

- [ ] **Step 2: 验证在正确分支**

Run: `git branch --show-current`
Expected: `fix/code-review-issues`

---

## Task 1: 后端测试基础设施（pytest fixtures）

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/unit/__init__.py`
- Create: `backend/tests/integration/__init__.py`
- Modify: `backend/requirements.txt` 添加测试依赖
- Create: `backend/pytest.ini`

- [ ] **Step 1: 添加测试依赖到 requirements.txt**

```
pytest>=8.0.0
pytest-asyncio>=0.24.0
pytest-cov>=5.0.0
httpx>=0.28.0
```

- [ ] **Step 2: 安装依赖**

```bash
cd backend && source .venv/bin/activate && pip install -r requirements.txt
```

- [ ] **Step 3: 创建 pytest.ini**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
addopts = -v --tb=short --cov=app --cov-report=term-missing --cov-report=html
```

- [ ] **Step 4: 创建 conftest.py**

路径 `backend/tests/conftest.py`:

```python
import asyncio
import os
import tempfile
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool


class FakeEmbeddingFunction:
    """固定向量 embedding，跳过真实 SentenceTransformer 加载。"""

    def __call__(self, input):
        # 返回固定维度 384 的伪向量，每个文本哈希映射
        import hashlib

        vectors = []
        for text in input:
            h = hashlib.md5(text.encode()).digest()
            vec = [((b - 128) / 128.0) for b in h * 24][:384]
            vectors.append(vec)
        return vectors

    def name(self):
        return "fake"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    from app.core.database import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def temp_chroma(monkeypatch, tmp_path):
    """临时 ChromaDB 目录 + fake embedding。"""
    chroma_dir = tmp_path / "chroma"
    chroma_dir.mkdir()

    # 在 import vector_store 之前 patch 环境和 embedding
    monkeypatch.setenv("CHROMA_PERSIST_DIR", str(chroma_dir))

    import chromadb

    fake_client = chromadb.PersistentClient(path=str(chroma_dir))

    from app.services import vector_store

    monkeypatch.setattr(vector_store, "chroma_client", fake_client)
    monkeypatch.setattr(vector_store, "embedding_fn", FakeEmbeddingFunction())

    yield chroma_dir


@pytest_asyncio.fixture
async def client(db_session, temp_chroma, monkeypatch):
    """带依赖注入覆盖的测试客户端。"""
    from app.core.database import get_db
    from app.main import app

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    # Mock LLM 客户端
    class FakeDelta:
        def __init__(self, content):
            self.content = content

    class FakeChoice:
        def __init__(self, content):
            self.delta = FakeDelta(content)

    class FakeChunk:
        def __init__(self, content):
            self.choices = [FakeChoice(content)]

    class FakeStream:
        def __init__(self, text):
            self.chunks = [FakeChunk(c) for c in text.split()]

        def __aiter__(self):
            return self._gen()

        async def _gen(self):
            for c in self.chunks:
                yield c

    class FakeCompletions:
        async def create(self, **kwargs):
            return FakeStream("Mocked LLM response.")

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeLLM:
        def __init__(self):
            self.chat = FakeChat()

    from app.services import llm

    monkeypatch.setattr(llm, "_client", FakeLLM())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()
```

- [ ] **Step 5: 验证配置正确**

Run: `cd backend && pytest --collect-only`
Expected: collected 0 items（还没写测试）

- [ ] **Step 6: Commit**

```bash
git add backend/tests backend/pytest.ini backend/requirements.txt
git commit -m "test: 搭建后端测试基础设施 (pytest + 内存 SQLite + 临时 ChromaDB)"
```

---

## Task 2: I3 - olefile 加入依赖（最简单的先做）

**Files:**
- Modify: `backend/requirements.txt`
- Test: `backend/tests/unit/test_parser.py`

- [ ] **Step 1: 写失败测试**

路径 `backend/tests/unit/test_parser.py`:

```python
import pytest


def test_olefile_importable():
    """olefile 必须可导入，否则 .doc 解析会运行时失败。"""
    import olefile

    assert olefile is not None
```

- [ ] **Step 2: 运行确认失败**

```bash
cd backend && pytest tests/unit/test_parser.py::test_olefile_importable -v
```

Expected: PASS（olefile 随 chromadb 一起装了）或 FAIL（ModuleNotFoundError）

- [ ] **Step 3: 添加依赖**

在 `backend/requirements.txt` 末尾添加：

```
olefile>=0.47
```

- [ ] **Step 4: 安装验证**

```bash
pip install -r requirements.txt
pytest tests/unit/test_parser.py::test_olefile_importable -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/tests/unit/test_parser.py
git commit -m "fix(deps): 显式声明 olefile 依赖避免 .doc 解析运行时错误"
```

---

## Task 3: I1 - CJK 文件名修复

**Files:**
- Create: `backend/app/services/filename.py`
- Modify: `backend/app/api/documents.py:81-84`
- Test: `backend/tests/unit/test_filename.py`

- [ ] **Step 1: 写失败测试**

路径 `backend/tests/unit/test_filename.py`:

```python
from app.services.filename import sanitize_filename


def test_ascii_filename_preserved():
    assert sanitize_filename("report.pdf") == "report.pdf"


def test_chinese_filename_preserved():
    assert sanitize_filename("产品介绍.docx") == "产品介绍.docx"


def test_japanese_filename_preserved():
    assert sanitize_filename("ドキュメント.pdf") == "ドキュメント.pdf"


def test_special_chars_stripped():
    assert sanitize_filename("hello<>:|?.txt") == "hello.txt"


def test_empty_returns_unknown():
    assert sanitize_filename("") == "unknown"
    assert sanitize_filename("///") == "unknown"


def test_mixed_cjk_ascii():
    assert sanitize_filename("项目 2026-Q1.pdf") == "项目 2026-Q1.pdf"
```

- [ ] **Step 2: 运行确认失败**

```bash
pytest tests/unit/test_filename.py -v
```

Expected: FAIL（ImportError: cannot import name 'sanitize_filename'）

- [ ] **Step 3: 写最小实现**

路径 `backend/app/services/filename.py`:

```python
import unicodedata


def sanitize_filename(name: str) -> str:
    safe = []
    for c in name:
        if c.isalnum() or c in ".-_ ()":
            safe.append(c)
        elif unicodedata.category(c)[0] == "L":
            safe.append(c)
    result = "".join(safe).strip()
    return result or "unknown"
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pytest tests/unit/test_filename.py -v
```

Expected: 6 passed

- [ ] **Step 5: 在 documents.py 中使用**

修改 `backend/app/api/documents.py` 上传端点：

```python
from ..services.filename import sanitize_filename

# 将原来的 filename 处理替换为：
filename = sanitize_filename(file.filename or "unknown")
```

删除原来的字符过滤代码（81-84 行的 `"".join(c for c in ...)` 块）。

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/filename.py backend/app/api/documents.py backend/tests/unit/test_filename.py
git commit -m "fix: CJK 文件名在上传时正确保留，不再被过滤器截断"
```

---

## Task 4: 补充 parser.py 测试

**Files:**
- Modify: `backend/tests/unit/test_parser.py`

- [ ] **Step 1: 写测试**

```python
import tempfile
from pathlib import Path

from app.services.parser import parse_document


def test_parse_txt():
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w", delete=False, encoding="utf-8") as f:
        f.write("Hello World\n你好世界")
        path = Path(f.name)

    try:
        result = parse_document(path)
        assert "Hello World" in result
        assert "你好世界" in result
    finally:
        path.unlink()


def test_parse_md():
    with tempfile.NamedTemporaryFile(suffix=".md", mode="w", delete=False, encoding="utf-8") as f:
        f.write("# Title\n\nContent")
        path = Path(f.name)

    try:
        result = parse_document(path)
        assert "# Title" in result
        assert "Content" in result
    finally:
        path.unlink()


def test_parse_empty_file():
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w", delete=False) as f:
        path = Path(f.name)

    try:
        result = parse_document(path)
        assert result == ""
    finally:
        path.unlink()


def test_parse_unknown_suffix_fallback():
    with tempfile.NamedTemporaryFile(suffix=".xyz", mode="w", delete=False, encoding="utf-8") as f:
        f.write("fallback content")
        path = Path(f.name)

    try:
        result = parse_document(path)
        assert "fallback content" in result
    finally:
        path.unlink()


def test_parse_txt_invalid_utf8():
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="wb", delete=False) as f:
        f.write(b"valid \xff\xfe invalid bytes")
        path = Path(f.name)

    try:
        result = parse_document(path)
        # 应该使用 errors="replace" 返回部分内容
        assert "valid" in result
    finally:
        path.unlink()
```

- [ ] **Step 2: 运行测试**

```bash
pytest tests/unit/test_parser.py -v
```

Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_parser.py
git commit -m "test: 添加 parser.py 单元测试（TXT/MD/空文件/未知后缀/非法编码）"
```

---

## Task 5: vector_store.py 测试（为后续 C1 准备）

**Files:**
- Create: `backend/tests/unit/test_vector_store.py`

- [ ] **Step 1: 写测试**

```python
import pytest

from app.services import vector_store


@pytest.mark.asyncio
async def test_ingest_and_retrieve(temp_chroma):
    count = await vector_store.ingest(
        kb_id="test-kb",
        doc_id="doc1",
        filename="test.txt",
        text="Python is a programming language. It is easy to learn.",
    )
    assert count >= 1

    results = await vector_store.retrieve("test-kb", "programming", top_k=5)
    assert len(results) >= 1
    assert results[0]["filename"] == "test.txt"


@pytest.mark.asyncio
async def test_retrieve_empty_collection(temp_chroma):
    results = await vector_store.retrieve("empty-kb", "anything")
    assert results == []


@pytest.mark.asyncio
async def test_get_chunks(temp_chroma):
    await vector_store.ingest(
        kb_id="test-kb",
        doc_id="doc1",
        filename="test.txt",
        text="First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
    )
    chunks = await vector_store.get_chunks("test-kb", "doc1")
    assert len(chunks) >= 1
    assert all("content" in c and "index" in c for c in chunks)


@pytest.mark.asyncio
async def test_delete_chunks(temp_chroma):
    await vector_store.ingest(
        kb_id="test-kb",
        doc_id="doc1",
        filename="test.txt",
        text="content to be deleted",
    )
    await vector_store.delete_chunks("test-kb", "doc1")
    chunks = await vector_store.get_chunks("test-kb", "doc1")
    assert chunks == []


@pytest.mark.asyncio
async def test_delete_collection_not_exists(temp_chroma):
    """delete_collection 对不存在的 collection 不应抛出。"""
    # 会在 Task 6 实现
    pass
```

- [ ] **Step 2: 运行测试**

```bash
pytest tests/unit/test_vector_store.py -v
```

Expected: 4 passed（最后一个是 placeholder pass）

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_vector_store.py
git commit -m "test: 添加 vector_store 单元测试（ingest/retrieve/get_chunks/delete_chunks）"
```

---

## Task 6: C1 - 删除知识库清理 ChromaDB

**Files:**
- Modify: `backend/app/services/vector_store.py`
- Modify: `backend/app/api/knowledge_bases.py`
- Modify: `backend/tests/unit/test_vector_store.py`
- Create: `backend/tests/integration/test_knowledge_bases_api.py`

- [ ] **Step 1: 写 vector_store 单元测试（RED）**

替换 `test_vector_store.py` 最后那个 placeholder：

```python
@pytest.mark.asyncio
async def test_delete_collection_removes_all_chunks(temp_chroma):
    await vector_store.ingest("kb1", "doc1", "a.txt", "content A")
    await vector_store.ingest("kb1", "doc2", "b.txt", "content B")

    await vector_store.delete_collection("kb1")

    chunks1 = await vector_store.get_chunks("kb1", "doc1")
    chunks2 = await vector_store.get_chunks("kb1", "doc2")
    assert chunks1 == []
    assert chunks2 == []


@pytest.mark.asyncio
async def test_delete_collection_idempotent(temp_chroma):
    """删除不存在的 collection 不应抛异常。"""
    await vector_store.delete_collection("nonexistent")
    # 再删一次也不该炸
    await vector_store.delete_collection("nonexistent")
```

- [ ] **Step 2: 运行确认失败**

```bash
pytest tests/unit/test_vector_store.py::test_delete_collection_removes_all_chunks -v
```

Expected: FAIL（AttributeError: module has no 'delete_collection'）

- [ ] **Step 3: 实现 delete_collection**

在 `backend/app/services/vector_store.py` 末尾添加：

```python
def _delete_collection_sync(kb_id: str) -> None:
    try:
        chroma_client.delete_collection(name=f"kb_{kb_id}")
    except Exception as e:
        # ChromaDB 对不存在的 collection 会抛出，忽略
        logger.info("Collection kb_%s not found or already deleted: %s", kb_id, e)


async def delete_collection(kb_id: str) -> None:
    await asyncio.to_thread(_delete_collection_sync, kb_id)
```

- [ ] **Step 4: 运行单元测试确认通过**

```bash
pytest tests/unit/test_vector_store.py -v
```

Expected: 所有测试通过

- [ ] **Step 5: 写集成测试（RED）**

`backend/tests/integration/test_knowledge_bases_api.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_delete_kb_removes_vector_data(client, temp_chroma):
    # 创建 KB
    res = await client.post("/api/knowledge-bases", json={"name": "test"})
    kb_id = res.json()["id"]

    # 直接通过 vector_store 注入数据（模拟文档上传后的状态）
    from app.services import vector_store

    await vector_store.ingest(kb_id, "doc1", "test.txt", "some content")

    # 删除 KB
    res = await client.delete(f"/api/knowledge-bases/{kb_id}")
    assert res.status_code == 200

    # 验证向量已清理
    chunks = await vector_store.get_chunks(kb_id, "doc1")
    assert chunks == []
```

- [ ] **Step 6: 运行确认失败**

```bash
pytest tests/integration/test_knowledge_bases_api.py::test_delete_kb_removes_vector_data -v
```

Expected: FAIL（删除后 chunks 仍存在）

- [ ] **Step 7: 修改 delete_knowledge_base 端点**

在 `backend/app/api/knowledge_bases.py` 顶部 import：

```python
from ..services import vector_store
```

修改 delete 端点：

```python
@router.delete("/{kb_id}")
async def delete_knowledge_base(kb_id: str, db: AsyncSession = Depends(get_db)):
    kb = await db.get(KnowledgeBaseModel, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    await vector_store.delete_collection(kb_id)
    await db.delete(kb)
    await db.commit()
    return {"success": True}
```

- [ ] **Step 8: 运行测试确认通过**

```bash
pytest tests/integration/test_knowledge_bases_api.py -v
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/vector_store.py backend/app/api/knowledge_bases.py backend/tests/
git commit -m "fix: 删除知识库时清理 ChromaDB 向量集合（C1）"
```

---

## Task 7: C3 - SSE session 生命周期修复

**Files:**
- Modify: `backend/app/api/chat.py`
- Create: `backend/tests/integration/test_chat_api.py`

- [ ] **Step 1: 写失败测试**

`backend/tests/integration/test_chat_api.py`:

```python
import json

import pytest


@pytest.mark.asyncio
async def test_chat_persists_user_and_assistant_messages(client, temp_chroma):
    # 创建 KB 和 conversation
    kb_res = await client.post("/api/knowledge-bases", json={"name": "t"})
    kb_id = kb_res.json()["id"]
    conv_res = await client.post(f"/api/knowledge-bases/{kb_id}/conversations")
    conv_id = conv_res.json()["id"]

    # 注意：此测试验证修复后的 POST 协议 + session 生命周期
    async with client.stream(
        "POST",
        "/api/chat/stream",
        json={"message": "hello", "kb_id": kb_id, "conversation_id": conv_id},
    ) as res:
        assert res.status_code == 200
        chunks = []
        async for line in res.aiter_lines():
            if line.startswith("data: "):
                chunks.append(json.loads(line[6:]))

    # 应该收到 sources、token、done
    types = [c["type"] for c in chunks]
    assert "sources" in types
    assert "done" in types

    # 验证消息持久化（session 生命周期修复的关键验证点）
    msgs_res = await client.get(
        f"/api/knowledge-bases/{kb_id}/conversations/{conv_id}/messages"
    )
    msgs = msgs_res.json()
    assert len(msgs) == 2  # user + assistant
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "hello"
    assert msgs[1]["role"] == "assistant"
```

- [ ] **Step 2: 运行确认失败**

```bash
pytest tests/integration/test_chat_api.py -v
```

Expected: FAIL（GET 端点不接受 POST）

- [ ] **Step 3: 重写 chat.py**

完整替换 `backend/app/api/chat.py`:

```python
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from ..core.database import async_session
from ..models.schemas import MessageModel, ConversationModel
from ..services.rag import stream_chat

router = APIRouter(prefix="/chat", tags=["chat"])

MAX_MESSAGE_LENGTH = 5000


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LENGTH)
    kb_id: str
    conversation_id: str


@router.post("/stream")
async def chat_stream(req: ChatRequest):
    # 请求阶段：校验归属、写入 user 消息、构建 history
    async with async_session() as db:
        conv = await db.get(ConversationModel, req.conversation_id)
        if not conv or conv.kb_id != req.kb_id:
            raise HTTPException(status_code=404, detail="对话不存在")

        user_msg = MessageModel(
            conversation_id=req.conversation_id,
            role="user",
            content=req.message,
        )
        db.add(user_msg)
        await db.commit()
        await db.refresh(user_msg)
        user_msg_id = user_msg.id

        if conv.title == "新对话":
            conv.title = req.message[:50]
            await db.commit()

        rows = (
            await db.execute(
                select(MessageModel)
                .where(MessageModel.conversation_id == req.conversation_id)
                .order_by(MessageModel.created_at.asc())
            )
        ).scalars().all()
        history = [
            {"role": m.role, "content": m.content}
            for m in rows if m.id != user_msg_id
        ]

    async def generate():
        collected_content = []
        collected_sources = None

        async for chunk in stream_chat(req.kb_id, req.message, history=history):
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

        # 响应结束后用独立 session 写入 assistant 消息
        async with async_session() as db:
            assistant_msg = MessageModel(
                conversation_id=req.conversation_id,
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
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pytest tests/integration/test_chat_api.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/chat.py backend/tests/integration/test_chat_api.py
git commit -m "fix(chat): SSE 改为 POST，生成器内独立 session 避免生命周期问题（C2+C3）"
```

---

## Task 8: chat_api 补充错误处理测试

**Files:**
- Modify: `backend/tests/integration/test_chat_api.py`

- [ ] **Step 1: 追加测试**

```python
@pytest.mark.asyncio
async def test_chat_rejects_mismatched_kb_id(client, temp_chroma):
    kb_res = await client.post("/api/knowledge-bases", json={"name": "t"})
    kb_id = kb_res.json()["id"]
    conv_res = await client.post(f"/api/knowledge-bases/{kb_id}/conversations")
    conv_id = conv_res.json()["id"]

    # 用错误的 kb_id
    res = await client.post(
        "/api/chat/stream",
        json={"message": "hello", "kb_id": "wrong", "conversation_id": conv_id},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_chat_rejects_empty_message(client, temp_chroma):
    kb_res = await client.post("/api/knowledge-bases", json={"name": "t"})
    kb_id = kb_res.json()["id"]
    conv_res = await client.post(f"/api/knowledge-bases/{kb_id}/conversations")
    conv_id = conv_res.json()["id"]

    res = await client.post(
        "/api/chat/stream",
        json={"message": "", "kb_id": kb_id, "conversation_id": conv_id},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_chat_rejects_too_long_message(client, temp_chroma):
    kb_res = await client.post("/api/knowledge-bases", json={"name": "t"})
    kb_id = kb_res.json()["id"]
    conv_res = await client.post(f"/api/knowledge-bases/{kb_id}/conversations")
    conv_id = conv_res.json()["id"]

    res = await client.post(
        "/api/chat/stream",
        json={"message": "x" * 6000, "kb_id": kb_id, "conversation_id": conv_id},
    )
    assert res.status_code == 422
```

- [ ] **Step 2: 运行测试**

```bash
pytest tests/integration/test_chat_api.py -v
```

Expected: 全部通过

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/test_chat_api.py
git commit -m "test(chat): 补充归属校验和输入长度校验测试"
```

---

## Task 9: I2 - 列表接口光标分页（knowledge_bases）

**Files:**
- Create: `backend/app/core/pagination.py`
- Modify: `backend/app/api/knowledge_bases.py`
- Modify: `backend/tests/integration/test_knowledge_bases_api.py`

- [ ] **Step 1: 写失败测试**

追加到 `backend/tests/integration/test_knowledge_bases_api.py`:

```python
@pytest.mark.asyncio
async def test_list_kb_pagination_default(client, temp_chroma):
    for i in range(5):
        await client.post("/api/knowledge-bases", json={"name": f"kb-{i}"})

    res = await client.get("/api/knowledge-bases")
    data = res.json()
    assert "items" in data
    assert "next_cursor" in data
    assert len(data["items"]) == 5
    assert data["next_cursor"] is None


@pytest.mark.asyncio
async def test_list_kb_pagination_with_limit(client, temp_chroma):
    for i in range(5):
        await client.post("/api/knowledge-bases", json={"name": f"kb-{i}"})

    res = await client.get("/api/knowledge-bases?limit=2")
    data = res.json()
    assert len(data["items"]) == 2
    assert data["next_cursor"] is not None


@pytest.mark.asyncio
async def test_list_kb_pagination_follow_cursor(client, temp_chroma):
    for i in range(5):
        await client.post("/api/knowledge-bases", json={"name": f"kb-{i}"})

    res1 = await client.get("/api/knowledge-bases?limit=2")
    cursor = res1.json()["next_cursor"]

    res2 = await client.get(f"/api/knowledge-bases?limit=2&cursor={cursor}")
    data2 = res2.json()
    assert len(data2["items"]) == 2
    # 确保不重复
    ids1 = {i["id"] for i in res1.json()["items"]}
    ids2 = {i["id"] for i in data2["items"]}
    assert ids1.isdisjoint(ids2)


@pytest.mark.asyncio
async def test_list_kb_limit_exceeds_max(client, temp_chroma):
    res = await client.get("/api/knowledge-bases?limit=101")
    assert res.status_code == 422
```

- [ ] **Step 2: 运行确认失败**

```bash
pytest tests/integration/test_knowledge_bases_api.py -v
```

Expected: FAIL（现在返回的是 list 不是 {items, next_cursor}）

- [ ] **Step 3: 写分页工具模块**

`backend/app/core/pagination.py`:

```python
from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None


def parse_cursor(cursor: str | None) -> datetime | None:
    if cursor is None:
        return None
    return datetime.fromisoformat(cursor)
```

- [ ] **Step 4: 重写 list 端点**

修改 `backend/app/api/knowledge_bases.py` list_knowledge_bases:

```python
from fastapi import Query
from ..core.pagination import Page, parse_cursor


@router.get("", response_model=Page[KBResponse])
async def list_knowledge_bases(
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(KnowledgeBaseModel).order_by(KnowledgeBaseModel.created_at.desc())
    cursor_dt = parse_cursor(cursor)
    if cursor_dt:
        query = query.where(KnowledgeBaseModel.created_at < cursor_dt)
    query = query.limit(limit + 1)

    rows = (await db.execute(query)).scalars().all()
    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = items[-1].created_at.isoformat() if has_more else None

    return Page(
        items=[
            KBResponse(
                id=kb.id,
                name=kb.name,
                description=kb.description,
                document_count=kb.document_count,
                created_at=kb.created_at.isoformat(),
            )
            for kb in items
        ],
        next_cursor=next_cursor,
    )
```

- [ ] **Step 5: 运行测试确认通过**

```bash
pytest tests/integration/test_knowledge_bases_api.py -v
```

Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/pagination.py backend/app/api/knowledge_bases.py backend/tests/integration/test_knowledge_bases_api.py
git commit -m "feat: 知识库列表接口支持光标分页（I2-1）"
```

---

## Task 10: I2 - documents 和 conversations 列表分页

**Files:**
- Modify: `backend/app/api/documents.py`
- Modify: `backend/app/api/conversations.py`
- Create: `backend/tests/integration/test_documents_api.py`
- Create: `backend/tests/integration/test_conversations_api.py`

- [ ] **Step 1: 写 documents 测试**

`backend/tests/integration/test_documents_api.py`:

```python
import io

import pytest


async def _create_kb(client, name="t"):
    return (await client.post("/api/knowledge-bases", json={"name": name})).json()["id"]


@pytest.mark.asyncio
async def test_list_documents_pagination(client, temp_chroma):
    kb_id = await _create_kb(client)

    # 直接在 DB 写文档（避免真上传走向量化慢）
    from app.core.database import async_session
    from app.models.schemas import DocumentModel

    async with async_session() as db:
        for i in range(3):
            db.add(DocumentModel(kb_id=kb_id, filename=f"doc-{i}.txt", status="ready"))
        await db.commit()

    res = await client.get(f"/api/knowledge-bases/{kb_id}/documents?limit=2")
    data = res.json()
    assert len(data["items"]) == 2
    assert data["next_cursor"] is not None


@pytest.mark.asyncio
async def test_upload_rejects_bad_extension(client, temp_chroma):
    kb_id = await _create_kb(client)

    files = {"file": ("bad.exe", io.BytesIO(b"x"), "application/octet-stream")}
    res = await client.post(f"/api/knowledge-bases/{kb_id}/documents", files=files)
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_upload_rejects_oversize(client, temp_chroma, monkeypatch):
    # 临时降低上传上限方便测试
    from app.core.config import settings

    monkeypatch.setattr(settings, "max_upload_bytes", 10)

    kb_id = await _create_kb(client)
    files = {"file": ("big.txt", io.BytesIO(b"x" * 100), "text/plain")}
    res = await client.post(f"/api/knowledge-bases/{kb_id}/documents", files=files)
    assert res.status_code == 413
```

- [ ] **Step 2: 写 conversations 测试**

`backend/tests/integration/test_conversations_api.py`:

```python
import pytest


async def _create_kb(client, name="t"):
    return (await client.post("/api/knowledge-bases", json={"name": name})).json()["id"]


@pytest.mark.asyncio
async def test_list_conversations_pagination(client, temp_chroma):
    kb_id = await _create_kb(client)
    for _ in range(3):
        await client.post(f"/api/knowledge-bases/{kb_id}/conversations")

    res = await client.get(f"/api/knowledge-bases/{kb_id}/conversations?limit=2")
    data = res.json()
    assert len(data["items"]) == 2
    assert data["next_cursor"] is not None


@pytest.mark.asyncio
async def test_messages_rejects_wrong_kb(client, temp_chroma):
    kb_id = await _create_kb(client, "kb-a")
    kb2_id = await _create_kb(client, "kb-b")
    conv_id = (
        await client.post(f"/api/knowledge-bases/{kb_id}/conversations")
    ).json()["id"]

    res = await client.get(
        f"/api/knowledge-bases/{kb2_id}/conversations/{conv_id}/messages"
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_update_conversation_title(client, temp_chroma):
    kb_id = await _create_kb(client)
    conv_id = (
        await client.post(f"/api/knowledge-bases/{kb_id}/conversations")
    ).json()["id"]

    res = await client.patch(
        f"/api/knowledge-bases/{kb_id}/conversations/{conv_id}",
        json={"title": "新标题"},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "新标题"
```

- [ ] **Step 3: 运行确认失败**

```bash
pytest tests/integration/test_documents_api.py tests/integration/test_conversations_api.py -v
```

Expected: FAIL（列表端点还不是 Page 格式）

- [ ] **Step 4: 修改 documents list 端点**

在 `backend/app/api/documents.py`:

```python
from fastapi import Query
from ..core.pagination import Page, parse_cursor


@router.get("", response_model=Page[DocResponse])
async def list_documents(
    kb_id: str,
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(DocumentModel)
        .where(DocumentModel.kb_id == kb_id)
        .order_by(DocumentModel.created_at.desc())
    )
    cursor_dt = parse_cursor(cursor)
    if cursor_dt:
        query = query.where(DocumentModel.created_at < cursor_dt)
    query = query.limit(limit + 1)

    rows = (await db.execute(query)).scalars().all()
    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = items[-1].created_at.isoformat() if has_more else None

    return Page(
        items=[
            DocResponse(
                id=d.id,
                filename=d.filename,
                status=d.status,
                chunk_count=d.chunk_count,
                created_at=d.created_at.isoformat(),
            )
            for d in items
        ],
        next_cursor=next_cursor,
    )
```

- [ ] **Step 5: 修改 conversations list 端点**

类似处理 `backend/app/api/conversations.py` 的 list_conversations。

- [ ] **Step 6: 运行测试确认通过**

```bash
pytest tests/integration/ -v
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/documents.py backend/app/api/conversations.py backend/tests/integration/
git commit -m "feat: 文档和对话列表接口支持光标分页（I2-2）"
```

---

## Task 11: 前端测试基础设施（Jest + RTL）

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/jest.config.js`
- Create: `frontend/babel.config.js`
- Create: `frontend/src/__tests__/setup.ts`
- Modify: `frontend/tsconfig.json`

- [ ] **Step 1: 安装依赖**

```bash
cd frontend
npm install -D jest @types/jest ts-jest babel-jest @babel/preset-env @babel/preset-react @babel/preset-typescript @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

- [ ] **Step 2: 创建 jest.config.js**

```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEach: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/src/__tests__/__mocks__/styleMock.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/main.tsx',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

- [ ] **Step 3: 创建 babel.config.js**

```javascript
export default {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
};
```

- [ ] **Step 4: 创建 setup 和 mock**

`frontend/src/__tests__/setup.ts`:
```typescript
import '@testing-library/jest-dom';
```

`frontend/src/__tests__/__mocks__/styleMock.js`:
```javascript
module.exports = {};
```

- [ ] **Step 5: 在 package.json 加 scripts**

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

- [ ] **Step 6: 创建示例测试验证配置**

`frontend/src/__tests__/smoke.test.ts`:
```typescript
describe('jest config', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: 运行验证**

```bash
npm test
```

Expected: 1 passed

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/jest.config.js frontend/babel.config.js frontend/src/__tests__/
git commit -m "test: 搭建前端测试基础设施 (Jest + RTL + jsdom)"
```

---

## Task 12: C4 - ConfirmDialog 无障碍修复

**Files:**
- Modify: `frontend/src/components/ui/ConfirmDialog.tsx`
- Create: `frontend/src/__tests__/components/ConfirmDialog.test.tsx`

- [ ] **Step 1: 写失败测试**

`frontend/src/__tests__/components/ConfirmDialog.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('has proper aria attributes', () => {
    render(
      <ConfirmDialog
        open
        title="删除"
        message="确认?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('删除');
  });

  it('closes on Escape key', () => {
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        open
        title="T"
        message="M"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('focuses cancel button on open', async () => {
    render(
      <ConfirmDialog
        open
        title="T"
        message="M"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    const cancelBtn = screen.getByRole('button', { name: /取消/ });
    expect(cancelBtn).toHaveFocus();
  });

  it('does not render when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="T"
        message="M"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npm test -- ConfirmDialog
```

Expected: FAIL

- [ ] **Step 3: 重写 ConfirmDialog**

`frontend/src/components/ui/ConfirmDialog.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认删除',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    cancelBtnRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previousFocusRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />
      <div className="relative bg-surface-elevated rounded-[var(--radius-lg)] border border-border-light shadow-lg p-6 w-[380px] max-w-[90vw] animate-slide-up">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-danger/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <div>
            <h3 id="confirm-dialog-title" className="text-[16px] font-semibold mb-1">
              {title}
            </h3>
            <p
              id="confirm-dialog-message"
              className="text-[13px] text-text-secondary leading-relaxed"
            >
              {message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button ref={cancelBtnRef} variant="secondary" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
```

注意：Button 组件需要支持 ref，如果 Button.tsx 还没用 `forwardRef`，需要先改造：

`frontend/src/components/ui/Button.tsx` 改为 forwardRef 形式（保持其他 API 不变）。

- [ ] **Step 4: 改造 Button 支持 ref**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) {
    // ... 原有逻辑
    return <button ref={ref} className={...} {...props}>{children}</button>;
  }
);
```

（根据实际 Button.tsx 内容适配，保持原有样式逻辑）

- [ ] **Step 5: 运行测试确认通过**

```bash
npm test -- ConfirmDialog
```

Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/ConfirmDialog.tsx frontend/src/components/ui/Button.tsx frontend/src/__tests__/
git commit -m "fix: ConfirmDialog 添加 aria 属性、焦点管理、Escape 关闭（C4）"
```

---

## Task 13: I5 - CodeBlock clipboard 错误处理

**Files:**
- Modify: `frontend/src/components/chat/CodeBlock.tsx`
- Create: `frontend/src/__tests__/components/CodeBlock.test.tsx`

- [ ] **Step 1: 写失败测试**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeBlock } from '../../components/chat/CodeBlock';

describe('CodeBlock', () => {
  it('copies text on button click', async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CodeBlock language="ts">console.log(1)</CodeBlock>);
    await user.click(screen.getByRole('button', { name: /复制/ }));

    expect(writeText).toHaveBeenCalledWith('console.log(1)');
    await waitFor(() => expect(screen.getByText('已复制')).toBeInTheDocument());
  });

  it('shows error state when clipboard fails', async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CodeBlock language="ts">code</CodeBlock>);
    await user.click(screen.getByRole('button', { name: /复制/ }));

    await waitFor(() =>
      expect(screen.getByText(/失败/)).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npm test -- CodeBlock
```

- [ ] **Step 3: 修改 CodeBlock**

```tsx
const [copied, setCopied] = useState(false);
const [copyError, setCopyError] = useState(false);
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };
}, []);

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setCopyError(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  } catch {
    setCopyError(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopyError(false), 2000);
  }
};
```

按钮区域渲染：

```tsx
{copyError ? <span>复制失败</span> : copied ? <><Check size={13} /><span>已复制</span></> : <><Copy size={13} /><span>复制</span></>}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- CodeBlock
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat/CodeBlock.tsx frontend/src/__tests__/components/CodeBlock.test.tsx
git commit -m "fix: CodeBlock clipboard 失败时显示错误状态，清理定时器（I5）"
```

---

## Task 14: I4 - Sidebar useCallback 修复

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/__tests__/components/Sidebar.test.tsx`

- [ ] **Step 1: 写失败测试**

```typescript
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../../components/layout/Sidebar';
import { ToastProvider } from '../../components/ui/Toast';

describe('Sidebar', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], next_cursor: null }),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('fetches knowledge bases once on mount', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Sidebar />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // 等一段时间确认不会再发请求
    await new Promise((r) => setTimeout(r, 100));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行确认失败或通过（视当前代码行为）**

```bash
npm test -- Sidebar
```

- [ ] **Step 3: 修改 Sidebar**

把 `loadKnowledgeBases` 包成 `useCallback`:

```typescript
const loadKnowledgeBases = useCallback(async () => {
  setLoading(true);
  const res = await api.knowledgeBases.list();
  if (res.success && res.data) {
    setKnowledgeBases(res.data.items ?? res.data);
  }
  setLoading(false);
}, []);

useEffect(() => {
  loadKnowledgeBases();
}, [loadKnowledgeBases]);
```

注意：因为接口返回变成 `{ items, next_cursor }`，要兼容处理。同时更新 `api.ts` 的类型。

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- Sidebar
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx frontend/src/__tests__/components/Sidebar.test.tsx
git commit -m "fix: Sidebar loadKnowledgeBases 用 useCallback 避免重复渲染（I4）"
```

---

## Task 15: 前端 API 客户端改造（适配分页 + POST SSE）

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/__tests__/lib/api.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { api, streamChat } from '../../lib/api';

describe('api', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('knowledgeBases.list handles paginated response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: '1' }], next_cursor: null }),
    });

    const res = await api.knowledgeBases.list();
    expect(res.success).toBe(true);
    expect(res.data?.items).toHaveLength(1);
  });

  it('streamChat yields events', async () => {
    const body = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode('data: {"type":"sources","sources":[]}\n\n')
        );
        controller.enqueue(
          encoder.encode('data: {"type":"token","content":"hi"}\n\n')
        );
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, body });

    const events = [];
    for await (const e of streamChat(
      { message: 'q', kb_id: 'k', conversation_id: 'c' },
      new AbortController().signal
    )) {
      events.push(e);
    }

    expect(events.map((e) => e.type)).toEqual(['sources', 'token', 'done']);
  });
});
```

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 重写 api.ts 关键部分**

在 `frontend/src/lib/api.ts` 改造：

```typescript
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

// knowledgeBases.list 改为返回 Page<KnowledgeBase>
list: (cursor?: string, limit = 20) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return request<Page<KnowledgeBase>>(`/knowledge-bases?${params}`);
},

// 其他 list 同样处理（documents.list, conversations.list）

// 添加 streamChat 函数
export interface ChatRequest {
  message: string;
  kb_id: string;
  conversation_id: string;
}

export interface ChatEvent {
  type: 'sources' | 'token' | 'error' | 'done';
  content?: string;
  sources?: Array<{ filename: string; chunk: string }>;
}

export async function* streamChat(
  req: ChatRequest,
  signal: AbortSignal
): AsyncGenerator<ChatEvent> {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error('请求失败');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) {
        if (event.startsWith('data: ')) {
          try {
            yield JSON.parse(event.slice(6));
          } catch {
            // 跳过无效事件
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

移除原 `api.chat = ...` 的 EventSource 创建函数。

- [ ] **Step 4: 运行测试确认通过**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/__tests__/lib/api.test.ts
git commit -m "feat(api): 列表接口适配分页响应，streamChat 改用 fetch + ReadableStream"
```

---

## Task 16: ChatView 改用 streamChat

**Files:**
- Modify: `frontend/src/components/chat/ChatView.tsx`

- [ ] **Step 1: 重构 handleSend**

```typescript
const abortRef = useRef<AbortController | null>(null);

useEffect(() => {
  return () => {
    abortRef.current?.abort();
  };
}, [kbId, conversationId]);

const stopStreaming = () => {
  abortRef.current?.abort();
  abortRef.current = null;
  if (streamContent) {
    setMessages((prev) => [...prev, { _id: ++msgIdCounter, role: 'assistant', content: streamContent }]);
    setStreamContent('');
  }
  setStreaming(false);
};

const handleSend = async () => {
  if (!input.trim() || !kbId || !conversationId || streaming) return;

  const userMsg: MessageWithId = { _id: ++msgIdCounter, role: 'user', content: input.trim() };
  setMessages((p) => [...p, userMsg]);
  setInput('');
  setStreaming(true);
  setStreamContent('');

  const controller = new AbortController();
  abortRef.current = controller;

  let accumulated = '';
  let sources: ChatMessage['sources'] = [];

  try {
    for await (const event of streamChat(
      { message: userMsg.content, kb_id: kbId, conversation_id: conversationId },
      controller.signal
    )) {
      if (event.type === 'token') {
        accumulated += event.content ?? '';
        setStreamContent(accumulated);
      } else if (event.type === 'sources') {
        sources = event.sources;
      } else if (event.type === 'error') {
        setMessages((p) => [...p, {
          _id: ++msgIdCounter,
          role: 'assistant',
          content: `**错误：** ${event.content}`,
        }]);
        break;
      } else if (event.type === 'done') {
        setMessages((p) => [...p, {
          _id: ++msgIdCounter,
          role: 'assistant',
          content: accumulated,
          sources,
        }]);
        break;
      }
    }
  } catch (e) {
    if (!controller.signal.aborted) {
      setMessages((p) => [...p, {
        _id: ++msgIdCounter,
        role: 'assistant',
        content: accumulated || '连接失败，请重试',
      }]);
    }
  } finally {
    setStreamContent('');
    setStreaming(false);
    abortRef.current = null;
  }
};
```

- [ ] **Step 2: 手动验证**

```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000 &
cd frontend && npm run dev
```

在浏览器中打开 http://localhost:3000 测试聊天。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/chat/ChatView.tsx
git commit -m "refactor(chat): ChatView 改用 streamChat + AbortController 替代 EventSource"
```

---

## Task 17: I6 - 文档删除添加确认弹窗

**Files:**
- Modify: `frontend/src/components/knowledge-base/DocumentList.tsx`

- [ ] **Step 1: 加测试**

`frontend/src/__tests__/components/DocumentList.test.tsx`:

```typescript
// 测试文档删除点击后弹出 ConfirmDialog
// 取消后不触发删除 API
// 确认后触发删除
```

（实际内容基于组件结构写，此处略）

- [ ] **Step 2: 修改 DocumentList**

添加 `deleteDocId` state，把原来直接 `handleDelete` 改为：
- 点按钮 → `setDeleteDocId(id)`
- ConfirmDialog 确认 → 真正执行删除

参考 KnowledgeBasePage 的对话删除模式。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/knowledge-base/DocumentList.tsx frontend/src/__tests__/components/DocumentList.test.tsx
git commit -m "feat: 文档删除添加确认弹窗（I6）"
```

---

## Task 18: 补充 hooks 和其他组件测试

**Files:**
- Create: `frontend/src/__tests__/hooks/useTheme.test.ts`
- Create: `frontend/src/__tests__/hooks/useMobileNav.test.ts`
- Create: `frontend/src/__tests__/components/Toast.test.tsx`
- Create: `frontend/src/__tests__/components/ErrorBoundary.test.tsx`

- [ ] **Step 1: 补充所有测试文件（完整代码略，按各组件行为编写）**

- [ ] **Step 2: 运行测试验证覆盖率**

```bash
npm run test:coverage
```

Expected: 覆盖率 ≥ 80%

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/
git commit -m "test: 补充 hooks 和 UI 组件测试达到 80% 覆盖率"
```

---

## Task 19: E2E 测试 - Playwright

**Files:**
- Create: `frontend/playwright.config.ts`
- Create: `frontend/tests/e2e/kb-crud.spec.ts`
- Create: `frontend/tests/e2e/document-upload.spec.ts`
- Create: `frontend/tests/e2e/chat-flow.spec.ts`

- [ ] **Step 1: 安装 Playwright**

```bash
cd frontend && npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: 创建 playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 3: 写 3 个 E2E 测试**

每个覆盖一个关键用户流程。

`kb-crud.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test('create, rename, and delete knowledge base', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /新建知识库/ }).click();
  await page.getByPlaceholder(/输入名称/).fill('E2E Test KB');
  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByText('E2E Test KB')).toBeVisible();
  // 删除
  await page.hover('text=E2E Test KB');
  await page.getByRole('button', { name: /删除/ }).first().click();
  await page.getByRole('button', { name: /确认删除/ }).click();
  await expect(page.getByText('E2E Test KB')).not.toBeVisible();
});
```

其他两个类似。

- [ ] **Step 4: 运行 E2E**

```bash
npm run test:e2e
```

- [ ] **Step 5: Commit**

```bash
git add frontend/playwright.config.ts frontend/tests/e2e/ frontend/package.json
git commit -m "test(e2e): 添加 Playwright E2E 覆盖 KB CRUD、文档上传、聊天流程"
```

---

## Task 20: 更新文档并合并

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: 更新 CHANGELOG**

在 `CHANGELOG.md` 添加：

```markdown
## [1.0.1] - 2026-04-16

### 修复（CRITICAL）
- 删除知识库时清理 ChromaDB 向量数据
- 聊天 SSE 从 GET 改为 POST（破坏性变更）
- SSE 生成器使用独立 DB session 避免生命周期问题
- ConfirmDialog 添加焦点陷阱、Escape 关闭、aria 属性

### 修复（IMPORTANT）
- CJK 文件名在上传时正确保留
- 所有列表接口支持光标分页
- olefile 加入显式依赖
- Sidebar loadKnowledgeBases 用 useCallback 优化
- CodeBlock clipboard 失败时显示错误
- 文档删除添加确认弹窗

### 新增
- 后端测试基础设施（pytest + 内存 SQLite）
- 前端测试基础设施（Jest + RTL）
- 3 个 Playwright E2E 测试
- 覆盖率从 0% 提升至 80%+
```

- [ ] **Step 2: 更新 README**

- 在 API 接口章节更新聊天接口为 POST
- 补充分页参数说明

- [ ] **Step 3: 更新版本号**

`backend/app/main.py`:
```python
app = FastAPI(title="AI 知识库助手", version="1.0.1", lifespan=lifespan)
```

`frontend/package.json`:
```json
"version": "1.0.1",
```

- [ ] **Step 4: Commit 并合并**

```bash
git add CHANGELOG.md README.md backend/app/main.py frontend/package.json
git commit -m "docs: 更新 CHANGELOG、README、版本号至 v1.0.1"

# 合并回 main
cd ..
cd ai-knowledge-base
git merge fix/code-review-issues --no-ff
git tag -a v1.0.1 -m "v1.0.1 - Code review 修复"
git push origin main
git push origin v1.0.1

# 清理 worktree
git worktree remove ../ai-knowledge-base-fix
```

---

## 成功标准验收

执行完所有任务后，运行验证：

```bash
# 后端
cd backend && source .venv/bin/activate && pytest --cov=app
# 期望: 覆盖率 ≥ 80%

# 前端
cd frontend && npm run test:coverage
# 期望: 覆盖率 ≥ 80%

# E2E
cd frontend && npm run test:e2e
# 期望: 3 个 spec 全部通过

# 最终代码审查
# 期望: Superpowers code-reviewer 无 CRITICAL/IMPORTANT 遗留
```
