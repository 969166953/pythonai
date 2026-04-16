# AI 知识库助手

基于 RAG（检索增强生成）技术的智能文档问答系统。上传文档，构建专属知识库，AI 基于文档内容精准回答你的问题。

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![FastAPI](https://img.shields.io/badge/FastAPI-0.135+-009688)
![License](https://img.shields.io/badge/License-MIT-green)

## 功能特性

- **文档管理** — 支持 PDF、Word (DOCX/DOC)、TXT、Markdown 格式上传，拖拽上传
- **智能解析** — 自动分块、向量化存储，支持中英文语义检索
- **多轮对话** — 基于上下文的连续问答，AI 记住对话历史（最近 10 轮）
- **来源引用** — 回答附带原文引用，点击展开完整内容
- **流式输出** — SSE 实时流式响应，打字机效果
- **文档预览** — 点击已处理文档查看分块详情
- **对话管理** — 对话重命名、删除，知识库名称和描述编辑
- **暗色主题** — 亮色/暗色切换，跟随系统偏好，localStorage 持久化
- **代码高亮** — Markdown 代码块语法着色，一键复制
- **操作反馈** — Toast 通知、删除确认弹窗、错误边界防白屏
- **响应式 UI** — 桌面侧栏 + 移动端抽屉，适配各种屏幕
- **Docker 部署** — docker-compose 一键启动

## 技术栈

### 后端

| 技术 | 用途 |
|------|------|
| FastAPI | 异步 Web 框架 |
| SQLAlchemy + SQLite | 数据持久化 (aiosqlite 异步驱动) |
| ChromaDB | 向量数据库 (cosine 相似度检索) |
| SentenceTransformer | 文本向量化 (all-MiniLM-L6-v2) |
| DeepSeek API | LLM 大语言模型 (OpenAI 兼容，可切换) |
| LangChain | 文本分块 |

### 前端

| 技术 | 用途 |
|------|------|
| React 19 + TypeScript | UI 框架 |
| Vite 8 | 构建工具 |
| Tailwind CSS 4 | 样式 (oklch 色彩系统) |
| react-markdown | Markdown 渲染 |
| react-syntax-highlighter | 代码语法高亮 |
| lucide-react | 图标库 |

## 快速开始

### 前置要求

- Python 3.10+
- Node.js 18+
- DeepSeek API Key ([获取地址](https://platform.deepseek.com/))

### 1. 克隆项目

```bash
git clone https://github.com/969166953/pythonai.git
cd pythonai
```

### 2. 启动后端

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 DeepSeek API Key

# 启动服务（首次启动会下载 Embedding 模型约 90MB）
uvicorn app.main:app --reload --port 8000
```

### 3. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 开始使用。

### Docker 启动（可选）

```bash
# 1. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 DeepSeek API Key

# 2. 构建并启动
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 停止服务
docker-compose down
```

### 内网部署（生产环境）

适用于公司内网、无外网环境部署：

```bash
# 1. 配置环境变量
cp backend/.env.example backend/.env
vim backend/.env
# 修改 ALLOWED_ORIGINS 为内网 IP，如 http://192.168.1.100
# 如果内网无法访问 DeepSeek，可改用本地 Ollama:
#   DEEPSEEK_BASE_URL=http://192.168.1.50:11434/v1
#   DEEPSEEK_MODEL=qwen2.5

# 2. 一键启动生产环境
docker-compose -f docker-compose.prod.yml up -d --build

# 3. 访问（直接用服务器 IP）
# http://192.168.1.100
```

内网部署架构：
```
用户浏览器 → Nginx (:80)
                ├── /          → 前端静态文件
                └── /api/*     → 后端 FastAPI (:8000)
```

> 如果内网无法下载 Embedding 模型，可先在有网络的机器上运行一次，
> 然后把 `backend/data/` 目录整体拷贝到目标服务器。

## 使用流程

1. **创建知识库** — 在左侧栏点击「新建知识库」
2. **上传文档** — 进入知识库，拖拽或点击上传文档
3. **等待处理** — 系统自动解析、分块、向量化（状态变为 ✓ 即就绪）
4. **开始对话** — 切换到「对话」标签，新建对话，提出问题
5. **查看引用** — AI 回答下方会显示引用的原文来源

## 项目结构

```
backend/
  app/
    main.py                 # FastAPI 入口，中间件，路由注册
    core/
      config.py             # 配置中心，所有参数环境变量驱动
      database.py           # SQLAlchemy 异步引擎
      deps.py               # 依赖注入（认证扩展点）
    models/
      schemas.py            # ORM 模型
    api/
      knowledge_bases.py    # 知识库 CRUD
      documents.py          # 文档上传、预览、删除
      conversations.py      # 对话管理
      chat.py               # SSE 流式聊天
    services/
      rag.py                # RAG 编排层
      parser.py             # 文档解析（扩展新格式）
      vector_store.py       # 向量存储（可替换实现）
      llm.py                # LLM 客户端（可切换提供商）

frontend/
  src/
    App.tsx                 # 路由、主题、布局
    pages/                  # 首页、知识库详情页
    components/
      chat/                 # 聊天视图、代码高亮
      knowledge-base/       # 文档列表
      layout/               # 侧栏、移动端头部
      ui/                   # 通用组件（按钮、Toast、弹窗等）
    hooks/                  # 主题、移动端导航
    lib/api.ts              # API 客户端
```

## API 接口

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET/POST/PATCH/DELETE | `/api/knowledge-bases` | 知识库 CRUD |
| GET/POST/DELETE | `/api/knowledge-bases/:kbId/documents` | 文档管理 |
| GET | `/api/knowledge-bases/:kbId/documents/:docId/chunks` | 文档分块预览 |
| GET/POST/PATCH/DELETE | `/api/knowledge-bases/:kbId/conversations` | 对话管理 |
| GET | `/api/knowledge-bases/:kbId/conversations/:convId/messages` | 消息历史 |
| GET | `/api/chat/stream` | SSE 流式聊天 |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | (必填) |
| `DEEPSEEK_BASE_URL` | API 基础地址 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 模型名称 | `deepseek-chat` |
| `EMBEDDING_MODEL` | 向量化模型 | `all-MiniLM-L6-v2` |
| `CHUNK_SIZE` | 文档分块大小 | `800` |
| `CHUNK_OVERLAP` | 分块重叠长度 | `100` |
| `TOP_K` | 检索返回数量 | `5` |
| `MAX_UPLOAD_BYTES` | 上传文件大小限制 | `52428800` (50MB) |
| `ALLOWED_ORIGINS` | CORS 允许的域名 | `http://localhost:3000` |

## 切换 LLM 提供商

项目兼容所有 OpenAI 格式的 API，修改 `.env` 即可切换：

```bash
# OpenAI
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.openai.com/v1
DEEPSEEK_MODEL=gpt-4o

# 通义千问
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DEEPSEEK_MODEL=qwen-plus

# 本地 Ollama
DEEPSEEK_API_KEY=ollama
DEEPSEEK_BASE_URL=http://localhost:11434/v1
DEEPSEEK_MODEL=qwen2.5
```

## License

MIT
