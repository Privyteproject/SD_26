"""Comptes de DÉMO canoniques — source unique d'identités (login fiable + scoping).

Un seul jeu d'identifiants (@waminey.ma), partagé par le front (authStore + devAuth) et le
back (find_employee_by_email). Chaque compte = Utilisateur + Employe avec le bon rôle et un
département cohérent.

NB : lors d'un seed complet, ces comptes sont EMBARQUÉS par advanced_seed (placés dans la
hiérarchie d'équipes, avec données riches). Ce module sert au cas « patch d'une base
existante » sans tout régénérer : upsert idempotent par e-mail, sans toucher au reste.

    docker compose exec backend python -m app.db.seed_demo_accounts
"""

from datetime import date

from sqlalchemy import func, select

from app.db.base import SessionLocal

DOMAIN = "waminey.ma"

# (matricule, email, prénom, nom, rôle, statut, département, manager) — ORDRE STABLE :
# advanced_seed lit les indices 0..5 (matricule, email, prénom, nom, rôle, statut).
ACCOUNTS = [
    ("DEMO_DIR", f"direction@{DOMAIN}", "Nadia", "Benjelloun", "DIRECTION", "ACTIVE", "Direction", None),
    ("DEMO_ADMIN", f"admin@{DOMAIN}", "Mohammed", "El Idrissi", "ADMIN", "ACTIVE", "Systèmes d'information", None),
    ("DEMO_MGR", f"manager@{DOMAIN}", "Sofia", "Alami", "MANAGER", "ACTIVE", "Systèmes d'information", None),
    ("DEMO_RH", f"rh@{DOMAIN}", "Karim", "Benali", "RH", "ACTIVE", "Ressources Humaines", None),
    ("DEMO_MED", f"medecine@{DOMAIN}", "Yasmine", "Saidi", "MEDECINE", "ACTIVE", "Santé au travail", None),
    ("DEMO_COL", f"collaborateur@{DOMAIN}", "Hamza", "Cherkaoui", "COLLABORATEUR", "ACTIVE", "Systèmes d'information", "DEMO_MGR"),
    ("DEMO_NEW", f"nouveau@{DOMAIN}", "Adam", "Tazi", "COLLABORATEUR", "NEW", "Systèmes d'information", "DEMO_MGR"),
    ("DEMO_OUT", f"depart@{DOMAIN}", "Lina", "Haddad", "COLLABORATEUR", "LEAVING", "Systèmes d'information", "DEMO_MGR"),
]
DEMO_MATRICULES = [a[0] for a in ACCOUNTS]
DEMO_EMAILS = [a[1] for a in ACCOUNTS]
POSTES = {"ADMIN": "Administrateur plateforme", "DIRECTION": "Directrice générale",
          "RH": "Manager", "MANAGER": "Manager", "MEDECINE": "Médecin du travail",
          "COLLABORATEUR": "Développeur"}
BASE_SALAIRE = {"ADMIN": 360000, "DIRECTION": 1100000, "RH": 320000, "MANAGER": 360000,
                "MEDECINE": 420000, "COLLABORATEUR": 150000}


def run():
    db = SessionLocal()
    from app.db.models import Departement, Employe, HistoriqueSalaire, Role, Utilisateur
    try:
        for c in ["ADMIN", "DIRECTION", "RH", "MANAGER", "MEDECINE", "COLLABORATEUR"]:
            if db.get(Role, c) is None:
                db.add(Role(code_role=c, libelle=c.title()))
        db.commit()
        depts = {d.nom: d for d in db.scalars(select(Departement))}

        for mat, email, prenom, nom, role, statut, dept_nom, mgr in ACCOUNTS:
            dept = depts.get(dept_nom)
            if dept is None:
                dept = Departement(nom=dept_nom)
                db.add(dept)
                db.commit()
                depts[dept_nom] = dept
            u = db.scalar(select(Utilisateur).where(Utilisateur.email == email))
            if u is None:
                u = Utilisateur(email=email, keycloak_sub=f"kc-{mat}", actif=True, code_role=role)
                db.add(u)
                db.flush()
            else:
                u.code_role, u.actif = role, True
            e = db.get(Employe, mat)
            if e is None:
                e = Employe(matricule=mat, id_utilisateur=u.id_utilisateur)
                db.add(e)
            e.prenom, e.nom, e.statut, e.poste = prenom, nom, statut, POSTES[role]
            e.id_departement = dept.id_departement
            e.id_utilisateur = u.id_utilisateur
            e.matricule_manager = mgr
            e.type_contrat = e.type_contrat or "CDI"
            e.genre = e.genre or "Autre"
            e.site = e.site or "Casablanca"
            e.date_embauche = e.date_embauche or date(2022, 9, 1)
            e.date_naissance = e.date_naissance or date(1990, 5, 15)
            db.flush()
            if not db.scalar(select(func.count()).select_from(HistoriqueSalaire).where(HistoriqueSalaire.matricule == mat)):
                db.add(HistoriqueSalaire(matricule=mat, montant=BASE_SALAIRE[role], date_effet=date(2022, 9, 1), motif="Embauche"))
        db.commit()
        print(f"OK — {len(ACCOUNTS)} comptes démo @{DOMAIN} (upsert).")
        for em in DEMO_EMAILS:
            print(f"  {em}  (mdp: demo1234)")
    finally:
        db.close()


if __name__ == "__main__":
    run()
