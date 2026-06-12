"""Sécurité : authentification Keycloak (JWT) + contrôle d'accès par rôle.

Le mapping rôles realm Keycloak -> rôles applicatifs reproduit EXACTEMENT
celui du front (`frontend/src/lib/tokens.js`), y compris l'ordre de priorité,
afin que le rôle calculé côté back soit identique à celui affiché côté front.
"""

from dataclasses import dataclass, field
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError

from app.core.config import settings

# --- Rôles applicatifs (cf. front lib/constants.js) ---
ROLE_COLLABORATEUR = "COLLABORATEUR"
ROLE_MANAGER = "MANAGER"
ROLE_RH = "RH"
ROLE_DIRECTION = "DIRECTION"
ROLE_ADMIN = "ADMIN"
ROLE_MEDECINE = "MEDECINE"

RH_SPACE_ROLES = {ROLE_MANAGER, ROLE_RH, ROLE_DIRECTION, ROLE_MEDECINE}

# realm Keycloak (minuscules) -> rôle applicatif  (cf. front lib/tokens.js)
_REALM_TO_APP = {
    "admin": ROLE_ADMIN,
    "rh": ROLE_RH,
    "manager": ROLE_MANAGER,
    "direction": ROLE_DIRECTION,
    "medecine": ROLE_MEDECINE,
    "collaborateur": ROLE_COLLABORATEUR,
}
# Ordre de priorité identique au front
_PRIORITY = [ROLE_ADMIN, ROLE_DIRECTION, ROLE_RH, ROLE_MANAGER, ROLE_MEDECINE, ROLE_COLLABORATEUR]

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    sub: str
    email: str
    name: str
    role: str
    realm_roles: list[str] = field(default_factory=list)
    claims: dict = field(default_factory=dict)


def app_role_from_realm_roles(realm_roles: list[str]) -> str:
    """Réduit la liste des rôles realm au rôle applicatif prioritaire."""
    app_roles = {_REALM_TO_APP[r.lower()] for r in realm_roles if r.lower() in _REALM_TO_APP}
    for r in _PRIORITY:
        if r in app_roles:
            return r
    return ROLE_COLLABORATEUR


@lru_cache(maxsize=1)
def _jwks() -> dict:
    """Récupère (et met en cache) le JWKS du realm pour vérifier la signature."""
    import urllib.request
    import json

    with urllib.request.urlopen(settings.JWKS_URL, timeout=5) as resp:  # noqa: S310
        return json.loads(resp.read().decode("utf-8"))


def _decode(token: str) -> dict:
    """Décode le JWT. Vérifie la signature en prod, la zappe en dev/démo."""
    if not settings.AUTH_VERIFY_SIGNATURE:
        # Mode dev/démo : on fait confiance au token (la vraie vérif est en prod).
        return jwt.get_unverified_claims(token)

    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    key = next((k for k in _jwks().get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        raise JWTError("clé de signature introuvable dans le JWKS")
    return jwt.decode(
        token,
        key,
        algorithms=[key.get("alg", "RS256")],
        issuer=settings.ISSUER,
        options={"verify_aud": False},  # Keycloak met souvent aud=account
    )


def _build_user(claims: dict) -> CurrentUser:
    realm_roles = (claims.get("realm_access") or {}).get("roles") or []
    name = claims.get("name") or " ".join(
        v for v in (claims.get("given_name"), claims.get("family_name")) if v
    ).strip() or claims.get("preferred_username") or claims.get("email") or "Utilisateur"
    return CurrentUser(
        sub=claims.get("sub", ""),
        email=claims.get("email", ""),
        name=name,
        role=app_role_from_realm_roles(realm_roles),
        realm_roles=realm_roles,
        claims=claims,
    )


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    """Dépendance FastAPI : exige un Bearer valide et renvoie l'utilisateur courant."""
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = _decode(creds.credentials)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return _build_user(claims)


def require_roles(*roles: str):
    """Fabrique une dépendance qui n'autorise que les rôles indiqués.

    Renvoie 403 (le front affiche alors un toast « Accès non autorisé »).
    """
    allowed = set(roles)

    async def _guard(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès non autorisé",
            )
        return user

    return _guard
