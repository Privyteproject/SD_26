"""Modèles ORM (SQLAlchemy 2.0) — fidèles au MLD officiel v1.0.

18 tables du schéma relationnel Synapse Digital. Conventions :
- PK = clé primaire, FK = clé étrangère, UK = contrainte d'unicité.
- montant monétaire en NUMERIC(12,2) (jamais en flottant).
- index sur chaque FK et sur les colonnes de recherche fréquentes
  (email, cin, statut, dates).
- date_creation = horodatage (DateTime) ; les dates métier = Date.

Les méthodes to_dict() qui font le pont vers les shapes attendues par le
front intégré (employes / absences) sont regroupées en bas de fichier.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# ───────────────────────── Référentiels ─────────────────────────
class Role(Base):
    __tablename__ = "role"
    code_role: Mapped[str] = mapped_column(String(20), primary_key=True)
    libelle: Mapped[str] = mapped_column(String(80))

    utilisateurs: Mapped[list[Utilisateur]] = relationship(back_populates="role")


class TypeDemande(Base):
    __tablename__ = "type_demande"
    code_type: Mapped[str] = mapped_column(String(20), primary_key=True)
    libelle: Mapped[str] = mapped_column(String(80))


class ModeleDocument(Base):
    __tablename__ = "modele_document"
    code_modele: Mapped[str] = mapped_column(String(20), primary_key=True)
    libelle: Mapped[str] = mapped_column(String(120))
    categorie: Mapped[str | None] = mapped_column(String(40), nullable=True)  # attestation, conge, certificat…
    gabarit: Mapped[str | None] = mapped_column(Text, nullable=True)          # corps par défaut du brouillon
    actif: Mapped[bool] = mapped_column(Boolean, default=True)                # type proposé ou non aux utilisateurs


class Formation(Base):
    """Catalogue de formations internes — base des recommandations d'onboarding
    (matching poste ↔ mots-clés) et du plan de développement des compétences."""
    __tablename__ = "formation"
    code: Mapped[str] = mapped_column(String(30), primary_key=True)
    titre: Mapped[str] = mapped_column(String(160))
    categorie: Mapped[str | None] = mapped_column(String(40), nullable=True)  # technique/management/transverse…
    mots_cles: Mapped[str | None] = mapped_column(String(255), nullable=True)  # tags séparés par des virgules
    duree_jours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    niveau: Mapped[str | None] = mapped_column(String(20), nullable=True)  # débutant/intermédiaire/avancé
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean, default=True)

    def to_dict(self) -> dict:
        return {
            "code": self.code, "titre": self.titre, "categorie": self.categorie,
            "mots_cles": [m.strip() for m in (self.mots_cles or "").split(",") if m.strip()],
            "duree_jours": self.duree_jours, "niveau": self.niveau,
            "description": self.description, "actif": bool(self.actif),
        }


class ModeleTache(Base):
    __tablename__ = "modele_tache"
    code_tache: Mapped[str] = mapped_column(String(20), primary_key=True)
    libelle: Mapped[str] = mapped_column(String(120))
    type_parcours: Mapped[str] = mapped_column(String(20))  # ONBOARDING / OFFBOARDING
    ordre: Mapped[int] = mapped_column(Integer, default=0)
    delai_jours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    __table_args__ = (
        CheckConstraint(
            "type_parcours IN ('ONBOARDING','OFFBOARDING')", name="ck_modele_tache_parcours"
        ),
    )


# ───────────────────────── Identité / RH ─────────────────────────
class Utilisateur(Base):
    __tablename__ = "utilisateur"
    id_utilisateur: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    keycloak_sub: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    actif: Mapped[bool] = mapped_column(Boolean, default=True)
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    code_role: Mapped[str] = mapped_column(ForeignKey("role.code_role"), index=True)

    role: Mapped[Role] = relationship(back_populates="utilisateurs")
    employe: Mapped[Employe | None] = relationship(back_populates="utilisateur", uselist=False)


class Departement(Base):
    __tablename__ = "departement"
    id_departement: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nom: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Responsable du département (cycle employe↔departement -> use_alter).
    matricule_chef: Mapped[str | None] = mapped_column(
        ForeignKey("employe.matricule", use_alter=True, name="fk_dept_chef"), nullable=True
    )

    employees: Mapped[list[Employe]] = relationship(
        back_populates="department", foreign_keys="Employe.id_departement"
    )
    chef: Mapped[Employe | None] = relationship(foreign_keys=[matricule_chef])


class Employe(Base):
    __tablename__ = "employe"
    __table_args__ = (
        CheckConstraint("statut IN ('NEW','ACTIVE','LEAVING')", name="ck_employe_statut"),
    )
    matricule: Mapped[str] = mapped_column(String(20), primary_key=True)
    nom: Mapped[str] = mapped_column(String(80), index=True)
    prenom: Mapped[str] = mapped_column(String(80))
    poste: Mapped[str | None] = mapped_column(String(120), nullable=True)
    date_embauche: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_naissance: Mapped[date | None] = mapped_column(Date, nullable=True)
    site: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)  # Paris/Lyon/…/Remote
    type_contrat: Mapped[str | None] = mapped_column(String(20), nullable=True)       # CDI/CDD/Alternance
    genre: Mapped[str | None] = mapped_column(String(10), nullable=True)              # M/F/Autre
    statut: Mapped[str] = mapped_column(String(10), default="ACTIVE", index=True)
    # Informations personnelles modifiables par le collaborateur lui-même
    telephone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo: Mapped[str | None] = mapped_column(Text, nullable=True)                    # data URL (image base64)
    id_departement: Mapped[int | None] = mapped_column(
        ForeignKey("departement.id_departement"), nullable=True, index=True
    )
    matricule_manager: Mapped[str | None] = mapped_column(
        ForeignKey("employe.matricule"), nullable=True, index=True
    )
    id_utilisateur: Mapped[int | None] = mapped_column(
        ForeignKey("utilisateur.id_utilisateur"), unique=True, nullable=True
    )

    utilisateur: Mapped[Utilisateur | None] = relationship(back_populates="employe")
    department: Mapped[Departement | None] = relationship(
        back_populates="employees", foreign_keys=[id_departement]
    )
    manager: Mapped[Employe | None] = relationship(remote_side=[matricule], foreign_keys=[matricule_manager])
    dossier: Mapped[DossierConfidentiel | None] = relationship(
        back_populates="employe", uselist=False, cascade="all, delete-orphan"
    )
    demandes: Mapped[list[Demande]] = relationship(
        back_populates="employe", foreign_keys="Demande.matricule"
    )


class DossierConfidentiel(Base):
    """1:1 avec employe : la PK est aussi la FK (RGPD / loi 09-08)."""
    __tablename__ = "dossier_confidentiel"
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), primary_key=True)
    cin: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)  # chiffré
    adresse: Mapped[str | None] = mapped_column(Text, nullable=True)  # chiffré

    employe: Mapped[Employe] = relationship(back_populates="dossier")


class HistoriqueSalaire(Base):
    __tablename__ = "historique_salaire"
    id_historique: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    montant: Mapped[float] = mapped_column(Numeric(12, 2))            # = nouveau_salaire
    date_effet: Mapped[date] = mapped_column(Date, index=True)        # = date_changement
    motif: Mapped[str | None] = mapped_column(String(20), nullable=True)  # Embauche/Annuel/Promotion
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)


class EnqueteEngagement(Base):
    """Sondage d'engagement trimestriel (scores sur 10)."""
    __tablename__ = "enquete_engagement"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)
    date_enquete: Mapped[date] = mapped_column(Date, index=True)
    satisfaction_globale: Mapped[int | None] = mapped_column(Integer, nullable=True)
    equilibre_pro_perso: Mapped[int | None] = mapped_column(Integer, nullable=True)
    charge_travail: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reconnaissance: Mapped[int | None] = mapped_column(Integer, nullable=True)


