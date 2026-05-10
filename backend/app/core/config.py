from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "Plataforma de Análisis Estadístico Académico"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "production", "testing"] = "production"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: PostgresDsn
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    REDIS_URL: RedisDsn

    JWT_SECRET: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7

    ALLOWED_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost",
        "http://localhost:5173",
    ]

    INITIAL_ADMIN_EMAIL: str = "admin@universidad.edu"
    INITIAL_ADMIN_PASSWORD: str = ""

    UPLOAD_MAX_SIZE_MB: int = 200
    UPLOAD_DIR: str = "/data/uploads"

    RATE_LIMIT_PER_MINUTE: int = 120

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v: object) -> list[str]:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        if isinstance(v, list):
            return v
        return []

    @property
    def database_url_str(self) -> str:
        return str(self.DATABASE_URL)

    @property
    def redis_url_str(self) -> str:
        return str(self.REDIS_URL)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
