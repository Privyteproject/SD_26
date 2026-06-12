"""Données de démonstration (semées si la base est vide). Aucune donnée réelle.

Couvre les tables réellement exploitées par l'API v1 actuelle (role,
type_demande, departement, utilisateur, employe, demande) + quelques modèles.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Demande,
    Departement,
    Employe,
    ModeleDocument,
    ModeleTache,
    Role,
    TypeDemande,
    Utilisateur,
)

# Types de demande considérés comme « absences » côté API /absences
ABSENCE_TYPE_CODES = {"CONGE", "MALADIE", "TELETRAVAIL", "RTT"}


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(Employe.matricule).limit(1)) is not None:
        return

    # Rôles (codes alignés sur lib/constants.js)
    roles = [
        Role(code_role="ADMIN", libelle="Administrateur"),
        Role(code_role="DIRECTION", libelle="Direction"),
        Role(code_role="RH", libelle="Ressources Humaines"),
        Role(code_role="MANAGER", libelle="Manager"),
        Role(code_role="MEDECINE", libelle="Médecine du travail"),
        Role(code_role="COLLABORATEUR", libelle="Collaborateur"),
    ]
    db.add_all(roles)

    # Types de demande
    types = [
        TypeDemande(code_type="CONGE", libelle="Congé payé"),
        TypeDemande(code_type="MALADIE", libelle="Arrêt maladie"),
        TypeDemande(code_type="TELETRAVAIL", libelle="Télétravail"),
        TypeDemande(code_type="RTT", libelle="RTT"),
        TypeDemande(code_type="ATTESTATION", libelle="Attestation de travail"),
    ]
    db.add_all(types)

    # Modèles (parcours + documents) — pour les futures features
    db.add_all([
        ModeleTache(code_tache="ON_CONTRAT", libelle="Signer le contrat", type_parcours="ONBOARDING", ordre=1, delai_jours=2),
        ModeleTache(code_tache="ON_ACCES", libelle="Configurer les accès", type_parcours="ONBOARDING", ordre=2, delai_jours=3),
        ModeleTache(code_tache="OFF_MATERIEL", libelle="Restituer le matériel", type_parcours="OFFBOARDING", ordre=1, delai_jours=1),
        ModeleDocument(code_modele="ATTEST_TRAVAIL", libelle="Attestation de travail"),
    ])

    # Départements
    depts = {
        "IT": Departement(nom="Systèmes d'information"),
        "Ops": Departement(nom="Opérations"),
        "RH": Departement(nom="Ressources Humaines"),
        "Ventes": Departement(nom="Ventes"),
        "Direction": Departement(nom="Direction"),
        "Sante": Departement(nom="Santé au travail"),
    }
    db.add_all(depts.values())
    db.flush()  # -> id_departement

    # Comptes + employés (utilisateur 1—1 employe)
    people = [
        ("EMP001", "Keke", "Yannick", "Architecte solution", "ADMIN", "ACTIVE", "IT", None),
        ("EMP002", "Alami", "Sofia", "Manager d'équipe", "MANAGER", "ACTIVE", "Ops", None),
        ("EMP003", "Benali", "Karim", "Chargé RH", "RH", "ACTIVE", "RH", None),
        ("EMP004", "Cherkaoui", "Lina", "Directrice", "DIRECTION", "ACTIVE", "Direction", None),
        ("EMP005", "Roux", "Adam", "Opérateur", "COLLABORATEUR", "ACTIVE", "Ops", "EMP002"),
        ("EMP006", "Lahlou", "Sami", "Commercial", "COLLABORATEUR", "LEAVING", "Ventes", "EMP002"),
        ("EMP007", "Idrissi", "Nora", "Médecin du travail", "MEDECINE", "ACTIVE", "Sante", None),
        ("EMP008", "Haddad", "Yasmine", "Développeuse", "COLLABORATEUR", "NEW", "IT", "EMP001"),
    ]
    employes: dict[str, Employe] = {}
    for matricule, nom, prenom, poste, role, statut, dept, manager in people:
        email = f"{prenom}.{nom}@entreprise.com".lower()
        u = Utilisateur(email=email, keycloak_sub=f"kc-{matricule}", actif=True, code_role=role)
        db.add(u)
        db.flush()  # -> id_utilisateur
        e = Employe(
            matricule=matricule, nom=nom, prenom=prenom, poste=poste, statut=statut,
            id_departement=depts[dept].id_departement, id_utilisateur=u.id_utilisateur,
        )
        employes[matricule] = e
        db.add(e)
    db.flush()

    # Hiérarchie (après insertion pour respecter la FK auto-référentielle)
    for matricule, *_rest, manager in people:
        if manager:
            employes[matricule].matricule_manager = manager
    # Chefs de département
    depts["Ops"].matricule_chef = "EMP002"
    depts["RH"].matricule_chef = "EMP003"

    # Demandes (dont absences)
    db.add_all([
        Demande(matricule="EMP005", code_type="CONGE", date_debut=date(2026, 5, 12),
                date_fin=date(2026, 5, 16), statut="pending", detail="Vacances"),
        Demande(matricule="EMP002", code_type="MALADIE", date_debut=date(2026, 5, 8),
                date_fin=date(2026, 5, 9), statut="validated"),
        Demande(matricule="EMP006", code_type="TELETRAVAIL", date_debut=date(2026, 5, 8),
                date_fin=date(2026, 5, 8), statut="refused", detail="Exceptionnel"),
        Demande(matricule="EMP008", code_type="CONGE", date_debut=date(2026, 6, 2),
                date_fin=date(2026, 6, 6), statut="pending"),
        # Une demande non-absence (pour vérifier le filtrage de /absences)
        Demande(matricule="EMP005", code_type="ATTESTATION", statut="validated",
                detail="Attestation de travail"),
    ])

    # Scores de risque (désengagement / burnout) — IA
    from app.db.models import IndicateurRH, ScoreRisque
    db.add_all([
        ScoreRisque(matricule="EMP006", type="desengagement", valeur=0.82, niveau="high", date_calcul=date(2026, 6, 1)),
        ScoreRisque(matricule="EMP005", type="burnout", valeur=0.55, niveau="mid", date_calcul=date(2026, 6, 1)),
        ScoreRisque(matricule="EMP002", type="burnout", valeur=0.71, niveau="high", date_calcul=date(2026, 6, 1)),
        ScoreRisque(matricule="EMP008", type="desengagement", valeur=0.22, niveau="low", date_calcul=date(2026, 6, 1)),
    ])

    # Indicateurs RH agrégés (turnover, absentéisme, engagement)
    db.add_all([
        IndicateurRH(type="turnover", valeur=8.2, periode="2026-Q2", date_calcul=date(2026, 6, 1)),
        IndicateurRH(type="absenteisme", valeur=2.7, periode="2026-Q2", date_calcul=date(2026, 6, 1)),
        IndicateurRH(type="engagement", valeur=84, periode="2026-Q2", date_calcul=date(2026, 6, 1)),
        IndicateurRH(type="engagement", valeur=80, periode="2026-Q1", date_calcul=date(2026, 3, 1)),
    ])
    db.commit()
