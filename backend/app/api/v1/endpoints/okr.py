"""Endpoints Objectifs (OKR) & Bilans (montés sous /okr).

- Objectifs trimestriels (projet / développement) avec Key Results mesurables (progression %).
- Bilans trimestriels et de fin de projet.

RBAC : un collaborateur gère SES objectifs et met à jour ses Key Results ; la définition
pour un tiers, la clôture et les bilans relèvent des rôles élevés (Manager/RH/Direction/Admin).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN, ROLE_DIRECTION, ROLE_MANAGER, ROLE_RH,
    CurrentUser, get_current_user, require_roles,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()

_MANAGE = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER)
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER}


def _own(db, user):
    emp = repo.find_employee_by_email(db, user.email)
    return emp.matricule if emp else None


def _can(db, user, matricule):
    return user.role in _ELEVATED or matricule == _own(db, user)


class KRIn(BaseModel):
    libelle: str = Field(..., min_length=1, max_length=200)
    cible: str | None = None
    progression: int = Field(0, ge=0, le=100)


class ObjectifIn(BaseModel):
    employee_id: str | None = None          # ignoré pour un collaborateur (forcé sur lui-même)
    periode: str = Field(..., min_length=4, max_length=12)
    type: str = Field("projet")             # projet / developpement
    titre: str = Field(..., min_length=2, max_length=160)
    description: str | None = None
    key_results: list[KRIn] = []


class KRUpdate(BaseModel):
    progression: int | None = Field(None, ge=0, le=100)
    cible: str | None = None


class BilanIn(BaseModel):
    employee_id: str
    type: str = Field("trimestriel")        # trimestriel / projet
    periode: str
    synthese: str | None = None
    points_forts: str | None = None
    axes_amelioration: str | None = None
    aspirations: str | None = None


# ── Objectifs ──
@router.get("/{matricule}")
def list_objectifs(matricule: str, periode: str | None = Query(None),
                   user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not _can(db, user, matricule):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    rows = repo.list_objectifs(db, matricule, periode)
    return envelope([o.to_dict() for o in rows], meta={"total": len(rows)})


@router.post("", status_code=status.HTTP_201_CREATED)
def create_objectif(payload: ObjectifIn, user: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)):
    # Seul un rôle encadrant (manager/RH/direction/admin) peut fixer un objectif à un collaborateur.
    matricule = payload.employee_id
    if not matricule:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="employee_id requis")
    if repo.get_employee(db, matricule) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    type_obj = "developpement" if payload.type == "developpement" else "projet"
    o = repo.create_objectif(db, matricule=matricule, periode=payload.periode, type_obj=type_obj,
                             titre=payload.titre, description=payload.description,
                             key_results=[k.model_dump() for k in payload.key_results])
    return envelope(o.to_dict())


@router.patch("/kr/{id_kr}")
def update_kr(id_kr: int, payload: KRUpdate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.db.models import KeyResult
    kr = db.get(KeyResult, id_kr)
    if kr is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Key Result introuvable")
    obj = repo.get_objectif(db, kr.id_objectif)
    if obj is None or not _can(db, user, obj.matricule):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    kr = repo.update_key_result(db, id_kr, progression=payload.progression, cible=payload.cible)
    return envelope(kr.to_dict())


@router.patch("/{id_objectif}/status")
def set_status(id_objectif: int, statut: str = Query(...), _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)):
    o = repo.set_objectif_statut(db, id_objectif, "clos" if statut == "clos" else "actif")
    if o is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Objectif introuvable")
    return envelope(o.to_dict())


# ── Bilans ──
@router.get("/bilans/{matricule}")
def list_bilans(matricule: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not _can(db, user, matricule):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    rows = repo.list_bilans(db, matricule)
    return envelope([b.to_dict() for b in rows], meta={"total": len(rows)})


@router.post("/bilans", status_code=status.HTTP_201_CREATED)
def create_bilan(payload: BilanIn, user: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)):
    if repo.get_employee(db, payload.employee_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    b = repo.create_bilan(db, matricule=payload.employee_id,
                          type_bilan=("projet" if payload.type == "projet" else "trimestriel"),
                          periode=payload.periode, synthese=payload.synthese,
                          points_forts=payload.points_forts, axes_amelioration=payload.axes_amelioration,
                          aspirations=payload.aspirations, auteur=user.email)
    return envelope(b.to_dict())
