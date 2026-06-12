"""Endpoints Employés (montés sous /employees).

La route littérale /me est déclarée AVANT /{employee_id} : "me" n'est donc
jamais capturé comme identifiant (et l'id est typé int).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
from app.services.keycloak_service import create_user_in_keycloak

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


@router.get("")
def list_employees(
    search: str | None = Query(None),
    role: str | None = Query(None),
    status_: str | None = Query(None, alias="status"),
    department_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: CurrentUser = Depends(_READ),
    db: Session = Depends(get_db),
):
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
    emp = repo.update_employee(db, employee_id, payload.model_dump(exclude_unset=True))
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    return envelope(emp.to_dict())


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str, _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)
):
    if not repo.delete_employee(db, employee_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    return envelope({"id": employee_id, "deleted": True})
