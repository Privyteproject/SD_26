"""Service pour interagir avec l'API d'administration de Keycloak."""

import logging

from keycloak import KeycloakAdmin
from keycloak.exceptions import KeycloakError

from app.core.config import settings

logger = logging.getLogger(__name__)

# On utilise une fonction pour instancier dynamiquement avec la config
def get_keycloak_admin() -> KeycloakAdmin:
    # URL du serveur d'auth (Keycloak > 17 utilise par défaut / sans /auth/)
    server_url = settings.KEYCLOAK_URL
    if not server_url.endswith("/"):
        server_url += "/"

    return KeycloakAdmin(
        server_url=server_url,
        username=settings.KEYCLOAK_ADMIN_USER,
        password=settings.KEYCLOAK_ADMIN_PASSWORD,
        realm_name=settings.KEYCLOAK_REALM,
        user_realm_name="master",  # L'admin est généralement dans le realm master
        client_id="admin-cli",
        verify=True,
    )

def create_user_in_keycloak(email: str, first_name: str, last_name: str, role: str, password: str = None) -> str | None:
    """Crée un utilisateur dans Keycloak et lui assigne un rôle et un mot de passe par défaut.
    
    Retourne l'ID de l'utilisateur créé ou None en cas d'erreur.
    """
    try:
        kc_admin = get_keycloak_admin()
        
        # Le nom d'utilisateur sera l'email (pratique courante)
        username = email.split("@")[0] if "@" in email else email
        
        new_user = {
            "email": email,
            "username": username,
            "enabled": True,
            "firstName": first_name,
            "lastName": last_name,
            "emailVerified": True,
        }
        
        # Créer l'utilisateur
        user_id = kc_admin.create_user(new_user, exist_ok=False)
        logger.info(f"Utilisateur {username} créé dans Keycloak avec l'ID {user_id}")
        
        # Configurer un mot de passe
        if password:
            kc_admin.set_user_password(user_id=user_id, password=password, temporary=False)
        else:
            kc_admin.set_user_password(user_id=user_id, password="ChangerMoi123!", temporary=True)
        
        # Assigner le rôle (si fourni)
        if role:
            try:
                # Récupérer le rôle (realm role)
                role_representation = kc_admin.get_realm_role(role.lower())
                kc_admin.assign_realm_roles(user_id=user_id, roles=[role_representation])
                logger.info(f"Rôle {role} assigné à l'utilisateur {username}")
            except KeycloakError as re:
                logger.warning(f"Impossible d'assigner le rôle {role} (il n'existe peut-être pas): {re}")
                
        return user_id
        
    except KeycloakError as e:
        logger.error(f"Erreur lors de la création Keycloak pour {email} : {e}")
        return None
    except Exception as e:
        logger.error(f"Erreur inattendue Keycloak: {e}")
        return None
