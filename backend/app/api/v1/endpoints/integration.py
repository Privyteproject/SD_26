"""API ouverte / Intégration SIRH (monté sous /webhooks).

Routes serveur-à-serveur sécurisées par une CLÉ API (header X-API-Key), distincte
des jetons utilisateurs. Permet à un SIRH/logiciel de paie externe de pousser des
mises à jour (ex. salaires) vers la plateforme.
"""

from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope
from app.schemas.hr import SirhSyncRequest

router = APIRouter()


def require_api_key(x_api_key: str = Header(None, alias="X-API-Key")):
    """Authentification serveur-à-serveur par clé API (≠ JWT utilisateur)."""
    if not x_api_key or x_api_key != settings.SIRH_API_KEY:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Clé API invalide ou manquante")
    return True


@router.post("/external-sirh/sync")
def sirh_sync(payload: SirhSyncRequest, _: bool = Depends(require_api_key), db: Session = Depends(get_db)):
    """Synchronise les salaires depuis un SIRH externe : ajoute une ligne d'historique
    par employé. Payload : { updates: [{ matricule, nouveau_salaire, date?, motif? }] }."""
    from app.db.models import HistoriqueSalaire
    updated, errors = 0, []
    for up in payload.updates:
        if repo.get_employee(db, up.matricule) is None:
            errors.append({"matricule": up.matricule, "error": "employé introuvable"})
            continue
        db.add(HistoriqueSalaire(matricule=up.matricule, montant=up.nouveau_salaire,
                                 date_effet=up.date or date.today(), motif=up.motif or "SIRH"))
        updated += 1
    db.commit()
    return envelope({"updated": updated, "errors": errors}, meta={"received": len(payload.updates)})
