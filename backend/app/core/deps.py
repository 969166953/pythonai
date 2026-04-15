"""
共享依赖注入。

后续在这里扩展:
- 用户认证 (get_current_user)
- 速率限制 (rate_limiter)
- 权限校验 (require_permission)
"""

from ..core.database import get_db

__all__ = ["get_db"]


# TODO: 用户认证依赖 — 启用时取消注释
# from fastapi import Depends, HTTPException, status
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# import jwt
# from ..core.config import settings
# from ..models.schemas import UserModel
#
# security = HTTPBearer()
#
# async def get_current_user(
#     credentials: HTTPAuthorizationCredentials = Depends(security),
#     db = Depends(get_db),
# ) -> UserModel:
#     try:
#         payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
#         user = await db.get(UserModel, payload["sub"])
#         if not user:
#             raise HTTPException(status_code=401, detail="用户不存在")
#         return user
#     except jwt.PyJWTError:
#         raise HTTPException(status_code=401, detail="无效的认证凭据")


# TODO: 速率限制依赖 — 配合 Redis 使用
# from slowapi import Limiter
# from slowapi.util import get_remote_address
# limiter = Limiter(key_func=get_remote_address)
