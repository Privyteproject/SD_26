"""API endpoints for bulk data imports."""

import csv
import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.session import get_db
from app.models.hr import Employee, Absence
from app.models.user import User
from app.schemas.base import StandardResponse
from app.schemas.employee import EmployeeCreate
from app.schemas.absence import AbsenceCreate

router = APIRouter()

def _decode_csv(file: UploadFile) -> list[dict[str, str]]:
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    # Read synchronously for simplicity in parsing
    content = file.file.read()
    try:
        decoded = content.decode('utf-8').splitlines()
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding. Must be UTF-8 CSV.")
    return list(csv.DictReader(decoded))


@router.post(
    "/employees",
    response_model=StandardResponse[dict[str, Any]],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Bulk import employees from CSV",
)
def import_employees(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> StandardResponse[dict[str, Any]]:
    """Bulk import employees from a CSV file. Requires RH or Admin role."""
    rows = _decode_csv(file)
    
    imported = 0
    errors = []
    
    for i, row in enumerate(rows, start=2):
        cin = row.get("cin", "").strip()
        if not cin:
            errors.append(f"Row {i}: Missing CIN")
            continue
            
        # Check if exists
        existing = db.query(Employee).filter(Employee.cin == cin).first()
        if existing:
            errors.append(f"Row {i}: Employee with CIN {cin} already exists")
            continue
            
        try:
            hire_date_str = row.get('hire_date', '').strip()
            hire_date = datetime.datetime.strptime(hire_date_str, '%Y-%m-%d').date() if hire_date_str else datetime.date.today()
            
            salary_str = row.get('salary', '').strip()
            salary = float(salary_str) if salary_str else None
            
            emp_data = {
                "first_name": row.get('first_name', 'Unknown').strip(),
                "last_name": row.get('last_name', 'Unknown').strip(),
                "position": row.get('position', 'Employee').strip(),
                "hire_date": hire_date,
                "status": row.get('status', 'active').strip(),
                "salary": salary,
                "address": row.get('address', '').strip() or None,
                "cin": cin
            }
            # Validate via Pydantic schema
            validated = EmployeeCreate(**emp_data)
            db.add(Employee(**validated.model_dump()))
            imported += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

    return StandardResponse(
        data={"filename": file.filename, "imported_count": imported, "errors": errors},
    )


@router.post(
    "/absences",
    response_model=StandardResponse[dict[str, Any]],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Bulk import absences from CSV",
)
def import_absences(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> StandardResponse[dict[str, Any]]:
    """Bulk import absences from a CSV file. Resolves employee by CIN."""
    rows = _decode_csv(file)
    
    imported = 0
    errors = []
    
    # Pre-fetch employees mapping by CIN for performance
    cins = {r.get("cin", "").strip() for r in rows if r.get("cin", "").strip()}
    employees = db.query(Employee.id, Employee.cin).filter(Employee.cin.in_(cins)).all()
    emp_map = {e.cin: e.id for e in employees}
    
    for i, row in enumerate(rows, start=2):
        cin = row.get("cin", "").strip()
        if not cin:
            errors.append(f"Row {i}: Missing CIN")
            continue
            
        emp_id = emp_map.get(cin)
        if not emp_id:
            errors.append(f"Row {i}: Employee with CIN {cin} not found")
            continue
            
        try:
            start_date = datetime.datetime.strptime(row.get('start_date', '').strip(), '%Y-%m-%d').date()
            end_date = datetime.datetime.strptime(row.get('end_date', '').strip(), '%Y-%m-%d').date()
            
            abs_data = {
                "employee_id": emp_id,
                "type": row.get('type', 'autre').strip(),
                "start_date": start_date,
                "end_date": end_date,
                "status": row.get('status', 'approved').strip()
            }
            # Validate via Pydantic
            validated = AbsenceCreate(**abs_data)
            db.add(Absence(**validated.model_dump()))
            imported += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

    return StandardResponse(
        data={"filename": file.filename, "imported_count": imported, "errors": errors},
    )
