"""
共享依赖注入 — 认证、权限等中间件在这里扩展。

后续添加用户认证时，在此文件添加:
  async def get_current_user(...) -> User:
      ...
然后在路由中使用 Depends(get_current_user)
"""

from ..core.database import get_db

__all__ = ["get_db"]
