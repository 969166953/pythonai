# Code Review 修复 - 设计文档

**版本**: v1.0.1
**创建日期**: 2026-04-16
**状态**: Draft

## 背景

Superpowers code-reviewer 对项目现有代码进行审查，发现 4 个 CRITICAL 和 7 个 IMPORTANT 级别问题，且测试覆盖率为 0%。需要按 Superpowers TDD 规范修复所有问题并将覆盖率提升至 80%。

## 问题清单

### CRITICAL

| 编号 | 问题 | 位置 |
|------|------|------|
| C1 | 删除知识库不清理 ChromaDB 向量数据 | `knowledge_bases.py:104-111` |
| C2 | 聊天 SSE 使用 GET 但有数据库写操作 | `chat.py:17` |
| C3 | SSE 生成器使用已关闭的 DB session | `chat.py:22-89` |
| C4 | ConfirmDialog 缺焦点陷阱和 Escape 键处理 | `ConfirmDialog.tsx` |

### IMPORTANT

| 编号 | 问题 | 位置 |
|------|------|------|
| I1 | CJK 文件名过滤正则错误，中文字符被截断 | `documents.py:81-84` |
| I2 | 所有列表端点无分页 | 多处 |
| I3 | `olefile` 未加入 requirements.txt | 运行时错误 |
| I4 | Sidebar `loadKnowledgeBases` 未用 `useCallback` | `Sidebar.tsx:27-38` |
| I5 | CodeBlock clipboard 无错误处理 | `CodeBlock.tsx:37-41` |
| I6 | 文档删除无确认弹窗（知识库/对话有） | `DocumentList.tsx` |
| I7 | 聊天走 GET query 参数，长消息超 URL 限制 | 前端 |

## 决策摘要

| 项目 | 决定 | 理由 |
|------|------|------|
| 优先级 | 全部修复 + 测试达标 | 用户要求 |
| 覆盖率目标 | 80% | 项目规范 |
| SSE 协议 | GET → POST | 违反 HTTP 语义 |
| 分页方式 | 光标分页（created_at） | 实时数据体验更好 |
| 测试框架 | pytest + Jest + Playwright | 成熟度 |
| 数据隔离 | 内存 SQLite + 临时 ChromaDB | SQLite 原生支持 |
| 提交策略 | 每个问题一个提交 | 可回溯 |

## 架构

### 分支

单分支 `fix/code-review-issues`，所有修复在此分支完成，合并回 main。

### 测试基础设施

**后端** (`backend/tests/`):
```
tests/
├── conftest.py           # 共享 fixtures: 内存 SQLite、临时 ChromaDB、httpx client、fake embedding
├── unit/
│   ├── test_parser.py
│   ├── test_vector_store.py
│   ├── test_rag.py
│   └── test_filename.py
└── integration/
    ├── test_knowledge_bases_api.py
    ├── test_documents_api.py
    ├── test_conversations_api.py
    └── test_chat_api.py
```

**前端** (`frontend/src/__tests__/` + `frontend/tests/e2e/`):
```
src/__tests__/
├── hooks/
│   ├── useTheme.test.ts
│   └── useMobileNav.test.ts
├── lib/
│   └── api.test.ts
└── components/
    ├── Toast.test.tsx
    ├── ConfirmDialog.test.tsx
    ├── ErrorBoundary.test.tsx
    └── CodeBlock.test.tsx

tests/e2e/
├── kb-crud.spec.ts
├── document-upload.spec.ts
└── chat-flow.spec.ts
```

## 关键技术方案

### SSE session 生命周期（C3）

问题：`Depends(get_db)` 注入的 session 在请求返回时关闭，但 `StreamingResponse` 的生成器继续运行。

方案：生成器内部独立创建 session。

```python
@router.post("/stream")
async def chat_stream(req: ChatRequest):
    async with async_session() as db:
        conv = await db.get(ConversationModel, req.conversation_id)
        if not conv or conv.kb_id != req.kb_id:
            raise HTTPException(404, "对话不存在")
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
        history_rows = (
            await db.execute(
                select(MessageModel)
                .where(MessageModel.conversation_id == req.conversation_id)
                .order_by(MessageModel.created_at.asc())
            )
        ).scalars().all()
        history = [
            {"role": m.role, "content": m.content}
            for m in history_rows if m.id != user_msg_id
        ]

    async def generate():
        collected_content = []
        collected_sources = None
        async for chunk in stream_chat(req.kb_id, req.message, history=history):
            # 解析 chunk 收集 content 和 sources
            ...
            yield chunk
        async with async_session() as db:
            db.add(MessageModel(
                conversation_id=req.conversation_id,
                role="assistant",
                content="".join(collected_content),
                sources=json.dumps(collected_sources, ensure_ascii=False) if collected_sources else None,
            ))
            await db.commit()

    return StreamingResponse(generate(), media_type="text/event-stream", headers=...)
```

### SSE GET → POST（C2）

后端：`@router.post("/stream")`，接收 `ChatRequest` body。

```python
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    kb_id: str
    conversation_id: str
```

前端：放弃 `EventSource`，改用 `fetch` + `ReadableStream`。

```typescript
interface ChatEvent {
  type: 'token' | 'sources' | 'error' | 'done';
  content?: string;
  sources?: Array<{ filename: string; chunk: string }>;
}

async function* streamChat(
  req: ChatRequest,
  signal: AbortSignal
): AsyncGenerator<ChatEvent> {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) throw new Error('请求失败');

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
          yield JSON.parse(event.slice(6));
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

前端 `ChatView.tsx` 改用 `AbortController` 替代 `EventSource.close()`。

### 删除 KB 清理 ChromaDB（C1）

```python
# vector_store.py
async def delete_collection(kb_id: str) -> None:
    try:
        await asyncio.to_thread(
            chroma_client.delete_collection,
            name=f"kb_{kb_id}"
        )
    except Exception as e:
        logger.error("Failed to delete collection kb=%s: %s", kb_id, e)

