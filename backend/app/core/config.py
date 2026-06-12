"""Configuration de l'application, lue depuis l'environnement."""

import os


def _csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


class Settings:
    PROJECT_NAME: str = "Synapse Digital API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # --- Base de données ---
    # SQLite par défaut (zéro install) ; passer une URL Postgres en prod, ex.
    # postgresql+psycopg://user:pass@localhost:5432/synapse
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./synapse.db")
    # Sème des données de démo au démarrage si la base est vide.
    DB_SEED: bool = os.getenv("DB_SEED", "true").lower() == "true"

    # --- Keycloak ---
    KEYCLOAK_URL: str = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
    KEYCLOAK_REALM: str = os.getenv("KEYCLOAK_REALM", "ydays")
    KEYCLOAK_CLIENT_ID: str = os.getenv("KEYCLOAK_CLIENT_ID", "frontend-app")
    KEYCLOAK_ADMIN_USER: str = os.getenv("KEYCLOAK_ADMIN_USER", "superuser")
    KEYCLOAK_ADMIN_PASSWORD: str = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "superuser")
    AUTH_VERIFY_SIGNATURE: bool = os.getenv("AUTH_VERIFY_SIGNATURE", "false").lower() == "true"

    @property
    def JWKS_URL(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"

    @property
    def ISSUER(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}"

    # --- Assistant IA (OpenRouter, API compatible OpenAI) ---
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    # Modèle de réponse de l'agent et modèle « juge » (LLM-as-judge).
    AGENT_MODEL: str = os.getenv("AGENT_MODEL", "google/gemma-4-31b-it")
    JUDGE_MODEL: str = os.getenv("JUDGE_MODEL", "qwen/qwen3.6-27b")
    AI_MAX_TOKENS: int = int(os.getenv("AI_MAX_TOKENS", "1024"))
    # En-têtes optionnels d'attribution (recommandés par OpenRouter)
    OPENROUTER_SITE_URL: str = os.getenv("OPENROUTER_SITE_URL", "http://localhost:5173")
    OPENROUTER_APP_NAME: str = os.getenv("OPENROUTER_APP_NAME", "Synapse Digital")

    # --- Pipeline conversationnelle (RAG + garde-fous) ---
    FALLBACK_MODEL: str = os.getenv("FALLBACK_MODEL", "google/gemma-4-26b-a4b-it")
    RAG_ENABLED: bool = os.getenv("RAG_ENABLED", "true").lower() == "true"
    RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "4"))
    RAG_MIN_SCORE: float = float(os.getenv("RAG_MIN_SCORE", "0.05"))  # hash≈0.05 ; ST≈0.30
    # Backends RAG : auto -> ChromaDB/sentence-transformers si dispo, sinon mémoire/hash.
    RAG_VECTOR_BACKEND: str = os.getenv("RAG_VECTOR_BACKEND", "auto")   # auto|chroma|memory
    RAG_EMBED_BACKEND: str = os.getenv("RAG_EMBED_BACKEND", "auto")     # auto|st|openrouter|hash
    CHROMA_PATH: str = os.getenv("CHROMA_PATH", "./chroma")
    EMBED_MODEL_ST: str = os.getenv("EMBED_MODEL_ST", "sentence-transformers/all-MiniLM-L6-v2")
    EMBED_MODEL_OR: str = os.getenv("EMBED_MODEL_OR", "openai/text-embedding-3-small")
    EMBED_DIM_HASH: int = int(os.getenv("EMBED_DIM_HASH", "512"))
    PII_MASKING: bool = os.getenv("PII_MASKING", "true").lower() == "true"
    AUTO_JUDGE: bool = os.getenv("AUTO_JUDGE", "true").lower() == "true"
    JUDGE_MIN_NOTE: int = int(os.getenv("JUDGE_MIN_NOTE", "3"))
    RATE_LIMIT_PER_MIN: int = int(os.getenv("RATE_LIMIT_PER_MIN", "20"))

    # --- CORS (serveur Vite) ---
    CORS_ORIGINS: list[str] = _csv(os.getenv("CORS_ORIGINS", "http://localhost:5173"))


settings = Settings()
