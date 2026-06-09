"""Keycloak JWT authentication and RBAC dependencies for FastAPI.

This module provides:
- JWT token validation against Keycloak's JWKS endpoint (RS256).
- Auto-provisioning of local User records on first login.
- FastAPI dependencies: get_current_user, get_current_active_user, require_role.

Usage in endpoints:
    @router.get("/protected")
    def protected(user: User = Depends(get_current_active_user)):
        ...

    @router.get("/rh-only")
    def rh_only(user: User = Depends(require_role("rh", "admin"))):
        ...
"""

import logging
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# JWKS client (caches public keys automatically with a 5-minute lifespan)
# ---------------------------------------------------------------------------

_JWKS_URL = (
    f"{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}"
    "/protocol/openid-connect/certs"
)

_jwks_client = PyJWKClient(_JWKS_URL, cache_keys=True, lifespan=300)

# ---------------------------------------------------------------------------
# Bearer token extraction
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(
    scheme_name="Keycloak JWT",
    description="Provide a valid Keycloak Bearer token",
    auto_error=True,
)

# ---------------------------------------------------------------------------
# Role mapping from Keycloak realm_access.roles to local UserRole
# ---------------------------------------------------------------------------

_KEYCLOAK_ROLE_MAP: dict[str, str] = {
    "collaborateur": "collaborateur",
    "manager": "manager",
    "rh": "rh",
    "direction": "direction",
    "admin": "admin",
}

_DEFAULT_ROLE = "collaborateur"


def _resolve_role(realm_roles: list[str]) -> str:
    """Map Keycloak realm roles to the local RBAC role.

    Priority: admin > rh > direction > manager > collaborateur.
    The highest-privilege matching role wins.
    """
    priority = ["admin", "rh", "direction", "manager", "collaborateur"]
    for role in priority:
        if role in realm_roles:
            return _KEYCLOAK_ROLE_MAP[role]
    return _DEFAULT_ROLE


# ---------------------------------------------------------------------------
# Token decoding
# ---------------------------------------------------------------------------

def _decode_token(token: str) -> dict[str, Any]:
    """Validate and decode a Keycloak JWT using the JWKS endpoint.

    Raises HTTPException 401 on any validation failure.
    """
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload: dict[str, Any] = jwt.decode(
            token,
            signing_key.key,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            options={"verify_exp": True},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# User resolution (lookup or auto-provision)
# ---------------------------------------------------------------------------

def _get_or_create_user(db: Session, payload: dict[str, Any]) -> User:
    """Look up the local user by keycloak_sub; create one if first login.

    This enables seamless onboarding: once a user exists in Keycloak and
    receives a token, the platform auto-provisions their local record.
    """
    keycloak_sub: str = payload.get("sub", "")
    if not keycloak_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim",
        )

    user = db.query(User).filter(User.keycloak_sub == keycloak_sub).first()

    if user is not None:
        return user

    # Auto-provision on first login
    email = payload.get("email", "")
    realm_roles = payload.get("realm_access", {}).get("roles", [])
    role = _resolve_role(realm_roles)

    logger.info(
        "Auto-provisioning new user: sub=%s, email=%s, role=%s",
        keycloak_sub,
        email,
        role,
    )

    user = User(
        keycloak_sub=keycloak_sub,
        email=email,
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decode the Bearer token and return the corresponding local User.

    If the user does not exist locally, they are auto-provisioned from
    the JWT claims (keycloak_sub, email, realm_access.roles).

    DEV ONLY: Accepts 'dev-rh-token' to bypass Keycloak when APP_ENV=dev.
    """
    # --- DEV BYPASS (remove before staging/prod) ---
    if settings.APP_ENV == "dev" and credentials.credentials in ("dev-rh-token", "dev-admin-token"):
        mock_role = "admin" if credentials.credentials == "dev-admin-token" else "rh"
        mock_email = f"dev-{mock_role}@ydays.local"
        
        logger.warning(f"DEV BYPASS: using mock {mock_role.upper()} user ({credentials.credentials})")
        user = db.query(User).filter(User.email == mock_email).first()
        if user is None:
            user = User(
                keycloak_sub=f"dev-{mock_role}-bypass",
                email=mock_email,
                role=mock_role,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    # --- END DEV BYPASS ---

    payload = _decode_token(credentials.credentials)
    return _get_or_create_user(db, payload)


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the authenticated user's account is active.

    Raises HTTP 403 if the account has been deactivated.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    return current_user


def require_role(*allowed_roles: str):
    """Factory that returns a dependency enforcing role-based access.

    Usage:
        @router.get("/admin-panel")
        def admin_panel(user: User = Depends(require_role("admin"))):
            ...

        @router.get("/rh-or-direction")
        def rh_view(user: User = Depends(require_role("rh", "direction"))):
            ...
    """

    def _role_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            logger.warning(
                "RBAC denied: user=%s role=%s required=%s",
                current_user.keycloak_sub,
                current_user.role,
                allowed_roles,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(allowed_roles)}",
            )
        return current_user

    return _role_checker
