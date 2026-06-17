"""Schémas Pydantic des corps de requête.

Les noms de champs (`prenom`, `nom`, `email`, `status`, `department_id`)
correspondent à ce que le front lit dans `SessionProvider.buildUserFromApi`.
"""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

# Cf. front lib/constants.js
Role = Literal["COLLABORATEUR", "MANAGER", "RH", "DIRECTION", "ADMIN", "MEDECINE"]
EmployeeStatus = Literal["NEW", "ACTIVE", "LEAVING"]
AbsenceStatus = Literal["pending", "validated", "refused"]


class EmployeeCreate(BaseModel):
    prenom: str = Field(..., min_length=1)
    nom: str = Field(..., min_length=1)
    email: EmailStr
    password: Optional[str] = None
    role: Role = "COLLABORATEUR"
    status: EmployeeStatus = "ACTIVE"
    department_id: Optional[str] = None
    poste: Optional[str] = None


class EmployeeUpdate(BaseModel):
    prenom: Optional[str] = Field(None, min_length=1)
    nom: Optional[str] = Field(None, min_length=1)
    email: Optional[EmailStr] = None
    role: Optional[Role] = None
    status: Optional[EmployeeStatus] = None
    department_id: Optional[str] = None
    poste: Optional[str] = None


class AbsenceCreate(BaseModel):
    employee_id: Optional[str] = None  # défaut = utilisateur courant
    type: str = Field(..., min_length=1)  # ex. "Congé payé", "Maladie", "Télétravail"
    start_date: date
    end_date: date
    reason: Optional[str] = None


class AbsenceStatusUpdate(BaseModel):
    status: AbsenceStatus


# --- Demandes génériques ---
class DemandeCreate(BaseModel):
    code_type: str = Field(..., min_length=1)        # ex. CONGE, ATTESTATION...
    employee_id: Optional[str] = None                # matricule (défaut: soi-même)
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    detail: Optional[str] = None


class DemandeStatusUpdate(BaseModel):
    status: AbsenceStatus                            # pending/validated/refused
    commentaire: Optional[str] = None


# --- Parcours (onboarding/offboarding) ---
ParcoursType = Literal["ONBOARDING", "OFFBOARDING"]
TacheStatus = Literal["todo", "in_progress", "done"]


class ParcoursInit(BaseModel):
    type_parcours: ParcoursType


class TacheStatusUpdate(BaseModel):
    status: TacheStatus
    date_realisation: Optional[date] = None


class TacheCreate(BaseModel):
    """Tâche personnalisée ajoutée au parcours d'un employé."""
    libelle: str = Field(..., min_length=1)
    type_parcours: ParcoursType
    date_echeance: Optional[date] = None


class ModeleTacheCreate(BaseModel):
    """Modèle de tâche par défaut (gabarit appliqué aux nouveaux parcours)."""
    libelle: str = Field(..., min_length=1)
    type_parcours: ParcoursType
    ordre: Optional[int] = 0
    delai_jours: Optional[int] = None


class ModeleTacheUpdate(BaseModel):
    libelle: Optional[str] = Field(None, min_length=1)
    ordre: Optional[int] = None
    delai_jours: Optional[int] = None


# --- Documents ---
class DocumentCreate(BaseModel):
    code_modele: Optional[str] = None
    employee_id: Optional[str] = None      # matricule (défaut: soi-même)
    nom_fichier: Optional[str] = None
    contenu: Optional[str] = None          # corps initial (sinon généré par défaut)


class DocumentUpdate(BaseModel):
    nom_fichier: Optional[str] = None
    contenu: Optional[str] = None


class ModeleDocumentCreate(BaseModel):
    libelle: str = Field(..., min_length=1)
    categorie: Optional[str] = None
    gabarit: Optional[str] = None


class ModeleDocumentUpdate(BaseModel):
    libelle: Optional[str] = Field(None, min_length=1)
    categorie: Optional[str] = None
    gabarit: Optional[str] = None
    actif: Optional[bool] = None


class DocumentStatusUpdate(BaseModel):
    # Accepte le vocabulaire interne (validated/refused) ET celui de la spec (valide/refuse).
    status: Literal["validated", "refused", "valide", "refuse"]
    comment: Optional[str] = None


class DocumentPreviewRequest(BaseModel):
    type: str = Field(..., min_length=1)
    employee_id: Optional[str] = None          # matricule (défaut: soi-même)
    additional_data: dict = Field(default_factory=dict)


class DocumentSubmitRequest(BaseModel):
    preview_token: str = Field(..., min_length=1)


# --- RAG / ingestion documentaire ---
class RagChunk(BaseModel):
    title: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    audience: list[str] = Field(default_factory=lambda: ["ALL"])
    id: Optional[str] = None


class RagIngest(BaseModel):
    documents: list[RagChunk] = Field(..., min_length=1)
