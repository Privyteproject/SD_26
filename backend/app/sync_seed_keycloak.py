import sys
import os

# Add the /app directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/app")

from app.services.keycloak_service import create_user_in_keycloak, _find_kc_user_id, get_keycloak_admin

users = [
    ("yannick.keke@entreprise.com", "Yannick", "Keke", "ADMIN"),
    ("sofia.alami@entreprise.com", "Sofia", "Alami", "MANAGER"),
    ("karim.benali@entreprise.com", "Karim", "Benali", "RH"),
    ("lina.cherkaoui@entreprise.com", "Lina", "Cherkaoui", "DIRECTION"),
    ("adam.roux@entreprise.com", "Adam", "Roux", "COLLABORATEUR"),
    ("sami.lahlou@entreprise.com", "Sami", "Lahlou", "COLLABORATEUR"),
    ("nora.idrissi@entreprise.com", "Nora", "Idrissi", "MEDECINE"),
    ("yasmine.haddad@entreprise.com", "Yasmine", "Haddad", "COLLABORATEUR"),
]

password = "demo"

kc_admin = get_keycloak_admin()

for email, prenom, nom, role in users:
    # Check if user already exists
    user_id = _find_kc_user_id(kc_admin, email)
    if user_id:
        print(f"User {email} already exists in Keycloak (id: {user_id}). Skipping creation.")
        # But we still set the password to make sure we can login!
        kc_admin.set_user_password(user_id=user_id, password=password, temporary=False)
        print(f"  -> Reset password to '{password}' just in case.")
        continue
        
    print(f"Creating {email} with role {role} ...")
    create_user_in_keycloak(email=email, first_name=prenom, last_name=nom, role=role, password=password)

print(f"\nTerminé ! Tous les comptes ont le mot de passe: {password}")
