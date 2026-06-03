from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "YDAYS 2026 HR AI Platform"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True

    # PostgreSQL
    POSTGRES_USER: str = "ydays_admin"
    POSTGRES_PASSWORD: str = "ydays_secret_pass"
    POSTGRES_DB: str = "ydays_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: str = "5432"
    DATABASE_URL: str = ""

    # Keycloak
    KEYCLOAK_URL: str = "http://localhost:8080"
    KEYCLOAK_REALM: str = "ydays-realm"
    KEYCLOAK_CLIENT_ID: str = "ydays-backend-client"
    JWT_ALGORITHM: str = "RS256"
    JWT_AUDIENCE: str = "account"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.DATABASE_URL:
            self.DATABASE_URL = f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