# knowledge_bases.py
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

### ConfirmDialog 无障碍（C4）

```tsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function ConfirmDialog({ open, title, message, confirmText = '确认删除', onConfirm, onCancel }) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    cancelBtnRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previousFocusRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center"
         role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface-elevated rounded-lg shadow-lg p-6 w-[380px]">
        <h3 id="confirm-title">{title}</h3>
        <p>{message}</p>
        <div className="flex justify-end gap-2">
          <Button ref={cancelBtnRef} variant="secondary" onClick={onCancel}>取消</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
```

### 光标分页（I2）

统一响应格式：

```python
class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
```

查询模式：

```python
query = select(Model).order_by(Model.created_at.desc())
if cursor:
    cursor_dt = datetime.fromisoformat(cursor)
    query = query.where(Model.created_at < cursor_dt)
query = query.limit(limit + 1)

rows = (await db.execute(query)).scalars().all()
next_cursor = rows[-1].created_at.isoformat() if len(rows) > limit else None
items = rows[:limit]
```

默认 `limit=20`，上限 `100`。

### CJK 文件名修复（I1）

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

## TDD 执行顺序

| # | 任务 | 类型 |
|---|------|------|
| 0 | 测试基础设施搭建（conftest、fixtures、jest 配置） | 基础 |
| 1 | C3 SSE session 生命周期 | TDD |
| 2 | C2 SSE GET → POST（前后端） | TDD |
| 3 | C1 删除 KB 清理 ChromaDB | TDD |
| 4 | I3 olefile 加入依赖 | 简单修复 |
| 5 | I1 CJK 文件名修复 | TDD |
| 6 | I2 列表接口光标分页 | TDD |
| 7 | C4 ConfirmDialog 无障碍 | TDD |
| 8 | I4 Sidebar useCallback | TDD |
| 9 | I5 CodeBlock clipboard 错误处理 | TDD |
| 10 | I6 文档删除确认弹窗 | TDD |
| 11 | E2E 核心流程 | 测试 |

每个任务遵循：**写失败测试 → 运行测试确认 RED → 写最小实现 → 运行测试确认 GREEN → 重构 → 提交（测试+实现一起）**

## 测试覆盖清单

### 后端单元测试
- `test_parser.py` — 5 种格式解析、空文件、非法编码、未知后缀
- `test_vector_store.py` — ingest/retrieve/delete/get_chunks/delete_collection
- `test_rag.py` — build_prompt、history 截断、context 格式
- `test_filename.py` — sanitize_filename 各种输入

### 后端集成测试
- `test_knowledge_bases_api.py` — CRUD、分页、删除清理向量、输入校验
- `test_documents_api.py` — 上传（各格式/超大/不支持）、分页、删除
- `test_conversations_api.py` — CRUD、跨 KB 校验、messages 权限
- `test_chat_api.py` — POST SSE 流式、归属校验、错误事件、消息持久化

### 前端单元测试
- `useTheme.test.ts` — 初始主题、切换、持久化
- `useMobileNav.test.ts` — 响应式切换
- `api.test.ts` — request 错误处理、网络异常、streamChat
- `Toast.test.tsx` — 添加/自动消失/手动关闭
- `ConfirmDialog.test.tsx` — Escape、焦点管理、aria
- `ErrorBoundary.test.tsx` — 错误捕获、重置
- `CodeBlock.test.tsx` — clipboard 成功/失败、主题响应

### E2E（Playwright）
- `kb-crud.spec.ts` — 创建 → 编辑 → 删除知识库
- `document-upload.spec.ts` — 上传文档 → 处理 → 查看分块
- `chat-flow.spec.ts` — 新对话 → 发消息 → 流式回复 → 引用

## 风险点

| 风险 | 对策 |
|------|------|
| ChromaDB 测试慢 | 用 fake_embedding_fn 替代 SentenceTransformer |
| POST SSE 破坏已有功能 | 不保留旧 GET 端点，前端同步改造 |
| useCallback 引入死循环 | 每个修复先写测试验证不重复渲染 |
| E2E 依赖真实 LLM | E2E 中 mock `llm_client` 返回固定响应 |
| jest + Vite 配置复杂 | 用 ts-jest preset + babel-jest |

## 成功标准

- [ ] 4 个 CRITICAL 修复完且有对应测试
- [ ] 7 个 IMPORTANT 修复完且有对应测试
- [ ] 后端覆盖率 ≥ 80%（pytest --cov）
- [ ] 前端覆盖率 ≥ 80%（jest --coverage）
- [ ] 3 个核心 E2E 测试通过
- [ ] `superpowers:requesting-code-review` 最终审查无 CRITICAL/IMPORTANT 遗留
- [ ] CHANGELOG 更新到 v1.0.1
- [ ] README 更新分页 API 和 POST 聊天协议

## 变更的 API 规范（breaking changes）

### 聊天接口（破坏性变更）

旧：
```
GET /api/chat/stream?message=X&kb_id=Y&conversation_id=Z
```

新：
```
POST /api/chat/stream
Content-Type: application/json
{ "message": "X", "kb_id": "Y", "conversation_id": "Z" }
```

### 列表接口分页（新增可选参数）

所有列表接口添加可选查询参数：
- `cursor` — ISO 8601 时间戳，下一页起始位置
- `limit` — 每页数量，默认 20，最大 100

响应格式：
```json
{
  "items": [...],
  "next_cursor": "2026-04-15T10:00:00Z" | null
}
```

无 cursor 参数时返回第一页，保持与旧行为兼容。