class EntretienAnnuel(Base):
    """Entretien annuel d'évaluation (note de performance sur 5)."""
    __tablename__ = "entretien_annuel"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)
    date_entretien: Mapped[date] = mapped_column(Date, index=True)
    note_performance_1_5: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Feedback(Base):
    """Feedback interne sur un collaborateur (manager/RH/pair) — signal continu
    complémentaire des enquêtes trimestrielles, exploité par les modèles ML
    de désengagement (note moyenne récente)."""
    __tablename__ = "feedback"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)
    date_feedback: Mapped[date] = mapped_column(Date, index=True)
    note_1_5: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1 (négatif) .. 5 (positif)
    categorie: Mapped[str | None] = mapped_column(String(40), nullable=True)  # performance/ambiance/charge…
    commentaire: Mapped[str | None] = mapped_column(Text, nullable=True)
    auteur: Mapped[str | None] = mapped_column(String(120), nullable=True)  # email/rôle de l'auteur

    def to_dict(self) -> dict:
        return {
            "id": self.id, "employee_id": self.matricule,
            "date_feedback": self.date_feedback.isoformat() if self.date_feedback else None,
            "note_1_5": self.note_1_5, "categorie": self.categorie,
            "commentaire": self.commentaire, "auteur": self.auteur,
        }


