# AI 知识库助手

基于 RAG（检索增强生成）技术的智能文档问答系统。上传文档，构建专属知识库，AI 基于文档内容精准回答你的问题。

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![FastAPI](https://img.shields.io/badge/FastAPI-0.135+-009688)
![License](https://img.shields.io/badge/License-MIT-green)

## 功能特性

- **文档管理** — 支持 PDF、Word (DOCX/DOC)、TXT、Markdown 格式上传
- **智能解析** — 自动分块、向量化存储，支持中英文
- **多轮对话** — 基于上下文的连续问答，AI 记住对话历史
- **来源引用** — 回答附带原文引用，可溯源验证
- **流式输出** — SSE 实时流式响应，打字机效果
- **响应式 UI** — 桌面侧栏 + 移动端抽屉，适配各种屏幕

## 技术栈

### 后端

| 技术 | 用途 |
|------|------|
| FastAPI | 异步 Web 框架 |
| SQLAlchemy + SQLite | 数据持久化 (aiosqlite 异步驱动) |
| ChromaDB | 向量数据库 (cosine 相似度检索) |
| DeepSeek API | LLM 大语言模型 (OpenAI 兼容) |
| LangChain | 文本分块 |

### 前端

| 技术 | 用途 |
|------|------|
| React 19 + TypeScript | UI 框架 |
| Vite 8 | 构建工具 |
| Tailwind CSS 4 | 样式 (oklch 色彩系统) |
| react-markdown | Markdown 渲染 |
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

# 启动服务
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
# 先配置 backend/.env
docker-compose up
```

## 使用流程

1. **创建知识库** — 在左侧栏点击「新建知识库」
2. **上传文档** — 进入知识库，拖拽或点击上传文档
3. **等待处理** — 系统自动解析、分块、向量化（状态变为 ✓ 即就绪）
4. **开始对话** — 切换到「对话」标签，新建对话，提出问题
5. **查看引用** — AI 回答下方会显示引用的原文来源

## API 接口

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET/POST/DELETE | `/api/knowledge-bases` | 知识库 CRUD |
| GET/POST/DELETE | `/api/knowledge-bases/:kbId/documents` | 文档管理 |
| GET/POST | `/api/knowledge-bases/:kbId/conversations` | 对话管理 |
| GET | `/api/knowledge-bases/:kbId/conversations/:convId/messages` | 消息历史 |
| GET | `/api/chat/stream` | SSE 流式聊天 |

## 项目结构

```
backend/
  app/
    main.py              # FastAPI 入口
    core/                # 配置、数据库
    models/              # ORM 模型
    api/                 # 路由端点
    services/            # RAG 核心服务

frontend/
  src/
    pages/               # 页面组件
    components/          # UI 组件
    hooks/               # 自定义 Hooks
    lib/                 # API 客户端
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | (必填) |
| `DEEPSEEK_BASE_URL` | API 基础地址 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 模型名称 | `deepseek-chat` |

## License

MIT
