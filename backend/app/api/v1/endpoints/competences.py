"""Endpoints Carrières & Compétences (montés sous /competences).

- Référentiel : métiers, catalogue de compétences, compétences requises par niveau.
- Auto-évaluation du collaborateur (1-5 étoiles + commentaire + compétences personnalisées).
- Validation par expert/manager/RH (niveau officiel) + file de validation.
- Radar (attendu vs actuel) et trajectoire d'évolution.

RBAC : un collaborateur évalue/consulte SES compétences ; la validation et la vue des
autres collaborateurs sont réservées aux rôles élevés (RH/Manager/Direction/Admin).
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

# Gestion du référentiel (métiers/compétences) : RH = tout, manager = son périmètre.
_VALIDATE = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER)
# Confirmation des compétences d'un collaborateur : SEUL le manager (de son équipe) — pas le RH.
# L'admin reste superviseur global.
_CONFIRM = require_roles(ROLE_MANAGER, ROLE_ADMIN)
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER}


def _own_matricule(db, user):
    emp = repo.find_employee_by_email(db, user.email)
    return emp.matricule if emp else None


def _can_view(db, user, matricule) -> bool:
    """Qui peut consulter les compétences d'un collaborateur :
    - le collaborateur lui-même ;
    - RH / Direction / Admin : tout le monde ;
    - MANAGER : UNIQUEMENT les membres de son équipe (même département)."""
    if matricule == _own_matricule(db, user):
        return True
    if user.role in (ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION):
        return True
    if user.role == ROLE_MANAGER:
        emp = repo.get_employee(db, matricule)
        return bool(emp and emp.id_departement is not None and emp.id_departement == _mgr_dept(db, user))
    return False


def _mgr_dept(db, user):
    """Département du manager (None pour RH/Direction/Admin = accès global)."""
    if user.role == ROLE_MANAGER:
        emp = repo.find_employee_by_email(db, user.email)
        return emp.id_departement if emp else None
    return None


def _can_manage_metier(db, user, metier) -> bool:
    """RH/Direction/Admin : tout. Manager : uniquement les métiers de son département."""
    if user.role in (ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION):
        return True
    if user.role == ROLE_MANAGER:
        emp = repo.find_employee_by_email(db, user.email)
        return bool(emp and metier and metier.id_departement == emp.id_departement)
    return False


# ── Référentiel ──
@router.get("/metiers")
def list_metiers(_: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = repo.list_metiers(db)
    return envelope([m.to_dict() for m in rows], meta={"total": len(rows)})


@router.get("/metiers/{id_metier}/requises")
def metier_requises(id_metier: int, niveau: str | None = Query(None),
                    _: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = repo.competences_requises(db, id_metier, niveau)
    return envelope([r.to_dict() for r in rows], meta={"total": len(rows)})


@router.get("")
def list_competences(categorie: str | None = Query(None),
                     _: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = repo.list_competences(db, categorie)
    return envelope([c.to_dict() for c in rows], meta={"total": len(rows)})


# ── Auto-évaluation (collaborateur) ──
class SelfEval(BaseModel):
    id_competence: int
    niveau_auto: int = Field(..., ge=1, le=5)
    commentaire: str | None = None


class CustomCompetence(BaseModel):
    nom: str = Field(..., min_length=2, max_length=120)
    categorie: str = Field("hard")
    sous_categorie: str | None = None
    niveau_auto: int = Field(..., ge=1, le=5)
    commentaire: str | None = None


@router.get("/me/required")
def my_required(niveau: str | None = Query(None),
                user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Compétences attendues pour le poste du collaborateur (base de l'auto-positionnement)."""
    emp = repo.find_employee_by_email(db, user.email)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Profil introuvable")
    metier = repo.resolve_metier_for_poste(db, emp.poste)
    if metier is None:
        return envelope([], meta={"metier": None, "poste": emp.poste})
    if niveau:
        rows = repo.competences_requises(db, metier.id_metier, niveau)
    else:
        # Auto-positionnement : une ligne par compétence (union des niveaux, attendu max).
        uniq = {}
        for r in repo.competences_requises(db, metier.id_metier):
            cur = uniq.get(r.id_competence)
            if cur is None or r.niveau_attendu > cur.niveau_attendu:
                uniq[r.id_competence] = r
        rows = list(uniq.values())
    return envelope([r.to_dict() for r in rows], meta={"metier": metier.nom, "poste": emp.poste})


