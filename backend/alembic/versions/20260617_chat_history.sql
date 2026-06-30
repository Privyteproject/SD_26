-- Migration : historique des chats (chat_sessions / chat_messages)
-- NB : ce projet applique le schéma via SQLAlchemy `Base.metadata.create_all`
-- (pas d'Alembic configuré : ce dossier ne contient ni env.py ni alembic.ini).
-- Ce fichier documente le DDL pour portabilité / revue. Les tables sont déjà
-- créées automatiquement au démarrage du backend.

CREATE TABLE IF NOT EXISTS chat_sessions (
    id              VARCHAR(32) PRIMARY KEY,
    id_utilisateur  INTEGER NOT NULL REFERENCES utilisateur(id_utilisateur),
    title           VARCHAR(200) NOT NULL DEFAULT 'Nouvelle conversation',
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_chat_sessions_user ON chat_sessions(id_utilisateur);
CREATE INDEX IF NOT EXISTS ix_chat_sessions_deleted ON chat_sessions(is_deleted);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          VARCHAR(32) PRIMARY KEY,
    session_id  VARCHAR(32) NOT NULL REFERENCES chat_sessions(id),
    role        VARCHAR(20) NOT NULL,           -- 'user' | 'assistant'
    content     TEXT NOT NULL,
    mode        VARCHAR(20),                    -- 'rag' | 'general' | 'refusal'
    sources     JSONB,                          -- documents sources si RAG
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_chat_messages_session ON chat_messages(session_id);
