"""Rapports RH (monté sous /rapports).

POST /rapports/generate : produit un rapport PDF (KPIs + alertes). RH/Direction/Admin.
"""

from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_DIRECTION, ROLE_RH, CurrentUser, require_roles
from app.db.base import get_db
from app.services import report_service

router = APIRouter()

_RH = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION)


@router.post("/generate")
def generate_report(_: CurrentUser = Depends(_RH), db: Session = Depends(get_db)):
    content, ctype = report_service.generate_pdf(db)
    ext = "pdf" if "pdf" in ctype else "txt"
    filename = f"rapport_rh_{date.today().isoformat()}.{ext}"
    return Response(content=content, media_type=ctype,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})
