"""
LLM 客户端模块 — 后续切换模型提供商在这里改。

支持所有 OpenAI 兼容的 API:
- DeepSeek
- OpenAI
- 通义千问 (DashScope)
- 本地 Ollama

只需修改 .env 中的 DEEPSEEK_BASE_URL 和 DEEPSEEK_MODEL 即可切换。
如需更复杂的多模型路由，在此文件扩展 get_llm_client() 工厂函数。
"""

import logging

from openai import AsyncOpenAI

from ..core.config import settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def get_llm_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )
    return _client


# TODO: 多模型路由 — 根据任务类型选择不同模型
# def get_llm_client_for(task: str = "chat") -> AsyncOpenAI:
#     """
#     task 类型:
#       - "chat": 对话生成，用主模型
#       - "summary": 摘要提取，可用轻量模型降低成本
#       - "embedding": 文本向量化，用 embedding 专用模型
#     """
#     configs = {
#         "chat": {"api_key": settings.deepseek_api_key, "base_url": settings.deepseek_base_url},
#         "summary": {"api_key": settings.deepseek_api_key, "base_url": settings.deepseek_base_url},
#     }
#     cfg = configs.get(task, configs["chat"])
#     return AsyncOpenAI(**cfg)
