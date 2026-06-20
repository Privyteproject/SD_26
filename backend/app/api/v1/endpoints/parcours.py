"""Endpoints Parcours onboarding/offboarding (montés sous /parcours).

S'appuie sur modele_tache (gabarits) et tache_parcours (instances).
- modèles & initialisation & décision : rôles RH/ADMIN/MANAGER/DIRECTION ;
- consultation d'un parcours : l'employé concerné ou un rôle élevé.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN,
    ROLE_DIRECTION,
    ROLE_MANAGER,
    ROLE_RH,
    CurrentUser,
    get_current_user,
    require_roles,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope
from app.services import ai as ai_service
from app.services import onboarding_agent
from app.schemas.hr import (
    ModeleTacheCreate,
    ModeleTacheUpdate,
    ParcoursInit,
    TacheCreate,
    TacheStatusUpdate,
)

router = APIRouter()

_MANAGE = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_MANAGER, ROLE_DIRECTION)
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_MANAGER, ROLE_DIRECTION}


@router.get("/modeles")
def list_modeles(
    type_parcours: str | None = Query(None, alias="type"),
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = repo.list_modele_taches(db, type_parcours)
    return envelope([m.to_dict() for m in rows], meta={"total": len(rows)})


# ── Gestion des modèles de tâches par défaut (gabarits) ──
@router.post("/modeles", status_code=status.HTTP_201_CREATED)
def create_modele(payload: ModeleTacheCreate, _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)):
    m = repo.create_modele_tache(db, libelle=payload.libelle, type_parcours=payload.type_parcours,
                                 ordre=payload.ordre, delai_jours=payload.delai_jours)
    return envelope(m.to_dict())


@router.put("/modeles/{code}")
def update_modele(code: str, payload: ModeleTacheUpdate, _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)):
    m = repo.update_modele_tache(db, code, payload.model_dump(exclude_unset=True))
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Modèle introuvable")
    return envelope(m.to_dict())


@router.delete("/modeles/{code}")
def delete_modele(code: str, _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)):
    res = repo.delete_modele_tache(db, code)
    if res == "not_found":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Modèle introuvable")
    if res == "in_use":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Modèle utilisé par des parcours existants")
    return envelope({"code": code, "deleted": True})


# ── Tâche personnalisée pour un employé + suppression d'une tâche ──
@router.post("/{matricule}/taches", status_code=status.HTTP_201_CREATED)
def add_tache(matricule: str, payload: TacheCreate, _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)):
    if repo.get_employee(db, matricule) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    t = repo.add_tache(db, matricule=matricule, libelle=payload.libelle,
                       type_parcours=payload.type_parcours, date_echeance=payload.date_echeance)
    return envelope(t.to_dict())


@router.delete("/taches/{id_tache}")
def delete_tache(id_tache: int, _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)):
    if not repo.delete_tache(db, id_tache):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tâche introuvable")
    return envelope({"id": id_tache, "deleted": True})


@router.post("/generate/{matricule}", status_code=status.HTTP_201_CREATED)
def generate_parcours(
    matricule: str,
    type_parcours: str = Query("ONBOARDING", alias="type"),
    _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db),
):
    """Génère un parcours par IA (planning 30 j adapté au poste) et l'enregistre."""
    emp = repo.get_employee(db, matricule)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    type_parcours = "OFFBOARDING" if type_parcours.upper() == "OFFBOARDING" else "ONBOARDING"
    plan = onboarding_agent.generate_plan(emp.poste, type_parcours)
    today = date.today()
    created = []
    for step in plan:
        t = repo.add_tache(db, matricule=matricule, libelle=step["libelle"],
                           type_parcours=type_parcours,
                           date_echeance=today + timedelta(days=step["delai_jours"]))
        created.append(t)
    return envelope([t.to_dict() for t in created],
                    meta={"total": len(created), "generated_by": "ai", "type": type_parcours})


@router.post("/{matricule}/transfer-summary", status_code=status.HTTP_201_CREATED)
def transfer_summary(
    matricule: str, _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db),
):
    """Synthèse de transfert (offboarding) générée par l'IA à partir des tâches de
    départ et des sujets récents du collaborateur. Stockée comme document dédié."""
    emp = repo.get_employee(db, matricule)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")

    taches = repo.list_taches(db, matricule, "OFFBOARDING")
    taches_txt = ", ".join((t.modele.libelle if t.modele else t.code_tache) for t in taches) or "(aucune)"
    prompts = []
    if emp.id_utilisateur:
        from app.db.models import InteractionIA
        prompts = list(db.scalars(
            select(InteractionIA.prompt).where(InteractionIA.id_utilisateur == emp.id_utilisateur)
            .order_by(InteractionIA.date_creation.desc()).limit(15)))
    sujets = "; ".join(p[:80] for p in prompts) or "(aucun)"

    system = (
        "Tu es un assistant RH. Rédige une SYNTHÈSE DE TRANSFERT claire et structurée pour "
        "le départ d'un collaborateur, afin de préserver les connaissances. Sections : "
        "1) Projets en cours, 2) Outils/compétences maîtrisés, 3) Contacts clés, "
        "4) Procédures à transmettre, 5) Points d'attention. Sois concret et concis."
    )
    contexte = (f"Poste : {emp.poste or '—'}. Tâches d'offboarding : {taches_txt}. "
                f"Sujets récents abordés par le collaborateur : {sujets}.")
    out = ai_service.complete(system, contexte, [])
    text = (out.get("reply") or "").strip() or "Synthèse non disponible (IA indisponible)."

    doc = repo.create_submitted_document(
        db, matricule=matricule, document_name=f"synthese_transfert_{matricule}.txt",
        contenu=text, type_doc="synthese_transfert")
    repo.set_document_status(db, doc.id_document, "validated")  # doc interne consultable
    return envelope({"document_id": doc.id_document, "summary": text})


@router.post("/{matricule}/init", status_code=status.HTTP_201_CREATED)
def init_parcours(
    matricule: str, payload: ParcoursInit,
    _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db),
):
    if repo.get_employee(db, matricule) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    taches = repo.init_parcours(db, matricule, payload.type_parcours)
    return envelope([t.to_dict() for t in taches], meta={"total": len(taches)})


@router.get("/{matricule}")
def get_parcours(
    matricule: str,
    type_parcours: str | None = Query(None, alias="type"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role not in _ELEVATED:
        emp = repo.find_employee_by_email(db, user.email)
        if not emp or emp.matricule != matricule:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    rows = repo.list_taches(db, matricule, type_parcours)
    return envelope([t.to_dict() for t in rows], meta={"total": len(rows)})


@router.patch("/taches/{id_tache}")
def update_tache(
    id_tache: int, payload: TacheStatusUpdate,
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    # RH/Manager/Direction/Admin : OK sur toute tâche. Sinon, le collaborateur ne peut
    # cocher que SES propres tâches (il valide son onboarding).
    t = repo.get_tache(db, id_tache)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tâche introuvable")
    if user.role not in _ELEVATED:
        emp = repo.find_employee_by_email(db, user.email)
        if not emp or emp.matricule != t.matricule:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    t = repo.set_tache_status(db, id_tache, payload.status, payload.date_realisation)
    return envelope(t.to_dict())
