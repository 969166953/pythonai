from pydantic_settings import BaseSettings
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"

    database_url: str = f"sqlite+aiosqlite:///{BACKEND_DIR / 'data' / 'app.db'}"
    chroma_persist_dir: str = str(BACKEND_DIR / "data" / "chroma")
    upload_dir: str = str(BACKEND_DIR / "data" / "uploads")

    chunk_size: int = 800
    chunk_overlap: int = 100
    top_k: int = 5

    embedding_model: str = "all-MiniLM-L6-v2"

    max_upload_bytes: int = 50 * 1024 * 1024  # 50MB
    allowed_origins: str = "http://localhost:3000"

    # TODO: 用户认证 — 取消注释启用 JWT
    # jwt_secret: str = ""
    # jwt_expire_minutes: int = 60 * 24 * 7  # 7天

    # TODO: Redis 缓存 — 用于会话管理和速率限制
    # redis_url: str = "redis://localhost:6379/0"

    # TODO: 对象存储 — 替换本地文件存储
    # s3_bucket: str = ""
    # s3_endpoint: str = ""
    # s3_access_key: str = ""
    # s3_secret_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()

DATA_DIR = BACKEND_DIR / "data"
UPLOAD_DIR = Path(settings.upload_dir)
DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
