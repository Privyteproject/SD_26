"""Prédictions ML (monté sous /predict).

- POST /predict/train          : (ré)entraîne les 3 Random Forest. RH/Direction/Admin.
- GET  /predict/risks/{matricule} : évalue turnover / absentéisme / mobilité en temps réel.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core import scope
from app.core.security import (
    ROLE_ADMIN, ROLE_DIRECTION, ROLE_MANAGER, ROLE_RH, CurrentUser, require_roles,
)
from app.db.base import get_db
from app.schemas.common import envelope
from app.services import ml_predictions

router = APIRouter()

# Analytique prédictive réservée au RH exécutif (ADMIN/RH/DIRECTION). EXCLUT la médecine du
# travail (périmètre bien-être, loi 09-08) et le manager (entraînement/scoring = opération globale).
# Gouvernance ML (entraînement, équité, scoring global) : RH/Direction + ADMIN (supervision §4.1).
_RH = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION)
# Prédictions INDIVIDUELLES nominatives (risques/plan d'un employé) : données RH -> PAS l'admin
# (technique/sécurité §2). RH/Direction (org) + manager (scopé équipe, vérif dans l'endpoint).
_RH_INDIV = require_roles(ROLE_RH, ROLE_DIRECTION)
_RH_OR_MANAGER = require_roles(ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER)


@router.post("/train")
def train_models(_: CurrentUser = Depends(_RH), db: Session = Depends(get_db)):
    try:
        return envelope(ml_predictions.train(db))
    except ModuleNotFoundError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="scikit-learn non installé sur le serveur")


@router.post("/batch")
def batch_score(_: CurrentUser = Depends(_RH), db: Session = Depends(get_db)):
    """Score TOUS les employés actifs en lot et met à jour la table ScoreRisque
    (bouton « Recalculer les risques » / job nocturne). RH/Direction/Médecine/Admin."""
    try:
        return envelope(ml_predictions.batch_score(db))
    except ModuleNotFoundError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="scikit-learn non installé sur le serveur")


@router.get("/scheduler-status")
def scheduler_status(_: CurrentUser = Depends(_RH)):
    """État de l'ordonnanceur (jobs périodiques : onboarding en retard + scoring ML)."""
    from app.services import scheduler
    return envelope(scheduler.status())


@router.get("/fairness")
def fairness(_: CurrentUser = Depends(_RH), db: Session = Depends(get_db)):
    """Contrôle d'équité (§4.1) : taux de prédiction « à risque » par groupe protégé
    (genre, âge, site, contrat) + disparate impact ratio (règle des 4/5)."""
    try:
        return envelope(ml_predictions.fairness_audit(db))
    except ModuleNotFoundError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="scikit-learn non installé sur le serveur")


@router.get("/action-plan/{matricule}")
def action_plan(matricule: str, user: CurrentUser = Depends(_RH_OR_MANAGER), db: Session = Depends(get_db)):
    """Plan d'action ciblé selon les risques prédits pour un employé.
    RH/Direction/Admin : tout employé. Manager : uniquement les membres de son équipe."""
    if user.role == ROLE_MANAGER and not scope.is_in_scope(db, user, matricule):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hors de votre périmètre d'équipe")
    res = ml_predictions.action_plan(db, matricule)
    if res is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    return envelope(res)


@router.get("/risks/{matricule}")
def predict_risks(matricule: str, _: CurrentUser = Depends(_RH_INDIV), db: Session = Depends(get_db)):
    try:
        res = ml_predictions.predict_for(db, matricule)
    except ModuleNotFoundError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="scikit-learn non installé sur le serveur")
    if res is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    return envelope(res)
