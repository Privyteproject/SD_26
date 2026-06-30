"""Configuration pytest : environnement de test hermétique + fixtures partagées.

- Base SQLite ISOLÉE (jamais la base Postgres de dev) ；
- IA en mode démo déterministe (aucun appel réseau : OPENROUTER vide, RAG hash/mémoire) ；
- couche 2 anti-injection (llm-guard/torch) désactivée — la couche 1 regex reste testée ；
- jeu de démo déterministe (advanced_seed : 120 employés, comptes @waminey.ma).

L'environnement est positionné AVANT tout import de l'application (settings lit l'env à l'import).
"""

import os
import tempfile

# ── Environnement de test (doit précéder l'import de app.*) ──
_DB_PATH = os.path.join(tempfile.gettempdir(), "synapse_test.db")
if os.path.exists(_DB_PATH):
    os.remove(_DB_PATH)

os.environ.update({
    "DATABASE_URL": f"sqlite:///{_DB_PATH}",
    "APP_ENV": "development",        # dev-login autorisé (jetons de démo non signés par Keycloak)
    "OPENROUTER_API_KEY": "",        # LLM en mode démo déterministe (offline)
    "RAG_VECTOR_BACKEND": "memory",  # pas de ChromaDB
    "RAG_EMBED_BACKEND": "hash",     # pas de sentence-transformers/torch
    "LLMGUARD_ENABLED": "false",     # pas de deberta/torch (couche 1 regex testée)
    "CACHE_ENABLED": "false",        # pas de Redis requis ; évite la pollution inter-tests
    "SEED_MODE": "demo",             # jeu déterministe (advanced_seed)
    "DB_SEED": "true",
})

import pytest
from fastapi.testclient import TestClient
from jose import jwt


@pytest.fixture(scope="session")
def client():
    """Client de test FastAPI. Le `with` déclenche le lifespan -> init_db + seed démo déterministe."""
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    """Session SQLAlchemy directe (tests unitaires repository/services)."""
    from app.db.base import SessionLocal
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def _hdr(roles, email, name="Test"):
    tok = jwt.encode({"sub": f"dev-{email}", "email": email, "name": name,
                      "realm_access": {"roles": roles}}, "dev", algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


# ── Comptes de démo RÉELS semés par advanced_seed (@waminey.ma) ──
@pytest.fixture(scope="session")
def collab():
    return _hdr(["collaborateur"], "collaborateur@waminey.ma", "Hamza Cherkaoui")  # = DEMO_COL


@pytest.fixture(scope="session")
def collab_out():
    return _hdr(["collaborateur"], "depart@waminey.ma", "Lina Haddad")  # = DEMO_OUT


@pytest.fixture(scope="session")
def manager():
    return _hdr(["manager"], "manager@waminey.ma", "Sofia Alami")  # = DEMO_MGR (équipe Produit & Dév.)


@pytest.fixture(scope="session")
def rh():
    return _hdr(["rh"], "rh@waminey.ma", "Karim Benali")  # = DEMO_RH


@pytest.fixture(scope="session")
def direction():
    return _hdr(["direction"], "direction@waminey.ma", "Nadia Benjelloun")  # = DEMO_DIR


@pytest.fixture(scope="session")
def medecine():
    return _hdr(["medecine"], "medecine@waminey.ma", "Yasmine Saidi")  # = DEMO_MED


@pytest.fixture(scope="session")
def admin():
    return _hdr(["admin"], "admin@waminey.ma", "Mohammed El Idrissi")  # = DEMO_ADMIN


@pytest.fixture
def chat(client):
    """Helper : chat(headers, message) -> (status_code, data) où data = {reply, meta, ...}."""
    def _chat(headers, message, **extra):
        r = client.post("/api/v1/ai/chat", headers=headers, json={"message": message, **extra})
        body = r.json()
        return r.status_code, body.get("data", body)
    return _chat
