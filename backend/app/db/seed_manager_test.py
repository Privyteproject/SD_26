"""Seed de test pour l'accès aux données sensibles (moteur E5 / ABAC).

Crée un manager de test, 2 collaborateurs DANS son périmètre, et 1 collaborateur
HORS périmètre (rattaché à un autre manager), avec salaires, dossiers confidentiels
(CIN/adresse chiffrés au repos) et documents (CONTRAT / FICHE_PAIE en PDF MinIO).

Idempotent : purge et recrée les comptes de test à chaque exécution.

    docker compose exec backend python -m app.db.seed_manager_test
"""

from datetime import date

from sqlalchemy import delete, select, update

from app.db.base import SessionLocal
from app.db.models import (Departement, Document, DossierConfidentiel, Employe,
                           HistoriqueSalaire, Role, Utilisateur)
from app.services import crypto

TEST = ["TEST_MGR", "TEST_C1", "TEST_C2", "TEST_OMGR", "TEST_OUT"]
# (matricule, nom, prenom, poste, role, manager)
PEOPLE = [
    ("TEST_MGR", "Manager", "Test", "Manager d'équipe", "MANAGER", None),
    ("TEST_C1", "Dupont", "Alice", "Développeuse", "COLLABORATEUR", "TEST_MGR"),
    ("TEST_C2", "Martin", "Karim", "Analyste", "COLLABORATEUR", "TEST_MGR"),
    ("TEST_OMGR", "Autre", "Chef", "Manager d'équipe", "MANAGER", None),
    ("TEST_OUT", "Bernard", "Sophie", "Comptable", "COLLABORATEUR", "TEST_OMGR"),
]
SENSITIVE = [("TEST_C1", 42000), ("TEST_C2", 38000), ("TEST_OUT", 45000)]


def _wipe(db):
    db.execute(update(Employe).where(Employe.matricule.in_(TEST)).values(matricule_manager=None))
    for m in TEST:
        db.execute(delete(Document).where(Document.matricule == m))
        db.execute(delete(HistoriqueSalaire).where(HistoriqueSalaire.matricule == m))
        db.execute(delete(DossierConfidentiel).where(DossierConfidentiel.matricule == m))
    db.execute(delete(Employe).where(Employe.matricule.in_(TEST)))
    db.execute(delete(Utilisateur).where(
        Utilisateur.email.in_([f"{m.lower()}@entreprise.com" for m in TEST])))
    db.commit()


def run():
    db = SessionLocal()
    try:
        # Référentiels minimaux.
        for c in ["ADMIN", "DIRECTION", "RH", "MANAGER", "MEDECINE", "COLLABORATEUR"]:
            if db.get(Role, c) is None:
                db.add(Role(code_role=c, libelle=c.title()))
        db.commit()
        dept = db.scalars(select(Departement)).first()
        if dept is None:
            dept = Departement(nom="Test E5")
            db.add(dept)
            db.commit()

        _wipe(db)

        for mat, nom, prenom, poste, role, mgr in PEOPLE:
            u = Utilisateur(email=f"{mat.lower()}@entreprise.com", keycloak_sub=f"kc-{mat}",
                            actif=True, code_role=role)
            db.add(u)
            db.flush()
            db.add(Employe(matricule=mat, nom=nom, prenom=prenom, poste=poste, statut="ACTIVE",
                           date_embauche=date(2022, 3, 1), date_naissance=date(1990, 1, 1),
                           site="Casablanca", type_contrat="CDI", genre="Autre",
                           id_departement=dept.id_departement, id_utilisateur=u.id_utilisateur,
                           matricule_manager=mgr))
        db.commit()

        for mat, salaire in SENSITIVE:
            db.add(HistoriqueSalaire(matricule=mat, montant=salaire, date_effet=date(2025, 1, 1), motif="Annuel"))
            db.add(DossierConfidentiel(matricule=mat, cin=crypto.encrypt(f"AB{mat[-1]}12345"),
                                       adresse=crypto.encrypt("12 rue de Test, Casablanca")))
            db.add(Document(matricule=mat, nom_fichier=f"contrat_{mat}.pdf", type_doc="CONTRAT",
                            statut="validated", cle_minio=f"hr-documents/{mat}/contrat.pdf"))
            db.add(Document(matricule=mat, nom_fichier=f"paie_{mat}_2025_06.pdf", type_doc="FICHE_PAIE",
                            statut="validated", cle_minio=f"hr-documents/{mat}/paie_2025_06.pdf"))
        db.commit()

        print("OK — seed E5 :")
        print("  Manager        : test_mgr@entreprise.com  (TEST_MGR)")
        print("  Son périmètre  : TEST_C1 (Alice Dupont), TEST_C2 (Karim Martin)")
        print("  Hors périmètre : TEST_OUT (Sophie Bernard), rattachée à TEST_OMGR")
    finally:
        db.close()


if __name__ == "__main__":
    run()
