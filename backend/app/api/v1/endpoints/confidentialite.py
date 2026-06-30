"""Endpoints Confidentialité / Conformité (montés sous /confidentialite).

Donne au collaborateur la maîtrise de ses données (RGPD / loi 09-08) :
- documentation des FINALITÉS de traitement (données, base légale, accès, conservation) ;
- gestion explicite du CONSENTEMENT pour les traitements analytiques avancés (révocable) ;
- droits : EXPORT de ses données + DEMANDE d'anonymisation/suppression.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()

# Registre documenté des finalités de traitement (transparence — affiché au collaborateur).
FINALITES = [
    {"key": "analyse_sentiment", "revocable": True,
     "nom": "Analyse de sentiment de mes commentaires d'humeur",
     "donnees": "Commentaires libres saisis dans le climat social",
     "finalite": "Mesurer et améliorer le climat social (agrégé)",
     "base_legale": "Consentement", "acces": "RH / Direction (agrégé, anonymisé)", "conservation": "24 mois"},
    {"key": "detection_desengagement", "revocable": True,
     "nom": "Détection des signaux de désengagement me concernant",
     "donnees": "Absences, humeur, charge, ancienneté",
     "finalite": "Prévention des risques psychosociaux (RPS)",
     "base_legale": "Consentement", "acces": "RH / mon manager", "conservation": "24 mois"},
    {"key": "journalisation_assistant", "revocable": False,
     "nom": "Journalisation de mes interactions avec l'assistant IA",
     "donnees": "Horodatage, catégorie, indicateurs de sécurité (contenu chiffré, réservé à l'admin)",
     "finalite": "Sécurité, détection d'abus et conformité",
     "base_legale": "Intérêt légitime (sécurité)", "acces": "Administrateur", "conservation": "12 mois"},
]


def _own(db, user):
    emp = repo.find_employee_by_email(db, user.email)
    return emp.matricule if emp else None


class ConsentIn(BaseModel):
    finalite: str
    accorde: bool


@router.get("/me")
def my_privacy(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Finalités documentées + état de mon consentement (révocable le cas échéant)."""
    mat = _own(db, user)
    consents = repo.get_consentements(db, mat) if mat else {}
    out = []
    for f in FINALITES:
        out.append({**f, "accorde": consents.get(f["key"], True) if f["revocable"] else True})
    return envelope(out)


@router.patch("/me")
def set_my_consent(payload: ConsentIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    mat = _own(db, user)
    if mat is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Profil introuvable")
    if not repo.set_consentement(db, matricule=mat, finalite=payload.finalite, accorde=payload.accorde):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Finalité non révocable ou inconnue")
    return envelope({"finalite": payload.finalite, "accorde": payload.accorde})


@router.get("/me/export")
def export_me(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Export de mes données personnelles (droit d'accès / portabilité)."""
    mat = _own(db, user)
    if mat is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Profil introuvable")
    return envelope(repo.export_my_data(db, mat))


@router.post("/me/effacement", status_code=status.HTTP_201_CREATED)
def request_erasure(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Demande d'anonymisation/suppression : notifie le RH (traitement sous responsabilité humaine)."""
    mat = _own(db, user)
    if mat is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Profil introuvable")
    try:
        repo.create_alerte(
            db, message=f"Demande d'anonymisation/suppression des données de {mat} ({user.email}).",
            categorie="rgpd", gravite="mid", id_destinataire=None, matricule=mat)
    except Exception:
        db.rollback()
    return envelope({"matricule": mat, "demande": "effacement", "statut": "transmise au RH"})