# ───────────────────────── Carrières & Compétences ─────────────────────────
# Niveaux d'évolution standard d'un poste (du moins au plus avancé).
NIVEAUX_CARRIERE = ["Junior", "Opérationnel", "Confirmé", "Senior"]


class Metier(Base):
    """Métier du référentiel (regroupe des postes et des trajectoires).
    `id_departement` (optionnel) permet de scoper l'accès des managers à leur périmètre."""
    __tablename__ = "metier"
    id_metier: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nom: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    missions: Mapped[str | None] = mapped_column(Text, nullable=True)
    responsabilites: Mapped[str | None] = mapped_column(Text, nullable=True)
    id_departement: Mapped[int | None] = mapped_column(
        ForeignKey("departement.id_departement"), nullable=True, index=True)

    def to_dict(self) -> dict:
        return {"id": self.id_metier, "nom": self.nom, "description": self.description,
                "missions": self.missions, "responsabilites": self.responsabilites,
                "id_departement": self.id_departement}


class Competence(Base):
    """Compétence du référentiel (hard / soft), avec méthode d'évaluation."""
    __tablename__ = "competence"
    id_competence: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nom: Mapped[str] = mapped_column(String(120), index=True)
    categorie: Mapped[str] = mapped_column(String(10))  # "hard" / "soft"
    sous_categorie: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    methode_evaluation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    proposee: Mapped[bool] = mapped_column(Boolean, default=False)  # proposée par un collaborateur

    def to_dict(self) -> dict:
        return {"id": self.id_competence, "nom": self.nom, "categorie": self.categorie,
                "sous_categorie": self.sous_categorie, "description": self.description,
                "methode_evaluation": self.methode_evaluation, "proposee": bool(self.proposee)}


class CompetenceRequise(Base):
    """Niveau de maîtrise attendu d'une compétence pour un métier à un niveau donné
    (= la « fiche de poste par niveau »)."""
    __tablename__ = "competence_requise"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_metier: Mapped[int] = mapped_column(ForeignKey("metier.id_metier"), index=True)
    niveau: Mapped[str] = mapped_column(String(20))  # Junior..Expert
    id_competence: Mapped[int] = mapped_column(ForeignKey("competence.id_competence"), index=True)
    niveau_attendu: Mapped[int] = mapped_column(Integer)  # 1..5

    competence: Mapped[Competence] = relationship()

    def to_dict(self) -> dict:
        c = self.competence
        return {"id": self.id, "id_metier": self.id_metier, "niveau": self.niveau,
                "id_competence": self.id_competence, "niveau_attendu": self.niveau_attendu,
                "competence": c.nom if c else None,
                "categorie": c.categorie if c else None,
                "sous_categorie": c.sous_categorie if c else None}