@router.get("/evaluations/{matricule}")
def evaluations(matricule: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not _can_view(db, user, matricule):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    rows = repo.evaluations_for(db, matricule)
    return envelope([e.to_dict() for e in rows], meta={"total": len(rows)})


@router.post("/me/evaluations", status_code=status.HTTP_201_CREATED)
def self_evaluate(payload: SelfEval, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    mat = _own_matricule(db, user)
    if mat is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Profil collaborateur introuvable")
    e = repo.upsert_self_evaluation(db, matricule=mat, id_competence=payload.id_competence,
                                    niveau_auto=payload.niveau_auto, commentaire=payload.commentaire)
    return envelope(e.to_dict())


@router.post("/me/custom", status_code=status.HTTP_201_CREATED)
def add_custom(payload: CustomCompetence, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Ajoute une compétence personnalisée (hors référentiel) + auto-évaluation associée
    — permet d'identifier les compétences transverses et talents cachés."""
    mat = _own_matricule(db, user)
    if mat is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Profil collaborateur introuvable")
    c = repo.add_competence(db, nom=payload.nom, categorie=payload.categorie,
                            sous_categorie=payload.sous_categorie or "Personnalisée", proposee=True)
    e = repo.upsert_self_evaluation(db, matricule=mat, id_competence=c.id_competence,
                                    niveau_auto=payload.niveau_auto, commentaire=payload.commentaire)
    return envelope(e.to_dict())


# ── Validation (expert / manager / RH) ──
class Validate(BaseModel):
    niveau_expert: int = Field(..., ge=1, le=5)


@router.get("/pending")
def pending(user: CurrentUser = Depends(_CONFIRM), db: Session = Depends(get_db)):
    """File de validation, réservée au MANAGER (limitée à son équipe ; admin = tout).
    Enrichie du nom du collaborateur et d'un indicateur `proposee` (compétence hors référentiel)."""
    rows = repo.pending_evaluations(db, dept=_mgr_dept(db, user))
    out = []
    for e in rows:
        d = e.to_dict()
        emp = repo.get_employee(db, e.matricule)
        d["nom_complet"] = f"{emp.prenom} {emp.nom}" if emp else e.matricule
        d["proposee"] = bool(e.competence.proposee) if e.competence else False
        out.append(d)
    return envelope(out, meta={"total": len(out)})


@router.patch("/evaluations/{id_eval}/validate")
def validate(id_eval: int, payload: Validate, user: CurrentUser = Depends(_CONFIRM), db: Session = Depends(get_db)):
    """Confirme le niveau d'une compétence. Un MANAGER ne peut confirmer que pour les
    membres de SON équipe (même département) ; l'admin n'est pas restreint."""
    from app.db.models import EvaluationCompetence
    ev = db.get(EvaluationCompetence, id_eval)
    if ev is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Évaluation introuvable")
    if user.role == ROLE_MANAGER:
        emp = repo.get_employee(db, ev.matricule)
        if not emp or emp.id_departement != _mgr_dept(db, user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hors de votre équipe")
    e = repo.validate_evaluation(db, id_eval=id_eval, niveau_expert=payload.niveau_expert, evaluateur=user.email)
    return envelope(e.to_dict())


# ── Gestion du référentiel (RH = tout ; manager = son périmètre) ──
class MetierIn(BaseModel):
    nom: str = Field(..., min_length=2, max_length=120)
    description: str | None = None
    missions: str | None = None
    responsabilites: str | None = None
    id_departement: int | None = None


class CompetenceIn(BaseModel):
    nom: str = Field(..., min_length=2, max_length=120)
    categorie: str = Field("hard")
    sous_categorie: str | None = None


class RequiseIn(BaseModel):
    niveau: str
    id_competence: int
    niveau_attendu: int = Field(..., ge=1, le=5)


@router.post("/metiers", status_code=status.HTTP_201_CREATED)
def create_metier(payload: MetierIn, user: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    idd = _mgr_dept(db, user) if user.role == ROLE_MANAGER else payload.id_departement
    m = repo.create_metier(db, nom=payload.nom, description=payload.description, missions=payload.missions,
                           responsabilites=payload.responsabilites, id_departement=idd)
    return envelope(m.to_dict())


@router.put("/metiers/{id_metier}")
def update_metier(id_metier: int, payload: MetierIn, user: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    m = repo.get_metier(db, id_metier)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Métier introuvable")
    if not _can_manage_metier(db, user, m):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hors de votre périmètre")
    patch = payload.model_dump(exclude_unset=True)
    if user.role == ROLE_MANAGER:
        patch.pop("id_departement", None)  # un manager ne réassigne pas un métier hors de son périmètre
    return envelope(repo.update_metier(db, id_metier, patch).to_dict())


@router.delete("/metiers/{id_metier}")
def delete_metier(id_metier: int, user: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    m = repo.get_metier(db, id_metier)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Métier introuvable")
    if not _can_manage_metier(db, user, m):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hors de votre périmètre")
    repo.delete_metier(db, id_metier)
    return envelope({"id": id_metier, "deleted": True})


@router.post("", status_code=status.HTTP_201_CREATED)
def create_competence(payload: CompetenceIn, _: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    """Ajoute une compétence prédéfinie au catalogue."""
    c = repo.add_competence(db, nom=payload.nom, categorie=payload.categorie, sous_categorie=payload.sous_categorie)
    return envelope(c.to_dict())


@router.post("/metiers/{id_metier}/requises", status_code=status.HTTP_201_CREATED)
def add_requise(id_metier: int, payload: RequiseIn, user: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    """Associe une compétence prédéfinie à un métier, pour un niveau donné (maîtrise attendue)."""
    m = repo.get_metier(db, id_metier)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Métier introuvable")
    if not _can_manage_metier(db, user, m):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hors de votre périmètre")
    r = repo.add_competence_requise(db, id_metier=id_metier, niveau=payload.niveau,
                                    id_competence=payload.id_competence, niveau_attendu=payload.niveau_attendu)
    return envelope(r.to_dict())


@router.delete("/requises/{id_req}")
def delete_requise(id_req: int, user: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    from app.db.models import CompetenceRequise
    r = db.get(CompetenceRequise, id_req)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Association introuvable")
    if not _can_manage_metier(db, user, repo.get_metier(db, r.id_metier)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hors de votre périmètre")
    repo.delete_competence_requise(db, id_req)
    return envelope({"id": id_req, "deleted": True})


@router.get("/proposees")
def proposees(user: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    """Liste des nouvelles compétences proposées (RH = toutes ; manager = son équipe)."""
    rows = repo.list_proposed_competences(db, dept=_mgr_dept(db, user))
    return envelope(rows, meta={"total": len(rows)})


_SYNC = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION)


@router.get("/postes/manquants")
def postes_manquants(_: CurrentUser = Depends(_SYNC), db: Session = Depends(get_db)):
    """Intitulés de poste d'employés sans métier au référentiel (à compléter)."""
    rows = repo.missing_postes(db)
    return envelope(rows, meta={"total": len(rows)})


@router.post("/postes/sync")
def postes_sync(_: CurrentUser = Depends(_SYNC), db: Session = Depends(get_db)):
    """Création auto : un métier vide par poste non mappé (le RH complète ensuite les compétences)."""
    return envelope(repo.create_missing_metiers(db))


# ── Radar & trajectoire ──
@router.get("/radar/{matricule}")
def radar(matricule: str, niveau: str | None = Query(None),
          user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not _can_view(db, user, matricule):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    res = repo.competence_radar(db, matricule, niveau=niveau)
    if res is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    return envelope(res)


@router.get("/trajectoire/{matricule}")
def trajectoire(matricule: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not _can_view(db, user, matricule):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    res = repo.trajectoire_carriere(db, matricule)
    if res is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    return envelope(res)
