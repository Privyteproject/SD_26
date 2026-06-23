"""Seed avancé « intelligent » pour le Machine Learning (OPT-IN, destructif).

Génère ~1000 employés avec 3 à 5 ans d'historiques corrélés (salaires, entretiens,
enquêtes d'engagement trimestrielles, absences) répartis en 3 profils — pour que les
modèles Random Forest (Mission 3) apprennent une vraie signature du départ.

⚠️ DESTRUCTIF : vide les tables RH avant de régénérer. NE s'exécute QUE si lancé
explicitement avec l'argument --confirm :

    docker compose exec backend python -m app.db.advanced_seed --confirm

Les comptes de démonstration (EMP001..EMP008) sont recréés pour garder l'app
utilisable. Keycloak n'est pas touché.
"""

import random
import sys
from datetime import date, timedelta

from sqlalchemy import delete

from app.db.base import SessionLocal
from app.db.models import (
    Alerte, ChatMessage, ChatSession, ConversationIA, Demande, Departement,
    Document, DossierConfidentiel, Employe, EnqueteEngagement, EntretienAnnuel,
    Feedback, HistoriqueSalaire, IndicateurRH, InteractionIA, JournalAudit,
    ModeleDocument, ModeleTache, Role, ScoreRisque, SourceIA, TacheParcours,
    Utilisateur,
)

N_EMPLOYES = 1000
SITES = ["Paris", "Lyon", "Bordeaux", "Remote"]
CONTRATS = ["CDI", "CDD", "Alternance"]
GENRES = ["M", "F", "Autre"]
POSTES = ["Développeur", "Commercial", "Chargé RH", "Analyste", "Chef de projet",
          "Comptable", "Support client", "Designer", "Ingénieur", "Consultant"]
TODAY = date(2026, 6, 1)


def _faker():
    try:
        from faker import Faker
        return Faker("fr_FR")
    except Exception:
        return None


def _wipe(db):
    """Supprime les données RH (enfants -> parents). Conserve roles/types/modeles/départements."""
    for model in (SourceIA, InteractionIA, ChatMessage, ChatSession, ConversationIA,
                  Document, TacheParcours, HistoriqueSalaire, EnqueteEngagement,
                  EntretienAnnuel, Feedback, ScoreRisque, DossierConfidentiel, Demande,
                  Alerte, JournalAudit):
        db.execute(delete(model))
    db.execute(Departement.__table__.update().values(matricule_chef=None))
    db.execute(delete(Employe))
    db.execute(delete(Utilisateur))
    db.commit()


def _ensure_referentiels(db):
    """Crée rôles / types / modèles / départements si absents. Renvoie {nom: id_dept}."""
    if db.query(Role).count() == 0:
        db.add_all([Role(code_role=c, libelle=c.title()) for c in
                    ["ADMIN", "DIRECTION", "RH", "MANAGER", "MEDECINE", "COLLABORATEUR"]])
    if db.query(ModeleDocument).count() == 0:
        db.add(ModeleDocument(code_modele="ATTEST_TRAVAIL", libelle="Attestation de travail"))
    for code, lib in [("CONGE", "Congé payé"), ("MALADIE", "Arrêt maladie"),
                      ("TELETRAVAIL", "Télétravail"), ("RTT", "RTT"),
                      ("ABSENCE", "Absence Injustifiée"),
                      ("ATTESTATION", "Attestation de travail")]:
        from app.db.models import TypeDemande
        if db.get(TypeDemande, code) is None:
            db.add(TypeDemande(code_type=code, libelle=lib))
    db.flush()
    depts = {d.nom: d.id_departement for d in db.query(Departement).all()}
    if not depts:
        for nom in ["Systèmes d'information", "Opérations", "Ressources Humaines",
                    "Ventes", "Direction", "Santé au travail"]:
            d = Departement(nom=nom)
            db.add(d)
        db.flush()
        depts = {d.nom: d.id_departement for d in db.query(Departement).all()}
    return depts