class EvaluationCompetence(Base):
    """Évaluation d'une compétence pour un collaborateur : auto-évaluation (1-5) puis
    validation par un expert/manager/RH (niveau officiel)."""
    __tablename__ = "evaluation_competence"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)
    id_competence: Mapped[int] = mapped_column(ForeignKey("competence.id_competence"), index=True)
    niveau_auto: Mapped[int | None] = mapped_column(Integer, nullable=True)     # auto-éval 1-5
    niveau_expert: Mapped[int | None] = mapped_column(Integer, nullable=True)   # validé 1-5
    statut: Mapped[str] = mapped_column(String(12), default="auto")             # auto / valide
    commentaire: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluateur: Mapped[str | None] = mapped_column(String(120), nullable=True)
    date_evaluation: Mapped[date] = mapped_column(Date, index=True)

    competence: Mapped[Competence] = relationship()

    def to_dict(self) -> dict:
        c = self.competence
        niveau = self.niveau_expert if self.niveau_expert is not None else self.niveau_auto
        return {"id": self.id, "employee_id": self.matricule, "id_competence": self.id_competence,
                "competence": c.nom if c else None, "categorie": c.categorie if c else None,
                "niveau_auto": self.niveau_auto, "niveau_expert": self.niveau_expert,
                "niveau": niveau, "statut": self.statut, "commentaire": self.commentaire,
                "evaluateur": self.evaluateur,
                "date_evaluation": self.date_evaluation.isoformat() if self.date_evaluation else None}


# ───────────────────────── Objectifs (OKR) & Bilans ─────────────────────────
class Objectif(Base):
    """Objectif trimestriel (OKR) d'un collaborateur — projet ou développement."""
    __tablename__ = "objectif"
    id_objectif: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)
    periode: Mapped[str] = mapped_column(String(12), index=True)   # ex. 2026-Q2
    type_obj: Mapped[str] = mapped_column(String(20))              # projet / developpement
    titre: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    statut: Mapped[str] = mapped_column(String(12), default="actif")  # actif / clos
    groupe_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)  # objectif partagé (multi-collab)
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    key_results: Mapped[list[KeyResult]] = relationship(
        back_populates="objectif", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        krs = list(self.key_results or [])
        taux = round(sum(k.progression or 0 for k in krs) / len(krs)) if krs else 0
        return {"id": self.id_objectif, "employee_id": self.matricule, "periode": self.periode,
                "type": self.type_obj, "titre": self.titre, "description": self.description,
                "statut": self.statut, "taux_realisation": taux,
                "groupe_id": self.groupe_id, "partage": bool(self.groupe_id),
                "key_results": [k.to_dict() for k in krs],
                "date_creation": self.date_creation.isoformat() if self.date_creation else None}


class KeyResult(Base):
    """Résultat clé mesurable d'un objectif (progression 0-100 %)."""
    __tablename__ = "key_result"
    id_kr: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_objectif: Mapped[int] = mapped_column(ForeignKey("objectif.id_objectif"), index=True)
    libelle: Mapped[str] = mapped_column(String(200))
    cible: Mapped[str | None] = mapped_column(String(80), nullable=True)
    progression: Mapped[int] = mapped_column(Integer, default=0)  # 0-100

    objectif: Mapped[Objectif] = relationship(back_populates="key_results")

    def to_dict(self) -> dict:
        return {"id": self.id_kr, "id_objectif": self.id_objectif, "libelle": self.libelle,
                "cible": self.cible, "progression": self.progression}


class Bilan(Base):
    """Bilan trimestriel ou de fin de projet d'un collaborateur."""
    __tablename__ = "bilan"
    id_bilan: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)
    type_bilan: Mapped[str] = mapped_column(String(20))   # trimestriel / projet
    periode: Mapped[str] = mapped_column(String(40))
    synthese: Mapped[str | None] = mapped_column(Text, nullable=True)
    points_forts: Mapped[str | None] = mapped_column(Text, nullable=True)
    axes_amelioration: Mapped[str | None] = mapped_column(Text, nullable=True)
    aspirations: Mapped[str | None] = mapped_column(Text, nullable=True)
    auteur: Mapped[str | None] = mapped_column(String(120), nullable=True)
    date_bilan: Mapped[date] = mapped_column(Date, index=True)

    def to_dict(self) -> dict:
        return {"id": self.id_bilan, "employee_id": self.matricule, "type": self.type_bilan,
                "periode": self.periode, "synthese": self.synthese, "points_forts": self.points_forts,
                "axes_amelioration": self.axes_amelioration, "aspirations": self.aspirations,
                "auteur": self.auteur,
                "date_bilan": self.date_bilan.isoformat() if self.date_bilan else None}


