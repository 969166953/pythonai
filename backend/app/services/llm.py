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
