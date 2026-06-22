"""Endpoints Documents (montés sous /documents) — génération + validation.

- POST /documents          : « génère » un document (statut pending) à partir
  d'un modèle, pour un employé. (Génération de fichier + upload MinIO à brancher.)
- PATCH /documents/{id}/status : validation tracée (valideur + date).
Un collaborateur ne voit/génère que ses propres documents.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    ROLE_ADMIN,
    ROLE_DIRECTION,
    ROLE_RH,
    CurrentUser,
    get_current_user,
    require_roles,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope
from app.schemas.hr import (
    DocumentCreate,
    DocumentPreviewRequest,
    DocumentStatusUpdate,
    DocumentSubmitRequest,
    DocumentUpdate,
    ModeleDocumentCreate,
    ModeleDocumentUpdate,
)
from app.services import doc_preview, document_types as dtypes, pdf_service, redis_cache, storage

router = APIRouter()

_VALIDATE = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION)
_VALIDATE_ROLES = {ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION}
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, "MANAGER"}

# Statut interne (BDD) <-> vocabulaire de la spec exposé au client.
_TO_SPEC = {"pending": "en_attente", "validated": "valide", "refused": "refuse", "draft": "brouillon"}
_TO_INTERNAL = {"valide": "validated", "refuse": "refused", "en_attente": "pending",
                "validated": "validated", "refused": "refused", "pending": "pending"}


def _own_matricule(db, user):
    emp = repo.find_employee_by_email(db, user.email)
    return emp.matricule if emp else None


@router.get("/types")
def list_types(user: CurrentUser = Depends(get_current_user)):
    """Types de documents disponibles, filtrés selon le rôle de l'utilisateur."""
    return envelope(dtypes.list_types_for(user.role))


