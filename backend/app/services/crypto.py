"""Chiffrement symétrique au repos des données sensibles (logs IA).

Conformité §3.3 / §4.4 : les prompts/réponses des échanges IA sont chiffrés en base
(Fernet/AES). La clé est dérivée d'un secret (SHA-256 → base64 urlsafe 32 octets).

Repli TRANSPARENT : si `cryptography` est absent, ou si une valeur n'est pas chiffrée
(anciens enregistrements en clair), on renvoie la valeur telle quelle. Le préfixe
`enc:v1:` permet de reconnaître ce qui est chiffré et de déchiffrer sans casser l'existant.
"""

import base64
import hashlib

from app.core.config import settings

_PREFIX = "enc:v1:"
_fernet = None  # None = non initialisé ; False = indisponible ; objet = prêt


def _get():
    global _fernet
    if _fernet is not None:
        return _fernet
    try:
        from cryptography.fernet import Fernet
        key = base64.urlsafe_b64encode(
            hashlib.sha256(settings.LOG_ENCRYPTION_SECRET.encode()).digest())
        _fernet = Fernet(key)
    except Exception:
        _fernet = False
    return _fernet


def encrypt(text):
    """Chiffre une chaîne (renvoie un jeton préfixé). None et repli laissés tels quels."""
    if text is None:
        return None
    f = _get()
    if not f:
        return text
    try:
        return _PREFIX + f.encrypt(text.encode("utf-8")).decode("ascii")
    except Exception:
        return text


def decrypt(text):
    """Déchiffre un jeton préfixé. Toute valeur non chiffrée est renvoyée telle quelle."""
    if not text or not isinstance(text, str) or not text.startswith(_PREFIX):
        return text
    f = _get()
    if not f:
        return text
    try:
        return f.decrypt(text[len(_PREFIX):].encode("ascii")).decode("utf-8")
    except Exception:
        return text