def _demo_accounts(db, dept_ids):
    """Recrée les comptes EMP001..EMP008 (connexion app)."""
    any_dept = next(iter(dept_ids.values()))
    people = [
        ("EMP001", "Keke", "Yannick", "Architecte solution", "ADMIN", "ACTIVE"),
        ("EMP002", "Alami", "Sofia", "Manager d'équipe", "MANAGER", "ACTIVE"),
        ("EMP003", "Benali", "Karim", "Chargé RH", "RH", "ACTIVE"),
        ("EMP004", "Cherkaoui", "Lina", "Directrice", "DIRECTION", "ACTIVE"),
        ("EMP005", "Roux", "Adam", "Opérateur", "COLLABORATEUR", "ACTIVE"),
        ("EMP006", "Lahlou", "Sami", "Commercial", "COLLABORATEUR", "LEAVING"),
        ("EMP007", "Idrissi", "Nora", "Médecin du travail", "MEDECINE", "ACTIVE"),
        ("EMP008", "Haddad", "Yasmine", "Développeuse", "COLLABORATEUR", "NEW"),
    ]
    for matricule, nom, prenom, poste, role, statut in people:
        email = f"{prenom}.{nom}@entreprise.com".lower()
        u = Utilisateur(email=email, keycloak_sub=f"kc-{matricule}", actif=True, code_role=role)
        db.add(u)
        db.flush()
        db.add(Employe(matricule=matricule, nom=nom, prenom=prenom, poste=poste, statut=statut,
                       date_embauche=date(2021, 1, 11), date_naissance=date(1990, 5, 20),
                       site="Paris", type_contrat="CDI", genre="Autre",
                       id_departement=any_dept, id_utilisateur=u.id_utilisateur))


def _pick_profile():
    return random.choices(["stable", "desengage", "turnover"], weights=[70, 20, 10])[0]


