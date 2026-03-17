import binascii
from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache
from cryptography.fernet import Fernet

class Settings(BaseSettings):
    SECRET_KEY: str
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    ENCRYPTION_KEY: str  # Fernet key (base64-encoded 32 bytes)
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    APP_VERSION: str = "0.5.0"
    COOKIE_SECURE: bool = False  # Set True in production (HTTPS only)
    RATE_LIMIT_LOGIN: str = "10/minute"

    @field_validator("ENCRYPTION_KEY")
    @classmethod
    def validate_encryption_key(cls, v: str) -> str:
        try:
            Fernet(v.encode())
        except (ValueError, binascii.Error) as exc:
            raise ValueError(
                "Invalid ENCRYPTION_KEY: must be a URL-safe base64-encoded 32-byte Fernet key. "
                f"Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\". "
                f"Error: {exc}"
            ) from exc
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
