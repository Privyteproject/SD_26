from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
ROOT_ENV_FILE = BACKEND_DIR.parent / ".env"
BACKEND_ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_ENV_FILE), str(ROOT_ENV_FILE)),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "YDAYS_IA_RH"
    APP_ENV: str = "dev"

    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL_RH: str = "mistralai/mistral-small-24b-instruct-2501"
    OPENROUTER_MODEL_GENERAL: str = "mistralai/mistral-small-24b-instruct-2501"
    OPENROUTER_MODEL_CLASSIFIER: str = "mistralai/mistral-small-24b-instruct-2501"
    OPENROUTER_SITE_URL: str = "http://localhost:3000"
    OPENROUTER_APP_NAME: str = "YDAYS IA RH"

    CHROMA_PERSIST_DIR: str = "./data/chroma"
    CHROMA_COLLECTION_NAME: str = "rh_documents"
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    RAG_TOP_K: int = 5
    RAG_MIN_CONFIDENCE: float = Field(default=0.60, ge=0.0, le=1.0)

    ENABLE_AUDIT_LOGS: bool = True
    ENABLE_SECURITY_FILTER: bool = True
    ENABLE_RBAC: bool = True

    @property
    def chroma_persist_path(self) -> Path:
        path = Path(self.CHROMA_PERSIST_DIR)
        if path.is_absolute():
            return path
        return BACKEND_DIR / path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