def _generate(db, dept_ids, fake):
    dept_id_list = list(dept_ids.values())
    util_objs, emp_objs = [], []
    # 1) Utilisateurs (besoin des id avant les employés).
    metas = []
    for i in range(N_EMPLOYES):
        matricule = f"EMP{1000 + i}"
        email = (fake.unique.email() if fake else f"emp{1000 + i}@entreprise.com").lower()
        util_objs.append(Utilisateur(email=email, keycloak_sub=f"kc-{matricule}",
                                     actif=True, code_role="COLLABORATEUR"))
        metas.append(matricule)
    db.add_all(util_objs)
    db.flush()  # -> id_utilisateur

    histories = []  # insérés en bulk
    for matricule, u in zip(metas, util_objs):
        profile = _pick_profile()
        embauche_year = random.choices(range(2018, 2026), weights=[1, 1, 2, 2, 3, 3, 4, 4])[0]
        date_embauche = date(embauche_year, random.randint(1, 12), random.randint(1, 28))
        age = random.randint(23, 60)
        date_naissance = date(TODAY.year - age, random.randint(1, 12), random.randint(1, 28))
        statut = "LEAVING" if profile == "turnover" else "ACTIVE"
        emp_objs.append(Employe(
            matricule=matricule, nom=(fake.last_name() if fake else "Nom"),
            prenom=(fake.first_name() if fake else "Prenom"),
            poste=random.choice(POSTES), statut=statut,
            date_embauche=date_embauche, date_naissance=date_naissance,
            site=random.choices(SITES, weights=[40, 20, 15, 25])[0],
            type_contrat=random.choices(CONTRATS, weights=[80, 12, 8])[0],
            genre=random.choices(GENRES, weights=[48, 48, 4])[0],
            id_departement=random.choice(dept_id_list), id_utilisateur=u.id_utilisateur,
        ))

        # Historiques par année de présence.
        salaire = random.randint(28000, 70000)
        histories.append(HistoriqueSalaire(matricule=matricule, montant=salaire,
                                           date_effet=date_embauche, motif="Embauche"))
        years = list(range(embauche_year + 1, TODAY.year + 1))
        years_since_raise = 0
        for y in years:
            # Augmentation (selon profil)
            raise_proba = 0.85 if profile == "stable" else 0.35
            if random.random() < raise_proba:
                pct = random.uniform(0.02, 0.04) if profile == "stable" else random.uniform(0.0, 0.02)
                salaire = round(salaire * (1 + pct))
                motif = "Promotion" if (profile == "stable" and random.random() < 0.2) else "Annuel"
                histories.append(HistoriqueSalaire(matricule=matricule, montant=salaire,
                                                   date_effet=date(y, 1, 15), motif=motif))
                years_since_raise = 0
            else:
                years_since_raise += 1

            # Entretien annuel (note selon profil)
            note = 5 if profile == "stable" and random.random() < 0.5 else \
                4 if profile == "stable" else random.choice([2, 3])
            histories.append(EntretienAnnuel(matricule=matricule, date_entretien=date(y, 11, 15),
                                             note_performance_1_5=note))

            # Enquêtes trimestrielles (4/an) — chute progressive pour les profils à risque
            for q in range(4):
                month = q * 3 + 2
                if profile == "stable":
                    base = random.randint(7, 9)
                    sat, eq, ch, rec = base, random.randint(6, 9), random.randint(5, 8), base
                else:
                    # déclin sur l'année récente : les derniers trimestres plus bas
                    recent = (y == TODAY.year)
                    lo, hi = (3, 5) if recent else (4, 7)
                    sat = random.randint(lo, hi)
                    eq = random.randint(3, 6)
                    ch = random.randint(6, 9)  # charge perçue élevée
                    rec = random.randint(lo, hi)
                histories.append(EnqueteEngagement(
                    matricule=matricule, date_enquete=date(y, month, 10),
                    satisfaction_globale=sat, equilibre_pro_perso=eq,
                    charge_travail=ch, reconnaissance=rec))

            # Absences MALADIE et ABSENCE (injustifiée) dictées par le profil + télétravail aléatoire
            n_maladie = random.randint(0, 1) if profile == "stable" else random.randint(3, 5)
            for _ in range(n_maladie):
                d0 = date(y, random.randint(1, 12), random.randint(1, 28))
                histories.append(Demande(matricule=matricule, code_type="MALADIE",
                                         date_debut=d0, date_fin=d0 + timedelta(days=random.randint(1, 3)),
                                         statut="validated"))
            if profile == "desengage":
                n_absence = random.randint(1, 3)
                for _ in range(n_absence):
                    d0 = date(y, random.randint(1, 12), random.randint(1, 28))
                    histories.append(Demande(matricule=matricule, code_type="ABSENCE",
                                             date_debut=d0, date_fin=d0,
                                             statut="validated"))
            if random.random() < 0.5:
                d0 = date(y, random.randint(1, 12), random.randint(1, 28))
                histories.append(Demande(matricule=matricule, code_type="TELETRAVAIL",
                                         date_debut=d0, date_fin=d0, statut="validated"))

        # Feedbacks internes des 12 derniers mois (note corrélée au profil) — signal ML.
        for _ in range(random.randint(1, 3)):
            if profile == "stable":
                note = random.choice([4, 4, 5, 5])
                cat = random.choice(["performance", "ambiance", "collaboration"])
            else:
                note = random.choice([1, 2, 2, 3])
                cat = random.choice(["charge", "performance", "engagement"])
            d0 = TODAY - timedelta(days=random.randint(15, 350))
            histories.append(Feedback(matricule=matricule, date_feedback=d0,
                                      note_1_5=note, categorie=cat, auteur="manager"))

    db.add_all(emp_objs)
    db.flush()
    db.bulk_save_objects(histories)  # dizaines de milliers de lignes
    db.commit()
    return len(emp_objs), len(histories)


def run():
    db = SessionLocal()
    try:
        _wipe(db)
        dept_ids = _ensure_referentiels(db)
        _demo_accounts(db, dept_ids)
        db.commit()
        fake = _faker()
        n_emp, n_hist = _generate(db, dept_ids, fake)
        print(f"OK : {n_emp} employés générés + 8 comptes démo, {n_hist} lignes d'historique.")
    finally:
        db.close()


if __name__ == "__main__":
    if "--confirm" not in sys.argv:
        print("DESTRUCTIF. Relancez avec --confirm pour vider et régénérer la base :")
        print("  python -m app.db.advanced_seed --confirm")
        sys.exit(1)
    run()
