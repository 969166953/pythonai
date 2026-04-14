# AI 知识库助手

## 项目概述

基于 RAG（检索增强生成）的 AI 知识库问答系统。用户可以创建知识库、上传文档、与知识库进行对话，系统会基于文档内容生成带来源引用的回答。

## 技术栈

### 后端
- **框架**: FastAPI (async)
- **数据库**: SQLAlchemy + SQLite (aiosqlite 异步驱动)
- **向量数据库**: ChromaDB (持久化存储, cosine 相似度)
- **LLM**: DeepSeek (OpenAI 兼容 API)
- **文档处理**: pypdf, python-docx, LangChain text splitter
- **配置**: Pydantic Settings + .env

### 前端
- **框架**: React 19 + TypeScript 6
- **构建**: Vite 8
- **样式**: Tailwind CSS 4 (自定义设计系统, oklch 色彩)
- **路由**: react-router-dom 7
- **图标**: lucide-react
- **Markdown**: react-markdown

## 项目结构

```
backend/
  app/
    main.py              # FastAPI 入口, CORS, 路由注册
    core/
      config.py          # Pydantic Settings (DeepSeek, DB, ChromaDB, RAG 参数)
      database.py        # SQLAlchemy async 引擎 + 会话工厂
    models/
      schemas.py         # 4 个 ORM 模型: KnowledgeBase, Document, Conversation, Message
    api/
      knowledge_bases.py # CRUD: GET/POST/DELETE /api/knowledge-bases
      documents.py       # 文档上传/删除, 后台异步处理
      conversations.py   # 对话列表/创建/消息历史
      chat.py            # SSE 流式聊天 GET /api/chat/stream
    services/
      rag.py             # 文档解析, 分块, ChromaDB 存储, 上下文检索, LLM 流式调用

frontend/
  src/
    App.tsx              # 路由 + 响应式布局 (桌面侧栏 + 移动端抽屉)
    pages/
      HomePage.tsx       # 首页 (动画背景, 功能卡片)
      KnowledgeBasePage.tsx  # 知识库详情 (文档/聊天 Tab)
    components/
      layout/            # Sidebar, MobileHeader
      chat/              # ChatView (流式消息, Markdown, 来源引用)
      knowledge-base/    # DocumentList (拖拽上传, 状态追踪)
      ui/                # Button, Input, EmptyState, Skeleton
    hooks/
      useMobileNav.ts    # 移动端导航状态
      useTheme.ts        # 明暗主题切换
    lib/
      api.ts             # API 客户端 + 类型定义
```

## API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET/POST/DELETE | /api/knowledge-bases | 知识库 CRUD |
| GET/POST/DELETE | /api/knowledge-bases/:kbId/documents | 文档管理 |
| GET/POST | /api/knowledge-bases/:kbId/conversations | 对话管理 |
| GET | /api/knowledge-bases/:kbId/conversations/:convId/messages | 消息历史 |
| GET | /api/chat/stream?message=&kb_id=&conversation_id= | SSE 流式聊天 |

## 数据流

1. 用户上传文档 -> 文件保存 -> 后台异步: 解析 -> 分块(500字符) -> ChromaDB 向量化
2. 用户提问 -> ChromaDB 语义检索(top 5) -> 构建 RAG prompt -> DeepSeek 流式生成 -> SSE 推送
3. 消息和来源引用持久化到 SQLite

## 开发命令

```bash
# 后端
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend && npm run dev

# Docker
docker-compose up
```

## 支持的文档格式

PDF, DOCX, DOC, TXT, Markdown

## 当前状态

核心功能已完成：知识库 CRUD、文档上传与处理、流式 RAG 对话、响应式 UI。
Git 仓库已初始化但尚无提交。