@router.get("/modeles")
def list_modeles(
    all_: bool = Query(False, alias="all"),
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    """Liste des types de documents. Par défaut : uniquement les types ACTIFS.
    Les rôles RH/Direction peuvent demander tous les types (?all=true) pour la gestion."""
    only_active = not (all_ and user.role in _VALIDATE_ROLES)
    return envelope([m.to_dict() for m in repo.list_modele_document(db, only_active=only_active)])


# ── Gestion des types de documents (modèles) — réservé RH/Direction ──
@router.post("/modeles", status_code=status.HTTP_201_CREATED)
def create_modele(payload: ModeleDocumentCreate, _: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    m = repo.create_modele_document(db, libelle=payload.libelle, categorie=payload.categorie,
                                    gabarit=payload.gabarit)
    return envelope(m.to_dict())


@router.put("/modeles/{code}")
def update_modele(code: str, payload: ModeleDocumentUpdate, _: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    m = repo.update_modele_document(db, code, payload.model_dump(exclude_unset=True))
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Type de document introuvable")
    return envelope(m.to_dict())


@router.delete("/modeles/{code}")
def delete_modele(code: str, _: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    res = repo.delete_modele_document(db, code)
    if res == "not_found":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Type de document introuvable")
    if res == "in_use":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Type utilisé par des documents existants")
    return envelope({"code": code, "deleted": True})


@router.get("")
def list_documents(
    employee_id: str | None = Query(None),
    status_: str | None = Query(None, alias="status"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role not in _ELEVATED:
        employee_id = _own_matricule(db, user)
    rows = repo.list_documents(db, employee_id=employee_id, status=status_)
    return envelope([d.to_dict() for d in rows], meta={"total": len(rows)})


@router.post("", status_code=status.HTTP_201_CREATED)
def generate_document(
    payload: DocumentCreate, user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Génère un document en BROUILLON (statut draft). Il n'est PAS soumis :
    l'utilisateur le relit/modifie puis le soumet explicitement (POST /{id}/submit)."""
    if payload.code_modele and not repo.modele_document_exists(db, payload.code_modele):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Modèle de document inconnu")
    matricule = payload.employee_id
    if user.role not in _ELEVATED or not matricule:
        matricule = _own_matricule(db, user)
    if matricule is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Employé cible introuvable")
    if repo.get_employee(db, matricule) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    doc = repo.create_document(db, matricule=matricule, code_modele=payload.code_modele,
                               nom_fichier=payload.nom_fichier, contenu=payload.contenu)
    return envelope(doc.to_dict())


@router.patch("/{document_id}")
def edit_document(
    document_id: int, payload: DocumentUpdate,
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    """Édite un brouillon (nom et/ou contenu). Réservé au propriétaire (ou rôle élevé),
    uniquement tant que le document est en `draft` ou `refused` (re-travail possible)."""
    doc = repo.get_document(db, document_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document introuvable")
    if user.role not in _ELEVATED and doc.matricule != _own_matricule(db, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    if doc.statut not in ("draft", "refused"):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Document non modifiable (déjà soumis ou validé)")
    doc = repo.update_document(db, document_id, nom_fichier=payload.nom_fichier, contenu=payload.contenu)
    return envelope(doc.to_dict())


@router.post("/{document_id}/submit")
def submit_document(
    document_id: int, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Soumission EXPLICITE par l'utilisateur : draft|refused -> pending (validation RH)."""
    doc = repo.get_document(db, document_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document introuvable")
    if user.role not in _ELEVATED and doc.matricule != _own_matricule(db, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    if doc.statut not in ("draft", "refused"):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Seul un brouillon (ou un document refusé) peut être soumis")
    doc = repo.set_document_status(db, document_id, "pending")
    return envelope(doc.to_dict())


def _emp_dict(emp):
    try:
        dept = emp.department.nom if emp.department else None
    except Exception:
        dept = None
    return {"matricule": emp.matricule, "prenom": emp.prenom, "nom": emp.nom,
            "poste": emp.poste, "date_entree": emp.date_embauche, "department": {"nom": dept}}


@router.post("/preview")
def preview_document(
    payload: DocumentPreviewRequest, user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Génère un APERÇU (rien n'est sauvegardé). Les données minimales sont mises en
    cache Redis (TTL court) sous un jeton signé HMAC. Aucune donnée perso en clair :
    on ne stocke que le type, le matricule et les champs additionnels."""
    if not dtypes.can_generate(user.role, payload.type):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Type de document non autorisé pour votre rôle")
    matricule = payload.employee_id
    if user.role not in _ELEVATED or not matricule:
        matricule = _own_matricule(db, user)
    if matricule is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Employé cible introuvable")
    emp = repo.get_employee(db, matricule)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")

    document_name, html_preview, _ = doc_preview.render(payload.type, _emp_dict(emp), payload.additional_data)
    token, nonce = doc_preview.make_token()
    redis_cache.set(f"docpreview:{nonce}", {
        "type": payload.type, "matricule": matricule,
        "additional_data": payload.additional_data, "user_email": user.email,
    }, ttl=settings.DOC_PREVIEW_TTL)
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=settings.DOC_PREVIEW_TTL)).isoformat()
    return envelope({"preview_token": token, "html_preview": html_preview,
                     "document_name": document_name, "expires_at": expires_at})


@router.post("/submit", status_code=status.HTTP_201_CREATED)
def submit_preview(
    payload: DocumentSubmitRequest, user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confirme l'aperçu : vérifie le jeton (HMAC + Redis), génère le fichier,
    l'upload dans MinIO, crée le document en statut 'pending', invalide le jeton
    (usage unique) et journalise l'action."""
    nonce = doc_preview.verify_token(payload.preview_token)
    if nonce is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Jeton de prévisualisation invalide")
    key = f"docpreview:{nonce}"
    data = redis_cache.get(key)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Aperçu expiré, recommencez")
    # Propriété : un collaborateur ne peut soumettre que son propre aperçu.
    if user.role not in _ELEVATED and data.get("user_email") != user.email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    # Re-contrôle du rôle au moment de la confirmation.
    if not dtypes.can_generate(user.role, data.get("type", "")):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Type de document non autorisé pour votre rôle")

    emp = repo.get_employee(db, data["matricule"])
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    document_name, _, text = doc_preview.render(data["type"], _emp_dict(emp), data.get("additional_data"))

    doc = repo.create_submitted_document(db, matricule=emp.matricule, document_name=document_name,
                                         contenu=text, type_doc=data["type"], code_modele=None)
    uid = emp.id_utilisateur or emp.matricule
    object_name = f"hr-documents/{uid}/{doc.id_document}/{document_name}"
    if storage.put_bytes(object_name, text.encode("utf-8")):
        repo.set_document_minio(db, doc.id_document, object_name)

    redis_cache.delete(key)  # usage unique
    repo.log_audit(db, action="DOCUMENT_SUBMITTED", type_entite="document",
                   id_entite=doc.id_document, user_email=user.email)
    return envelope({"document_id": doc.id_document, "status": _TO_SPEC.get(doc.statut, doc.statut),
                     "document_name": document_name,
                     "created_at": doc.date_creation.isoformat() if doc.date_creation else None})


def _download_url(doc):
    """Pre-signed URL MinIO si disponible, sinon None (le front utilisera l'endpoint applicatif)."""
    if doc.cle_minio and storage.available():
        return storage.presigned_get(doc.cle_minio)
    return None


@router.get("/my")
def my_documents(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    matricule = _own_matricule(db, user)
    rows = repo.list_documents(db, employee_id=matricule) if matricule else []
    out = []
    for d in rows:
        item = d.to_dict()
        item["status"] = _TO_SPEC.get(d.statut, d.statut)  # vocabulaire spec : en_attente|valide|refuse
        item["download_url"] = _download_url(d) if d.statut == "validated" else None
        out.append(item)
    return envelope(out, meta={"total": len(out)})


@router.get("/{document_id}")
def get_document(document_id: int, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = repo.get_document(db, document_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document introuvable")
    if user.role not in _ELEVATED and doc.matricule != _own_matricule(db, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    return envelope(doc.to_dict())


@router.get("/{document_id}/download")
def download_document(
    document_id: int, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Téléchargement sécurisé : vérifie l'accès (propriétaire ou rôle élevé) puis
    sert le contenu. Si un fichier MinIO existe (cle_minio), il sera servi depuis MinIO ;
    sinon le contenu est généré à la volée à partir du modèle et de l'employé."""
    doc = repo.get_document(db, document_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document introuvable")
    if user.role not in _ELEVATED and doc.matricule != _own_matricule(db, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")

    emp = repo.get_employee(db, doc.matricule)
    nom_complet = f"{emp.prenom} {emp.nom}" if emp else doc.matricule
    libelle = doc.code_modele or (dtypes.label_of(doc.type_doc) if doc.type_doc else "Document")
    if doc.code_modele:
        from app.db.models import ModeleDocument
        m = db.get(ModeleDocument, doc.code_modele)
        if m:
            libelle = m.libelle

    # Corps : le contenu édité/généré s'il existe, sinon un récapitulatif minimal.
    if doc.contenu:
        body = doc.contenu
    else:
        body = (f"Matricule : {doc.matricule}\n"
                f"Collaborateur : {nom_complet}\n"
                f"Document : {doc.nom_fichier}\n"
                f"Statut : {doc.statut}")
    subtitle = f"{nom_complet} · {doc.matricule}"
    content, content_type = pdf_service.build_pdf(libelle, body, subtitle=subtitle)

    ext = "pdf" if content_type.startswith("application/pdf") else "txt"
    filename = (doc.nom_fichier or f"document_{document_id}").rsplit(".", 1)[0] + f".{ext}"
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch("/{document_id}/status")
def validate_document(
    document_id: int, payload: DocumentStatusUpdate,
    user: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db),
):
    new_status = _TO_INTERNAL.get(payload.status, payload.status)  # valide/refuse -> validated/refused
    existing = repo.get_document(db, document_id)
    if existing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document introuvable")
    # On ne valide/refuse qu'un document effectivement soumis ; un validé est verrouillé.
    if existing.statut == "validated":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Document déjà validé (verrouillé)")
    if existing.statut == "draft":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Document encore en brouillon (non soumis)")
    emp = repo.find_employee_by_email(db, user.email)
    valideur_id = emp.id_utilisateur if emp else None
    doc = repo.set_document_status(db, document_id, new_status, valideur_id=valideur_id)
    if payload.comment:
        repo.log_audit(db, action=f"DOCUMENT_{new_status.upper()}", type_entite="document",
                       id_entite=document_id, user_email=user.email)
    out = doc.to_dict()
    out["status"] = _TO_SPEC.get(doc.statut, doc.statut)  # vocabulaire spec
    # Document validé -> URL de téléchargement signée (24 h) si MinIO disponible.
    out["download_url"] = _download_url(doc) if new_status == "validated" else None
    return envelope(out)
