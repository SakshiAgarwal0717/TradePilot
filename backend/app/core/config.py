import json
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "TradePilot"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    DATABASE_URL: str = "sqlite:///./tradepilot.db"
    SECRET_KEY: str = "temporary-secret-key-tradepilot-auth-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    COOKIE_NAME: str = "tradepilot_token"
    COOKIE_SECURE: bool = False  # Set to True in production HTTPS
    COOKIE_SAMESITE: str = "lax"

    # AI Review Assistant Settings
    OPENROUTER_API_KEY: Union[str, None] = None
    GEMINI_API_KEY: Union[str, None] = None
    AI_PROVIDER_DEFAULT: str = "openrouter"  # 'openrouter' or 'gemini'
    AI_MODEL_NAME: str = "meta-llama/llama-3.3-70b-instruct"
    GEMINI_MODEL_NAME: str = "gemini-2.0-flash"
    AI_REQUEST_TIMEOUT_SECONDS: float = 30.0

    @field_validator("AI_PROVIDER_DEFAULT")
    @classmethod
    def validate_ai_provider(cls, v: str) -> str:
        normalized = v.strip().lower()
        if normalized not in ("openrouter", "gemini"):
            raise ValueError(
                f"Unsupported AI_PROVIDER_DEFAULT '{v}'. Must be one of: 'openrouter', 'gemini'."
            )
        return normalized

    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str) and v.startswith("["):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed]
            except Exception:
                pass
        return v if isinstance(v, list) else []

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
