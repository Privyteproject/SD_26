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

from datetime import date, datetime

from sqlalchemy import (
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
    gabarit: Mapped[str | None] = mapped_column(Text, nullable=True)


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
    statut: Mapped[str] = mapped_column(String(10), default="ACTIVE", index=True)
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
    montant: Mapped[float] = mapped_column(Numeric(12, 2))
    date_effet: Mapped[date] = mapped_column(Date, index=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)


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
    cle_minio: Mapped[str | None] = mapped_column(String(255), unique=True)
    statut: Mapped[str] = mapped_column(String(20), default="pending", index=True)
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
    date_echeance: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_realisation: Mapped[date | None] = mapped_column(Date, nullable=True)
    code_tache: Mapped[str] = mapped_column(ForeignKey("modele_tache.code_tache"), index=True)
    matricule: Mapped[str] = mapped_column(ForeignKey("employe.matricule"), index=True)

    modele: Mapped[ModeleTache] = relationship()


# ───────────────────────── IA ─────────────────────────
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
        "code_modele": self.code_modele,
        "statut": self.statut,
        "cle_minio": self.cle_minio,
        "date_creation": self.date_creation.isoformat() if self.date_creation else None,
        "date_validation": self.date_validation.isoformat() if self.date_validation else None,
        "valideur_id": self.id_valideur,
    }


def _modele_document_to_dict(self: ModeleDocument) -> dict:
    return {"code": self.code_modele, "libelle": self.libelle}


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
