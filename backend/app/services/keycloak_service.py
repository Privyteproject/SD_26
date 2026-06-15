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
        
        # Assigner le rôle realm (si fourni). Crée le rôle à la volée s'il n'existe pas
        # encore dans le realm (les rôles applicatifs ne sont pas tous pré-importés).
        if role:
            role_name = role.lower()
            try:
                try:
                    role_representation = kc_admin.get_realm_role(role_name)
                except KeycloakError:
                    kc_admin.create_realm_role({"name": role_name}, skip_exists=True)
                    role_representation = kc_admin.get_realm_role(role_name)
                    logger.info(f"Rôle realm '{role_name}' créé dans Keycloak")
                kc_admin.assign_realm_roles(user_id=user_id, roles=[role_representation])
                logger.info(f"Rôle {role_name} assigné à l'utilisateur {username}")
            except KeycloakError as re:
                logger.warning(f"Impossible d'assigner le rôle {role}: {re}")
                
        return user_id
        
    except KeycloakError as e:
        logger.error(f"Erreur lors de la création Keycloak pour {email} : {e}")
        return None
    except Exception as e:
        logger.error(f"Erreur inattendue Keycloak: {e}")
        return None


# Rôles applicatifs gérés comme rôles realm (cf. front lib/constants.js).
APP_ROLES = {"collaborateur", "manager", "rh", "direction", "admin", "medecine"}


def _find_kc_user_id(kc_admin: KeycloakAdmin, email: str) -> str | None:
    """Retrouve l'id Keycloak d'un utilisateur par email, avec repli sur le username."""
    users = kc_admin.get_users({"email": email}) or []
    if not users:
        username = email.split("@")[0] if "@" in email else email
        users = kc_admin.get_users({"username": username}) or []
    return users[0]["id"] if users else None


def delete_user_in_keycloak(email: str) -> bool:
    """Supprime l'utilisateur Keycloak correspondant à l'email. Best-effort (loggé)."""
    if not email:
        return False
    try:
        kc_admin = get_keycloak_admin()
        user_id = _find_kc_user_id(kc_admin, email)
        if not user_id:
            logger.info(f"Keycloak : aucun utilisateur à supprimer pour {email}")
            return False
        kc_admin.delete_user(user_id=user_id)
        logger.info(f"Keycloak : utilisateur {email} supprimé ({user_id})")
        return True
    except KeycloakError as e:
        logger.error(f"Erreur suppression Keycloak pour {email} : {e}")
        return False
    except Exception as e:
        logger.error(f"Erreur inattendue suppression Keycloak : {e}")
        return False


def update_user_in_keycloak(email: str, first_name: str = None, last_name: str = None,
                            role: str = None, new_email: str = None) -> bool:
    """Met à jour le profil + le rôle realm de l'utilisateur Keycloak. Best-effort."""
    if not email:
        return False
    try:
        kc_admin = get_keycloak_admin()
        user_id = _find_kc_user_id(kc_admin, email)
        if not user_id:
            logger.info(f"Keycloak : utilisateur {email} introuvable (mise à jour ignorée)")
            return False

        payload = {}
        if first_name is not None:
            payload["firstName"] = first_name
        if last_name is not None:
            payload["lastName"] = last_name
        if new_email:
            payload["email"] = new_email
            payload["username"] = new_email.split("@")[0] if "@" in new_email else new_email
        if payload:
            kc_admin.update_user(user_id=user_id, payload=payload)

        if role:
            role_name = role.lower()
            # Retire les autres rôles applicatifs, garde/ajoute le nouveau.
            current = kc_admin.get_realm_roles_of_user(user_id=user_id) or []
            to_remove = [r for r in current if r["name"] in APP_ROLES and r["name"] != role_name]
            if to_remove:
                kc_admin.delete_realm_roles_of_user(user_id=user_id, roles=to_remove)
            try:
                rep = kc_admin.get_realm_role(role_name)
            except KeycloakError:
                kc_admin.create_realm_role({"name": role_name}, skip_exists=True)
                rep = kc_admin.get_realm_role(role_name)
            kc_admin.assign_realm_roles(user_id=user_id, roles=[rep])

        logger.info(f"Keycloak : utilisateur {email} mis à jour")
        return True
    except KeycloakError as e:
        logger.error(f"Erreur mise à jour Keycloak pour {email} : {e}")
        return False
    except Exception as e:
        logger.error(f"Erreur inattendue mise à jour Keycloak : {e}")
        return False
