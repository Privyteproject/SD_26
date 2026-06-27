"""Endpoints Employés (montés sous /employees).

La route littérale /me est déclarée AVANT /{employee_id} : "me" n'est donc
jamais capturé comme identifiant (et l'id est typé int).
"""

import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import (
    RH_SPACE_ROLES,
    ROLE_ADMIN,
    CurrentUser,
    get_current_user,
    require_roles,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope
from app.schemas.hr import EmployeeCreate, EmployeeUpdate
from app.services.keycloak_service import (
    create_user_in_keycloak,
    delete_user_in_keycloak,
    update_user_in_keycloak,
)

router = APIRouter()

_MANAGE = require_roles(ROLE_ADMIN, "RH", "DIRECTION")
_READ = require_roles(ROLE_ADMIN, *RH_SPACE_ROLES)


@router.get("/me")
def read_me(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Profil de l'utilisateur connecté (résolu via l'email du JWT)."""
    emp = repo.find_employee_by_email(db, user.email)
    
    # Synchronisation Keycloak -> App (Lazy Sync)
    if emp is None:
        # L'utilisateur existe dans Keycloak mais pas encore dans notre base locale.
        # On le crée à la volée.
        prenom = (user.name.split(" ")[0] if user.name else "Inconnu")
        nom = " ".join(user.name.split(" ")[1:]) if user.name and " " in user.name else "Inconnu"
        
        new_emp_data = {
            "email": user.email,
            "prenom": prenom,
            "nom": nom,
            "role": user.role,
            "status": "ACTIVE"
        }
        emp = repo.create_employee(db, new_emp_data)
        
    data = {**emp.to_dict(), "role": user.role}  # rôle = JWT (source de vérité)
    return envelope(data)


class MyProfileUpdate(BaseModel):
    """Champs personnels que le collaborateur peut modifier lui-même (pas son rôle/poste/statut)."""
    telephone: str | None = Field(None, max_length=40)
    bio: str | None = Field(None, max_length=2000)
    photo: str | None = None          # data URL (image base64) ou null pour retirer


@router.patch("/me")
def update_me(payload: MyProfileUpdate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Mise à jour des informations PERSONNELLES de l'utilisateur connecté (téléphone, bio, photo)."""
    emp = repo.find_employee_by_email(db, user.email)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Profil introuvable")
    patch = payload.model_dump(exclude_unset=True)
    photo = patch.get("photo")
    if photo:
        if not photo.startswith("data:image/"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Format d'image invalide")
        if len(photo) > 3_000_000:   # ~2 Mo d'image encodée
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image trop volumineuse (max ~2 Mo)")
    emp = repo.update_my_profile(db, emp.matricule, patch)
    return envelope({**emp.to_dict(), "role": user.role})


@router.get("")
def list_employees(
    search: str | None = Query(None),
    role: str | None = Query(None),
    status_: str | None = Query(None, alias="status"),
    department_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(_READ),
    db: Session = Depends(get_db),
):
    # RBAC périmètre : un MANAGER ne voit QUE son département (jamais les autres collaborateurs)
    if user.role == "MANAGER":
        emp = repo.find_employee_by_email(db, user.email)
        if emp and emp.id_departement:
            department_id = str(emp.id_departement)
        else:
            # Manager sans département rattaché : aucun périmètre → liste vide (pas d'accès global).
            return envelope([], meta={"total": 0, "page": page, "page_size": page_size})

    rows = repo.list_employees(db, search=search, role=role, status=status_, department_id=department_id)
    total = len(rows)
    start = (page - 1) * page_size
    page_rows = [e.to_dict() for e in rows[start : start + page_size]]
    return envelope(page_rows, meta={"total": total, "page": page, "page_size": page_size})


@router.post("", status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate, _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)
):
    emp = repo.create_employee(db, payload.model_dump())
    
    # Synchronisation App -> Keycloak
    create_user_in_keycloak(
        email=payload.email,
        first_name=payload.prenom,
        last_name=payload.nom,
        role=payload.role,
        password=payload.password
    )
    
    return envelope(emp.to_dict())


@router.post("/import")
def import_employees(
    file: UploadFile = File(...), _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)
):
    """Import en masse d'employés via CSV (colonnes : email, prenom, nom, role?, status?,
    poste?, department_id?, password?). Réservé RH/Admin. Chaque ligne est traitée en
    transaction isolée : une erreur (ex. e-mail déjà pris) n'interrompt pas l'import."""
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Fichier .csv attendu")
    text = file.file.read().decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    created, errors = 0, []
    for i, raw in enumerate(reader, start=2):  # ligne 1 = en-tête
        row = {(k or "").strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in raw.items()}
        email = row.get("email")
        prenom = row.get("prenom") or row.get("prénom")
        nom = row.get("nom")
        if not email or not prenom or not nom:
            errors.append({"line": i, "error": "email, prenom et nom sont requis"})
            continue
        data = {
            "email": email, "prenom": prenom, "nom": nom,
            "role": (row.get("role") or "COLLABORATEUR").upper(),
            "status": (row.get("status") or "ACTIVE").upper(),
            "poste": row.get("poste"),
            "department_id": row.get("department_id") or row.get("departement"),
        }
        try:
            repo.create_employee(db, data)  # crée Utilisateur + Employe (commit interne)
        except Exception as exc:
            db.rollback()
            errors.append({"line": i, "error": str(exc)[:120]})
            continue
        try:  # propagation Keycloak best-effort
            create_user_in_keycloak(email=email, first_name=prenom, last_name=nom,
                                    role=data["role"], password=row.get("password"))
        except Exception:
            pass
        created += 1
    return envelope({"created": created, "errors": errors},
                    meta={"created": created, "failed": len(errors)})


@router.get("/{employee_id}")
def get_employee(employee_id: str, _: CurrentUser = Depends(_READ), db: Session = Depends(get_db)):
    emp = repo.get_employee(db, employee_id)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    return envelope(emp.to_dict())


@router.put("/{employee_id}")
def update_employee(
    employee_id: str, payload: EmployeeUpdate,
    _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)

    # Email courant AVANT mise à jour (sert à localiser le compte Keycloak).
    existing = repo.get_employee(db, employee_id)
    old_email = existing.utilisateur.email if (existing and existing.utilisateur) else None

    emp = repo.update_employee(db, employee_id, data)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")

    # Synchronisation App -> Keycloak (best-effort, n'interrompt pas la réponse).
    if old_email:
        update_user_in_keycloak(
            email=old_email,
            first_name=data.get("prenom"),
            last_name=data.get("nom"),
            role=data.get("role"),
            new_email=data.get("email"),
        )

    return envelope(emp.to_dict())


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str, _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)
):
    # Récupère l'email AVANT suppression pour propager à Keycloak.
    emp = repo.get_employee(db, employee_id)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    email = emp.utilisateur.email if emp.utilisateur else None

    if not repo.delete_employee(db, employee_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")

    if email:
        delete_user_in_keycloak(email)

    return envelope({"id": employee_id, "deleted": True})