# ───────────────────────── Humeur / climat (engagement hebdo) ─────────────────────────
class Humeur(Base):
    """Humeur hebdomadaire VOLONTAIRE d'un collaborateur (1 insatisfait / 2 neutre / 3 satisfait).

    Éthique (loi 09-08, §4.1) : exploitée UNIQUEMENT de façon agrégée/anonymisée pour le
    climat social ; jamais exposée nominativement aux managers. Une saisie par semaine ISO."""
    __tablename__ = "humeur"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)
    semaine: Mapped[str] = mapped_column(String(8), index=True)  # ex. 2026-W26
    niveau: Mapped[int] = mapped_column(Integer)                 # 1 / 2 / 3
    commentaire: Mapped[str | None] = mapped_column(Text, nullable=True)
    anonyme: Mapped[bool] = mapped_column(Boolean, default=True)  # commentaire anonyme (défaut) ou nominatif (consentement)
    date_saisie: Mapped[date] = mapped_column(Date, index=True)

    def to_dict(self) -> dict:
        return {"id": self.id, "semaine": self.semaine, "niveau": self.niveau,
                "commentaire": self.commentaire, "anonyme": bool(self.anonyme),
                "date_saisie": self.date_saisie.isoformat() if self.date_saisie else None}


# ───────────────────────── Demandes RH ─────────────────────────
class Demande(Base):
    """Demande RH générique. Les ABSENCES sont des demandes dont le
    code_type appartient aux types d'absence (CONGE, MALADIE, TELETRAVAIL...)."""
    __tablename__ = "demande"
    __table_args__ = (
        CheckConstraint(
            "statut IN ('pending','validated','refused')", name="ck_demande_statut"
        ),
    )
    id_demande: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    date_depot: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    date_debut: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_fin: Mapped[date | None] = mapped_column(Date, nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    statut: Mapped[str] = mapped_column(String(12), default="pending", index=True)
    date_decision: Mapped[date | None] = mapped_column(Date, nullable=True)
    commentaire: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Cycle de vie spécifique aux tickets (code_type=TICKET_ASSISTANCE) : Nouveau/En cours/Résolu.
    ticket_statut: Mapped[str | None] = mapped_column(String(20), nullable=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)
    code_type: Mapped[str] = mapped_column(ForeignKey("type_demande.code_type"), index=True)
    id_decideur: Mapped[int | None] = mapped_column(
        ForeignKey("utilisateur.id_utilisateur"), nullable=True
    )

    employe: Mapped[Employe] = relationship(back_populates="demandes", foreign_keys=[matricule])
    type: Mapped[TypeDemande] = relationship()


# ───────────────────────── Documents ─────────────────────────
class Document(Base):
    __tablename__ = "document"
    id_document: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nom_fichier: Mapped[str] = mapped_column(String(255))
    type_doc: Mapped[str | None] = mapped_column(String(40), nullable=True)  # type métier du document
    contenu: Mapped[str | None] = mapped_column(Text, nullable=True)  # corps éditable (brouillon)
    cle_minio: Mapped[str | None] = mapped_column(String(255), unique=True)
    statut: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    date_validation: Mapped[date | None] = mapped_column(Date, nullable=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)
    code_modele: Mapped[str | None] = mapped_column(
        ForeignKey("modele_document.code_modele"), nullable=True
    )
    id_valideur: Mapped[int | None] = mapped_column(
        ForeignKey("utilisateur.id_utilisateur"), nullable=True
    )


# ───────────────────────── Parcours (on/offboarding) ─────────────────────────
class TacheParcours(Base):
    __tablename__ = "tache_parcours"
    id_tache: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    statut: Mapped[str] = mapped_column(String(20), default="todo", index=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)  # tâche cochée/terminée
    date_echeance: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_realisation: Mapped[date | None] = mapped_column(Date, nullable=True)
    code_tache: Mapped[str] = mapped_column(ForeignKey("modele_tache.code_tache"), index=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)

    modele: Mapped[ModeleTache] = relationship()


# ───────────────────────── Chat : sessions + messages persistés ─────────────────────────
def _uuid() -> str:
    return uuid.uuid4().hex


class ChatSession(Base):
    """Session de conversation persistée (historique des chats)."""
    __tablename__ = "chat_sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    id_utilisateur: Mapped[int] = mapped_column(ForeignKey("utilisateur.id_utilisateur"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="Nouvelle conversation")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChatMessage(Base):
    """Message d'une session de chat (rôle user/assistant + métadonnées de pipeline)."""
    __tablename__ = "chat_messages"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("chat_sessions.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))           # 'user' | 'assistant'
    content: Mapped[str] = mapped_column(Text)
    mode: Mapped[str | None] = mapped_column(String(20), nullable=True)  # rag | general | refusal
    sources: Mapped[list | None] = mapped_column(JSON, nullable=True)    # documents sources si RAG
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ───────────────────────── IA ─────────────────────────
class ConversationIA(Base):
    """Fil de conversation avec l'assistant : regroupe N interactions (historique)."""
    __tablename__ = "conversation_ia"
    id_conversation: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    titre: Mapped[str] = mapped_column(String(160))
    archivee: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    date_maj: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    id_utilisateur: Mapped[int] = mapped_column(ForeignKey("utilisateur.id_utilisateur"), index=True)


class InteractionIA(Base):
    __tablename__ = "interaction_ia"
    id_interaction: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    prompt: Mapped[str] = mapped_column(Text)
    reponse: Mapped[str | None] = mapped_column(Text, nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(60), nullable=True)
    statut: Mapped[str] = mapped_column(String(20), default="ok")
    sensible: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    id_utilisateur: Mapped[int] = mapped_column(ForeignKey("utilisateur.id_utilisateur"), index=True)
    # Rattachement à un fil de conversation (historique). Nullable : compat. existant.
    id_conversation: Mapped[int | None] = mapped_column(
        ForeignKey("conversation_ia.id_conversation"), nullable=True, index=True
    )

    sources: Mapped[list[Document]] = relationship(secondary="source_ia")


class SourceIA(Base):
    """Table d'association N:M (« s'appuie sur ») — clé composée."""
    __tablename__ = "source_ia"
    id_interaction: Mapped[int] = mapped_column(
        ForeignKey("interaction_ia.id_interaction"), primary_key=True
    )
    id_document: Mapped[int] = mapped_column(ForeignKey("document.id_document"), primary_key=True)


# ───────────────────────── Pilotage / Audit ─────────────────────────
class Alerte(Base):
    __tablename__ = "alerte"
    id_alerte: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    categorie: Mapped[str] = mapped_column(String(40), index=True)
    gravite: Mapped[str] = mapped_column(String(20), index=True)  # low / mid / high
    message: Mapped[str] = mapped_column(Text)
    confidentielle: Mapped[bool] = mapped_column(Boolean, default=False)
    lue: Mapped[bool] = mapped_column(Boolean, default=False)
    resolue: Mapped[bool] = mapped_column(Boolean, default=False)
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    date_resolution: Mapped[date | None] = mapped_column(Date, nullable=True)
    id_destinataire: Mapped[int | None] = mapped_column(
        ForeignKey("utilisateur.id_utilisateur"), nullable=True, index=True
    )
    matricule: Mapped[str | None] = mapped_column(
        ForeignKey("employe.matricule"), nullable=True, index=True
    )
    id_resolveur: Mapped[int | None] = mapped_column(
        ForeignKey("utilisateur.id_utilisateur"), nullable=True
    )


# ───────────────────────── Actualités / Annonces ─────────────────────────
class Annonce(Base):
    """Annonce publiée par le RH à destination d'une sélection de collaborateurs."""
    __tablename__ = "annonce"
    id_annonce: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    titre: Mapped[str] = mapped_column(String(160))
    contenu: Mapped[str] = mapped_column(Text)
    auteur: Mapped[str | None] = mapped_column(String(120), nullable=True)
    epingle: Mapped[bool] = mapped_column(Boolean, default=False)            # mise en avant
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    destinataires: Mapped[list[AnnonceDestinataire]] = relationship(
        back_populates="annonce", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        dests = list(self.destinataires or [])
        return {"id": self.id_annonce, "titre": self.titre, "contenu": self.contenu,
                "auteur": self.auteur, "epingle": bool(self.epingle),
                "nb_destinataires": len(dests), "nb_lus": sum(1 for d in dests if d.lu),
                "date_creation": self.date_creation.isoformat() if self.date_creation else None}


class AnnonceDestinataire(Base):
    """Destinataire d'une annonce + suivi de lecture individuel."""
    __tablename__ = "annonce_destinataire"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_annonce: Mapped[int] = mapped_column(ForeignKey("annonce.id_annonce"), index=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)
    lu: Mapped[bool] = mapped_column(Boolean, default=False)

    annonce: Mapped[Annonce] = relationship(back_populates="destinataires")


class ScoreRisque(Base):
    __tablename__ = "score_risque"
    id_score: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String(30))  # desengagement / burnout
    valeur: Mapped[float] = mapped_column(Numeric(10, 2))
    niveau: Mapped[str] = mapped_column(String(10))  # low / mid / high
    date_calcul: Mapped[date] = mapped_column(Date, index=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)


class IndicateurRH(Base):
    __tablename__ = "indicateur_rh"
    id_indicateur: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String(40), index=True)  # turnover / absenteisme / engagement
    valeur: Mapped[float] = mapped_column(Numeric(10, 2))
    periode: Mapped[str] = mapped_column(String(20))  # ex. 2026-Q2
    date_calcul: Mapped[date] = mapped_column(Date)
    id_departement: Mapped[int | None] = mapped_column(
        ForeignKey("departement.id_departement"), nullable=True, index=True
    )


class JournalAudit(Base):
    __tablename__ = "journal_audit"
    id_log: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    type_entite: Mapped[str | None] = mapped_column(String(40), nullable=True)
    id_entite: Mapped[str | None] = mapped_column(String(64), nullable=True)
    changements: Mapped[str | None] = mapped_column(Text, nullable=True)  # diff JSON
    adresse_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    id_utilisateur: Mapped[int | None] = mapped_column(
        ForeignKey("utilisateur.id_utilisateur"), nullable=True, index=True
    )


# ───────────────────────── Pont vers les shapes du front ─────────────────────────
def _employe_to_dict(self: Employe) -> dict:
    u = self.utilisateur
    return {
        "id": self.matricule,            # le front lit `id`
        "matricule": self.matricule,
        "prenom": self.prenom,
        "nom": self.nom,
        "poste": self.poste,
        "status": self.statut,           # le front lit `status`
        "email": u.email if u else None,
        "role": (u.role.code_role if (u and u.role) else None),
        "department_id": self.id_departement,
        "department": self.department.nom if self.department else None,
        "manager_matricule": self.matricule_manager,
        "manager_nom": (f"{self.manager.prenom} {self.manager.nom}" if self.manager else None),
        "date_embauche": self.date_embauche.isoformat() if self.date_embauche else None,
        "date_naissance": self.date_naissance.isoformat() if self.date_naissance else None,
        "site": self.site,
        "type_contrat": self.type_contrat,
        "genre": self.genre,
        "telephone": self.telephone,
        "bio": self.bio,
        "photo": self.photo,
    }


def _demande_to_dict(self: Demande) -> dict:
    """Sérialise une demande (format « absence »-compatible, enrichi)."""
    return {
        "id": self.id_demande,
        "employee_id": self.matricule,
        "type": self.type.libelle if self.type else self.code_type,
        "type_code": self.code_type,
        "start_date": self.date_debut.isoformat() if self.date_debut else None,
        "end_date": self.date_fin.isoformat() if self.date_fin else None,
        "status": self.statut,
        "ticket_statut": self.ticket_statut,
        "reason": self.detail,
        "commentaire": self.commentaire,
        "date_decision": self.date_decision.isoformat() if self.date_decision else None,
        "date_depot": self.date_depot.isoformat() if self.date_depot else None,
    }


def _modele_tache_to_dict(self: ModeleTache) -> dict:
    return {
        "code": self.code_tache, "libelle": self.libelle,
        "type_parcours": self.type_parcours, "ordre": self.ordre,
        "delai_jours": self.delai_jours,
    }


def _tache_to_dict(self: TacheParcours) -> dict:
    m = self.modele
    return {
        "id": self.id_tache,
        "employee_id": self.matricule,
        "code_tache": self.code_tache,
        "libelle": m.libelle if m else None,
        "type_parcours": m.type_parcours if m else None,
        "ordre": m.ordre if m else None,
        "status": self.statut,
        "completed": bool(self.completed),
        "date_echeance": self.date_echeance.isoformat() if self.date_echeance else None,
        "date_realisation": self.date_realisation.isoformat() if self.date_realisation else None,
    }


Employe.to_dict = _employe_to_dict
Demande.to_dict = _demande_to_dict
ModeleTache.to_dict = _modele_tache_to_dict
TacheParcours.to_dict = _tache_to_dict


def _document_to_dict(self: Document) -> dict:
    return {
        "id": self.id_document,
        "employee_id": self.matricule,
        "nom_fichier": self.nom_fichier,
        "type": self.type_doc,
        "contenu": self.contenu,
        "code_modele": self.code_modele,
        "statut": self.statut,
        "cle_minio": self.cle_minio,
        "date_creation": self.date_creation.isoformat() if self.date_creation else None,
        "date_validation": self.date_validation.isoformat() if self.date_validation else None,
        "valideur_id": self.id_valideur,
    }


def _modele_document_to_dict(self: ModeleDocument) -> dict:
    import json
    gabarit = self.gabarit
    is_binary = False
    format_doc = None
    filename = None
    if gabarit and gabarit.strip().startswith("{"):
        try:
            parsed = json.loads(gabarit)
            if parsed.get("is_binary"):
                is_binary = True
                format_doc = parsed.get("format")
                filename = parsed.get("filename")
                # Ne pas renvoyer le lourd gabarit (qui contient content_b64)
                gabarit = None
        except Exception:
            pass

    return {
        "code": self.code_modele, "libelle": self.libelle,
        "categorie": self.categorie, "gabarit": gabarit,
        "is_binary": is_binary, "format": format_doc, "filename": filename,
        "actif": bool(self.actif) if self.actif is not None else True,
    }


def _score_to_dict(self: ScoreRisque) -> dict:
    return {
        "id": self.id_score, "employee_id": self.matricule, "type": self.type,
        "valeur": float(self.valeur) if self.valeur is not None else None,
        "niveau": self.niveau,
        "date_calcul": self.date_calcul.isoformat() if self.date_calcul else None,
    }


def _indicateur_to_dict(self: IndicateurRH) -> dict:
    return {
        "id": self.id_indicateur, "type": self.type,
        "valeur": float(self.valeur) if self.valeur is not None else None,
        "periode": self.periode, "department_id": self.id_departement,
        "date_calcul": self.date_calcul.isoformat() if self.date_calcul else None,
    }


Document.to_dict = _document_to_dict
ModeleDocument.to_dict = _modele_document_to_dict
ScoreRisque.to_dict = _score_to_dict
IndicateurRH.to_dict = _indicateur_to_dict
