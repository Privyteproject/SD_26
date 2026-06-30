"""Stockage objet (MinIO) pour les documents RH.

- Upload via l'endpoint INTERNE (ex. minio:9000) ;
- Pre-signed URL via l'endpoint PUBLIC (ex. localhost:9000) afin que le lien soit
  joignable depuis le navigateur (la signature inclut l'hôte).

Le client `minio` est importé paresseusement. Si MinIO est indisponible (paquet
absent ou serveur injoignable), les fonctions renvoient False/None : l'appelant
retombe alors sur un stockage en base (`document.contenu`) + l'endpoint de
téléchargement applicatif. L'application reste fonctionnelle dans tous les cas.
"""

import io
from datetime import timedelta

from app.core.config import settings

_client = None
_public = None
_init_done = False


def _make_client(endpoint):
    from minio import Minio  # import paresseux

    # region fixée : évite un appel réseau get_bucket_location lors de la signature
    # (le client public pointe sur un hôte non joignable depuis le conteneur).
    return Minio(endpoint, access_key=settings.MINIO_ACCESS_KEY,
                 secret_key=settings.MINIO_SECRET_KEY, secure=settings.MINIO_SECURE,
                 region="us-east-1")


def _get():
    """Client interne (upload). Crée le bucket au besoin. None si indisponible."""
    global _client, _public, _init_done
    if _init_done:
        return _client
    _init_done = True
    try:
        _client = _make_client(settings.MINIO_ENDPOINT)
        if not _client.bucket_exists(settings.MINIO_BUCKET):
            _client.make_bucket(settings.MINIO_BUCKET)
        _public = _make_client(settings.MINIO_PUBLIC_ENDPOINT)
    except Exception:
        _client = None
        _public = None
    return _client


def available() -> bool:
    return _get() is not None


def put_bytes(object_name: str, data: bytes, content_type: str = "text/plain; charset=utf-8") -> bool:
    c = _get()
    if c is None:
        return False
    try:
        c.put_object(settings.MINIO_BUCKET, object_name, io.BytesIO(data),
                     length=len(data), content_type=content_type)
        return True
    except Exception:
        return False


def get_bytes(object_name: str) -> bytes | None:
    c = _get()
    if c is None:
        return None
    try:
        response = c.get_object(settings.MINIO_BUCKET, object_name)
        data = response.read()
        response.close()
        response.release_conn()
        return data
    except Exception:
        return None


def presigned_get(object_name: str, expires_seconds: int | None = None) -> str | None:
    """URL de téléchargement signée (via l'endpoint public), valable `expires_seconds`."""
    import os
    if _get() is None or _public is None:
        return None
    try:
        filename = os.path.basename(object_name)
        return _public.presigned_get_object(
            settings.MINIO_BUCKET, object_name,
            expires=timedelta(seconds=expires_seconds or settings.DOC_DOWNLOAD_TTL),
            response_headers={
                "response-content-disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception:
        return None


def get_bytes(object_name: str) -> bytes | None:
    """Récupère le contenu binaire d'un fichier dans le stockage MinIO."""
    c = _get()
    if c is None:
        return None
    try:
        response = c.get_object(settings.MINIO_BUCKET, object_name)
        return response.read()
    except Exception:
        return None
    finally:
        if "response" in locals():
            response.close()
            response.release_conn()
