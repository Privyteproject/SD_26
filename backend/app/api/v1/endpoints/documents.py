"""Endpoints Documents (montés sous /documents) — génération + validation.

- POST /documents          : « génère » un document (statut pending) à partir
  d'un modèle, pour un employé. (Génération de fichier + upload MinIO à brancher.)
- PATCH /documents/{id}/status : validation tracée (valideur + date).
Un collaborateur ne voit/génère que ses propres documents.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks, UploadFile, File
from fastapi.responses import Response, RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

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
from app.db.base import get_db, SessionLocal
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


def validate_jinja_template(html_content: str):
    """Dry-run compiles and renders the template code with a mock context to prevent broken dynamic templates."""
    from jinja2 import Environment, TemplateSyntaxError
    try:
        env = Environment()
        # Mock dry-run context matching base and specific templates
        mock_ctx = {
            "employee": {
                "matricule": "EMP000",
                "prenom": "John",
                "nom": "Doe",
                "poste": "Développeur",
                "department": {"nom": "IT"},
                "date_entree": date.today(),
            },
            "company": {"nom": settings.COMPANY_NAME, "adresse": settings.COMPANY_ADDRESS},
            "date_generation": date.today().strftime("%d/%m/%Y"),
            "label": "Document d'Attestation",
            "requires_rh_validation": True,
        }
        env.from_string(html_content).render(**mock_ctx)
    except TemplateSyntaxError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erreur de syntaxe Jinja (Ligne {e.lineno}): {e.message}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erreur d'évaluation Jinja : {str(e)}"
        )


def _own_matricule(db, user):
    emp = repo.find_employee_by_email(db, user.email)
    return emp.matricule if emp else None


def _requires_validation(type_key: str | None) -> bool:
    if not type_key:
        return True
    from app.services.document_types import DOCUMENT_TYPES
    if type_key in DOCUMENT_TYPES:
        return DOCUMENT_TYPES[type_key].get("requires_rh_validation", True)
    norm_key = type_key.lower().replace("-", "_")
    if norm_key.startswith("attest_"):
        norm_key = norm_key.replace("attest_", "attestation_", 1)
    if norm_key in DOCUMENT_TYPES:
        return DOCUMENT_TYPES[norm_key].get("requires_rh_validation", True)
    for k in DOCUMENT_TYPES:
        if k.startswith(norm_key) or norm_key.startswith(k) or k.replace("_", "") == norm_key.replace("_", ""):
            return DOCUMENT_TYPES[k].get("requires_rh_validation", True)
    return True


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
    if payload.gabarit:
        validate_jinja_template(payload.gabarit)
    m = repo.create_modele_document(db, libelle=payload.libelle, categorie=payload.categorie,
                                    gabarit=payload.gabarit, code=payload.code)
    return envelope(m.to_dict())


@router.put("/modeles/{code}")
def update_modele(code: str, payload: ModeleDocumentUpdate, _: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    if payload.gabarit is not None:
        validate_jinja_template(payload.gabarit)
    m = repo.update_modele_document(db, code, payload.model_dump(exclude_unset=True))
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Type de document introuvable")
    return envelope(m.to_dict())


<<<<<<< HEAD
@router.post("/modeles/{code}/upload")
def upload_modele_file(
    code: str,
    file: UploadFile = File(...),
    _: CurrentUser = Depends(_VALIDATE),
    db: Session = Depends(get_db)
):
    from app.db.models import ModeleDocument
    import base64
    import json
    
    m = db.get(ModeleDocument, code)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Type de document introuvable")

    filename = file.filename
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    
    try:
        content_bytes = file.file.read()
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Erreur lecture fichier: {e}")
        
    if ext in ("docx", "pdf"):
        if ext == "docx":
            from docx import Document
            import io
            try:
                Document(io.BytesIO(content_bytes))
            except Exception as e:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Le fichier Word (.docx) est corrompu ou invalide: {e}")
        elif ext == "pdf":
            from pypdf import PdfReader
            import io
            try:
                reader = PdfReader(io.BytesIO(content_bytes))
                _ = len(reader.pages)
            except Exception as e:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Le fichier PDF est corrompu ou invalide: {e}")
        
        b64_data = base64.b64encode(content_bytes).decode("utf-8")
        minio_key = f"templates/{code}.{ext}"
        if storage.available():
            storage.put_bytes(minio_key, content_bytes, content_type=file.content_type or "application/octet-stream")
            
        meta_json = json.dumps({
            "is_binary": True,
            "format": ext,
            "filename": filename,
            "minio_key": minio_key,
            "content_b64": b64_data
        })
        m = repo.update_modele_document(db, code, {"gabarit": meta_json})
    else:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Format de fichier non supporté (.{ext}). Formats autorisés : .docx, .pdf"
        )

        
    return envelope(m.to_dict())



class TemplatePreviewRequest(BaseModel):
    gabarit: str | None = None
    doc_type: str | None = None


@router.post("/modeles/preview")
def preview_modele_template(
    payload: TemplatePreviewRequest,
    _: CurrentUser = Depends(_VALIDATE),
    db: Session = Depends(get_db)
):
    """API of debouncing / live editing of template code."""
    from jinja2 import Environment
    from app.services.doc_preview import SilentUndefined, _format_date, render_binary_template
    import json
    
    mock_ctx = {
        "employee": {
            "matricule": "EMP005",
            "prenom": "Adam",
            "nom": "Roux",
            "poste": "Opérateur",
            "department": {"nom": "Opérations"},
            "date_entree": date.today(),
        },
        "company": {"nom": settings.COMPANY_NAME, "adresse": settings.COMPANY_ADDRESS},
        "date_generation": date.today().strftime("%d/%m/%Y"),
        "label": "Attestation d'Exemple",
        "requires_rh_validation": True,
    }
    
    if payload.doc_type:
        modele = doc_preview.find_modele_document(db, payload.doc_type)
        if modele and modele.gabarit and modele.gabarit.strip().startswith("{"):
            try:
                meta = json.loads(modele.gabarit)
                if meta.get("is_binary"):
                    bin_res = render_binary_template(db, payload.doc_type, mock_ctx["employee"], mock_ctx)
                    if bin_res:
                        document_name, filled_bytes, fmt, text_content = bin_res
                        if fmt == "docx":
                            from app.services.doc_preview import docx_to_html_preview
                            html_preview = docx_to_html_preview(filled_bytes)
                            return envelope({"html_preview": html_preview})
                        elif fmt == "pdf":
                            token, nonce = doc_preview.make_token()
                            redis_cache.set(f"docpreview:{nonce}", {
                                "type": payload.doc_type,
                                "matricule": "EMP005",
                                "additional_data": {},
                                "user_email": "mock@synapse.digital",
                                "is_mock": True
                            }, ttl=settings.DOC_PREVIEW_TTL)
                            
                            api_prefix = "/api/v1"
                            html_preview = f'<iframe src="{api_prefix}/documents/preview/pdf?token={token}#toolbar=0&navpanes=0&view=Fit" style="width:100%; height:100%; border:none; background:#ffffff; border-radius:6px;"></iframe>'
                            return envelope({"html_preview": html_preview})
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Erreur d'aperçu de modèle binaire : {str(e)}"
                )

    if not payload.gabarit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le contenu du gabarit ou le type de document est requis."
        )

    try:
        env = Environment(undefined=SilentUndefined)
        env.filters["format_date"] = _format_date
        html_preview = env.from_string(payload.gabarit).render(**mock_ctx)
        return envelope({"html_preview": html_preview})
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erreur d'aperçu en direct : {str(e)}"
        )



=======
from fastapi import UploadFile, File
import json
import base64

@router.post("/modeles/{code}/upload")
async def upload_modele(code: str, file: UploadFile = File(...), _: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db)):
    from app.db.models import ModeleDocument
    m = db.get(ModeleDocument, code)
    if not m:
        raise HTTPException(404, detail="Modèle introuvable")
    
    content = await file.read()
    ext = file.filename.split(".")[-1].lower()
    if ext not in ("docx", "pdf"):
        raise HTTPException(400, detail="Format non supporté (.docx, .pdf)")
        
    minio_key = f"templates/{code}.{ext}"
    if storage.available():
        storage.put_bytes(minio_key, content)
    
    gabarit_data = {
        "is_binary": True,
        "format": ext,
        "filename": file.filename,
        "minio_key": minio_key,
        "content_b64": base64.b64encode(content).decode("utf-8")
    }
    m.gabarit = json.dumps(gabarit_data)
    db.commit()
    return envelope(m.to_dict())


>>>>>>> Ghost_Work
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
    document_id: int, background_tasks: BackgroundTasks, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Soumission EXPLICITE par l'utilisateur : draft|refused -> pending (validation RH) ou validated."""
    doc = repo.get_document(db, document_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document introuvable")
    if user.role not in _ELEVATED and doc.matricule != _own_matricule(db, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    if doc.statut not in ("draft", "refused"):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Seul un brouillon (ou un document refusé) peut être soumis")
    
    type_key = doc.type_doc or doc.code_modele
    if not _requires_validation(type_key):
        doc = repo.set_document_status(db, document_id, "validated")
        background_tasks.add_task(_upload_pdf_to_minio_bg, doc.id_document, doc.contenu or "")
    else:
        doc = repo.set_document_status(db, document_id, "pending")
    return envelope(doc.to_dict())
def _emp_dict(emp):
    try:
        dept = emp.department.nom if emp.department else None
    except Exception:
        dept = None
    return {"matricule": emp.matricule, "prenom": emp.prenom, "nom": emp.nom,
            "nom_complet": f"{emp.prenom} {emp.nom}".strip(),
            "poste": emp.poste, "date_entree": emp.date_embauche, "department": {"nom": dept}}


@router.post("/preview")
def preview_document(
    payload: DocumentPreviewRequest, user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.db.models import ModeleDocument
    import json
    
    # Allow custom models from DB or static types
    modele = db.get(ModeleDocument, payload.type)
    if not modele and not dtypes.can_generate(user.role, payload.type):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Type de document non autorisé pour votre rôle")
        
    matricule = payload.employee_id
    if user.role not in _ELEVATED or not matricule:
        matricule = _own_matricule(db, user)
    if matricule is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Employé cible introuvable")
    emp = repo.get_employee(db, matricule)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")

<<<<<<< HEAD
    document_name, html_preview, _ = doc_preview.render(db, payload.type, _emp_dict(emp), payload.additional_data)
=======
    # Check if binary template
    is_binary = False
    gabarit_data = {}
    if modele and modele.gabarit and modele.gabarit.strip().startswith("{"):
        try:
            parsed = json.loads(modele.gabarit)
            if parsed.get("is_binary"):
                is_binary = True
                gabarit_data = parsed
        except Exception:
            pass

    document_name = None
    html_preview = None
    
    if is_binary:
        document_name = gabarit_data.get("filename", f"document.{gabarit_data.get('format', 'pdf')}")
        html_preview = ""
        # If it's docx, we can still generate an HTML preview from it
        if gabarit_data.get("format") == "docx":
            import base64
            bin_content = base64.b64decode(gabarit_data.get("content_b64", ""))
            try:
                # Pre-fill template in memory to show html preview with values
                filled_docx = doc_preview.fill_docx_template(bin_content, {"employee": _emp_dict(emp), **payload.additional_data})
                html_preview = doc_preview.docx_to_html_preview(filled_docx, document_name)
            except Exception as e:
                html_preview = f"<p>Aperçu indisponible : {str(e)}</p>"
    else:
        document_name, html_preview, _ = doc_preview.render(payload.type, _emp_dict(emp), payload.additional_data)
        
>>>>>>> Ghost_Work
    token, nonce = doc_preview.make_token()
    
    if "TOKEN_PLACEHOLDER" in html_preview:
        html_preview = html_preview.replace("TOKEN_PLACEHOLDER", token)
        
    redis_cache.set(f"docpreview:{nonce}", {
        "type": payload.type, "matricule": matricule,
        "additional_data": payload.additional_data, "user_email": user.email,
        "is_binary": is_binary, "gabarit_data": gabarit_data, "document_name": document_name
    }, ttl=settings.DOC_PREVIEW_TTL)
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=settings.DOC_PREVIEW_TTL)).isoformat()
    requires_val = _requires_validation(payload.type)
    return envelope({"preview_token": token, "html_preview": html_preview,
<<<<<<< HEAD
                     "document_name": document_name, "expires_at": expires_at,
                     "requires_rh_validation": requires_val})


@router.get("/preview/pdf")
def preview_pdf(
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """Sert les bytes PDF de l'aperçu du document (pour l'iframe de prévisualisation)."""
    nonce = doc_preview.verify_token(token)
    if nonce is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Jeton de prévisualisation invalide")
        
    key = f"docpreview:{nonce}"
    data = redis_cache.get(key)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Aperçu expiré, recommencez")
        
    doc_type = data.get("type")
    
    if data.get("is_mock"):
        emp_data = {
            "matricule": "EMP005",
            "prenom": "Adam",
            "nom": "Roux",
            "poste": "Opérateur",
            "department": {"nom": "Opérations"},
            "date_entree": date.today(),
        }
        additional = {}
    else:
        emp = repo.get_employee(db, data["matricule"])
        if emp is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
        emp_data = _emp_dict(emp)
        additional = data.get("additional_data") or {}
        
    bin_res = doc_preview.render_binary_template(db, doc_type, emp_data, additional)
    if not bin_res or bin_res[2] != "pdf":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Le modèle n'est pas un fichier PDF")
        
    document_name, filled_bytes, fmt, text_content = bin_res
    return Response(
        content=filled_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{document_name}"'}
    )


@router.get("/preview/download")
def download_preview_file(
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """Télécharge le fichier d'aperçu d'un document (compatible HTML, Word et PDF)."""
    nonce = doc_preview.verify_token(token)
    if nonce is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Jeton de prévisualisation invalide")
        
    key = f"docpreview:{nonce}"
    data = redis_cache.get(key)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Aperçu expiré, recommencez")
        
    doc_type = data.get("type")
    
    if data.get("is_mock"):
        emp_data = {
            "matricule": "EMP005",
            "prenom": "Adam",
            "nom": "Roux",
            "poste": "Opérateur",
            "department": {"nom": "Opérations"},
            "date_entree": date.today(),
        }
        additional = {}
    else:
        emp = repo.get_employee(db, data["matricule"])
        if emp is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
        emp_data = _emp_dict(emp)
        additional = data.get("additional_data") or {}

    bin_res = doc_preview.render_binary_template(db, doc_type, emp_data, additional)
    if bin_res:
        document_name, filled_bytes, fmt, text_content = bin_res
        media_type = "application/pdf" if fmt == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return Response(
            content=filled_bytes,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{document_name}"'}
        )
    else:
        document_name, html, text = doc_preview.render(db, doc_type, emp_data, additional)
        try:
            pdf_bytes = doc_preview.html_to_pdf(html)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{document_name}"'}
            )
        except Exception as exc:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Échec de la génération du PDF : {exc}",
            )
=======
                     "document_name": document_name, "expires_at": expires_at, "is_binary": is_binary, "format": gabarit_data.get("format")})
>>>>>>> Ghost_Work

@router.get("/preview/pdf")
def preview_pdf(token: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    nonce = doc_preview.verify_token(token)
    if nonce is None:
        raise HTTPException(400, detail="Jeton de prévisualisation invalide")
    data = redis_cache.get(f"docpreview:{nonce}")
    if not data or not data.get("is_binary"):
        raise HTTPException(400, detail="Aperçu expiré ou type incorrect")
        
    emp = repo.get_employee(db, data["matricule"])
    ctx = {"employee": _emp_dict(emp), **data.get("additional_data", {})}
    gabarit_data = data["gabarit_data"]
    
    import base64
    bin_content = base64.b64decode(gabarit_data.get("content_b64", ""))
    
    if gabarit_data.get("format") == "pdf":
        filled = doc_preview.fill_pdf_template(bin_content, ctx)
        return Response(content=filled, media_type="application/pdf")
    else:
        # For docx, we just return the filled docx file
        filled = doc_preview.fill_docx_template(bin_content, ctx)
        return Response(content=filled, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

@router.post("/submit", status_code=status.HTTP_201_CREATED)
def submit_preview(
    payload: DocumentSubmitRequest, background_tasks: BackgroundTasks, user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confirme l'aperçu : crée le document en statut 'pending' ou 'validated'."""
    nonce = doc_preview.verify_token(payload.preview_token)
    if nonce is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Jeton de prévisualisation invalide")
    key = f"docpreview:{nonce}"
    data = redis_cache.get(key)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Aperçu expiré, recommencez")
    if user.role not in _ELEVATED and data.get("user_email") != user.email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    if not dtypes.can_generate(user.role, data.get("type", "")):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Type de document non autorisé pour votre rôle")

    emp = repo.get_employee(db, data["matricule"])
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    type_key = data.get("type")
    
    # Check if binary template exists
    bin_res = doc_preview.render_binary_template(db, type_key, _emp_dict(emp), data.get("additional_data"))
    is_binary = bin_res is not None
    
    if is_binary:
        document_name, filled_bytes, fmt, text = bin_res
    else:
        document_name, html, text = doc_preview.render(db, type_key, _emp_dict(emp), data.get("additional_data"))
        try:
            filled_bytes = doc_preview.html_to_pdf(html)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Échec de la génération du PDF : {exc}",
            ) from exc

    requires_val = _requires_validation(type_key)
    statut = "pending" if requires_val else "validated"
    date_val = None if requires_val else date.today()

    doc = repo.create_submitted_document(
        db, matricule=emp.matricule, document_name=document_name,
        contenu=text, type_doc=type_key, code_modele=None,
        statut=statut, date_validation=date_val
    )
    
    # Upload filled document to MinIO
    uid = emp.id_utilisateur or emp.matricule if emp else doc.matricule
    object_name = f"hr-documents/{uid}/{doc.id_document}/{document_name}"
    content_type = "application/pdf" if (not is_binary or fmt == "pdf") else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    
    if is_binary:
        if storage.available():
            if storage.put_bytes(object_name, filled_bytes, content_type=content_type):
                repo.set_document_minio(db, doc.id_document, object_name)
    else:
        background_tasks.add_task(_upload_pdf_to_minio_bg, doc.id_document, html)

    redis_cache.delete(key)
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

    # Si le binaire est disponible dans MinIO, on redirige vers l'URL signée (direct download)
    if doc.cle_minio and storage.available():
        presigned_url = storage.presigned_get(doc.cle_minio)
        if presigned_url:
            return RedirectResponse(url=presigned_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


    # Repli text/plain (compatibilité ou si MinIO indisponible)
    emp = repo.get_employee(db, doc.matricule)
    nom_complet = f"{emp.prenom} {emp.nom}" if emp else doc.matricule
    libelle = doc.code_modele or (dtypes.label_of(doc.type_doc) if doc.type_doc else "Document")
    if doc.code_modele:
        from app.db.models import ModeleDocument
        m = db.get(ModeleDocument, doc.code_modele)
        if m:
            libelle = m.libelle


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
    document_id: int, payload: DocumentStatusUpdate, background_tasks: BackgroundTasks,
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
    if new_status == "validated":
        background_tasks.add_task(_upload_pdf_to_minio_bg, doc.id_document, doc.contenu or "")
    if payload.comment:
        repo.log_audit(db, action=f"DOCUMENT_{new_status.upper()}", type_entite="document",
                       id_entite=document_id, user_email=user.email)
    out = doc.to_dict()
    out["status"] = _TO_SPEC.get(doc.statut, doc.statut)  # vocabulaire spec
    # Document validé -> URL de téléchargement signée (24 h) si MinIO disponible.
    out["download_url"] = _download_url(doc) if new_status == "validated" else None
    return envelope(out)


def _upload_pdf_to_minio_bg(document_id: int, text_content: str):
    """Compile le texte en PDF et l'enregistre sur MinIO en arrière-plan."""
    from app.services import doc_preview, storage
    import logging
    logger = logging.getLogger(__name__)
    
    with SessionLocal() as db:
        try:
            doc = repo.get_document(db, document_id)
            if not doc:
                logger.warning(f"Document {document_id} not found for background PDF gen.")
                return
                
            if doc.cle_minio:
                logger.info(f"Document {document_id} already has cle_minio set ({doc.cle_minio}), skipping bg rendering.")
                return

            emp = repo.get_employee(db, doc.matricule)

            if "<html" in text_content.lower() or "<body" in text_content.lower():
                html_content = text_content
            else:
                # Parse blocks of text to rebuild a clean HTML structure
                blocks = [block.strip() for block in text_content.strip().split("\n\n") if block.strip()]
                
                # Check if it starts with the standard template header text (starts with "LOGO")
                if blocks and blocks[0].upper().startswith("LOGO"):
                    # Extract header info
                    header_lines = blocks[0].splitlines()
                    company_name = "Synapse Digital"
                    company_addr = ""
                    if len(header_lines) > 1:
                        company_name = header_lines[1].strip()
                    if len(header_lines) > 2:
                        company_addr = ", ".join(l.strip() for l in header_lines[2:] if l.strip())
                    
                    # Extract title
                    doc_title = blocks[1] if len(blocks) > 1 else "Document"
                    
                    # Determine footer and signature
                    body_end_idx = len(blocks)
                    footer_text = f"Document généré par la plateforme RH {company_name}."
                    has_signature = False
                    
                    if len(blocks) > 2 and "document généré" in blocks[-1].lower():
                        footer_text = blocks[-1]
                        body_end_idx -= 1
                        
                    if body_end_idx > 2 and "signature" in blocks[body_end_idx - 1].lower():
                        has_signature = True
                        body_end_idx -= 1
                        
                    # Reconstruct body HTML
                    body_html = ""
                    for block in blocks[2:body_end_idx]:
                        block_lines = [l.strip() for l in block.splitlines() if l.strip()]
                        if any(":" in line for line in block_lines):
                            list_items = ""
                            for line in block_lines:
                                if ":" in line:
                                    k, v = line.split(":", 1)
                                    list_items += f"<div><span style='font-weight:bold;color:#475569;'>{k.strip()} :</span> {v.strip()}</div>"
                                else:
                                    list_items += f"<div>{line.strip()}</div>"
                            body_html += f"<div style='margin-bottom: 15px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; color: #334155;'>{list_items}</div>"
                        else:
                            escaped_block = block.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")
                            body_html += f"<p style='margin-bottom: 12px; text-align: justify;'>{escaped_block}</p>"
                else:
                    # Custom or plain document
                    company_name = "Synapse Digital"
                    company_addr = "Ressources Humaines"
                    doc_title = doc.type_doc or doc.code_modele or "Document"
                    footer_text = f"Généré par la plateforme RH {company_name}."
                    has_signature = doc.type_doc is not None and _requires_validation(doc.type_doc)
                    
                    escaped_content = text_content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")
                    body_html = f"<p style='margin-bottom: 12px; text-align: justify;'>{escaped_content}</p>"
                
                # Signature HTML
                signature_html = ""
                if has_signature:
                    signature_html = """
                    <div style="margin-top: 30px; text-align: right; color: #333;">
                        <div style="display: inline-block; width: 220px; border-top: 1px solid #333; margin-top: 30px; padding-top: 4px; font-size: 11px; text-align: center;">
                            Signature &amp; cachet RH
                        </div>
                    </div>
                    """
                
                # Render using the exact styles of _base.html.j2 but extremely clean and single-page
                html_content = f"""
                <!doctype html>
                <html>
                <head>
                <meta charset="utf-8"/>
                <style>
                    @page {{ margin: 20mm; }}
                    * {{ box-sizing: border-box; }}
                    body {{
                        font-family: Georgia, "Times New Roman", serif;
                        color: #1a1a1a;
                        line-height: 1.5;
                        font-size: 13px;
                        margin: 0;
                        padding: 0;
                    }}
                    .doc-header-table {{
                        width: 100%;
                        border-bottom: 2px solid #b8860b;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }}
                    .doc-logo {{
                        width: 50px;
                        height: 50px;
                        border: 1px dashed #b8860b;
                        border-radius: 6px;
                        color: #b8860b;
                        font-size: 10px;
                        text-align: center;
                        line-height: 50px;
                    }}
                    .doc-company {{
                        font-size: 12px;
                        color: #444;
                        line-height: 1.3;
                    }}
                    .doc-company b {{
                        font-size: 15px;
                        color: #1a1a1a;
                    }}
                    .doc-title {{
                        text-align: center;
                        font-weight: bold;
                        font-size: 18px;
                        margin: 15px 0 20px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        color: #1a1a1a;
                    }}
                    .doc-body {{
                        margin-top: 15px;
                        margin-bottom: 30px;
                    }}
                    .doc-footer {{
                        margin-top: 30px;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 10px;
                        color: #888;
                        font-size: 11px;
                        text-align: center;
                    }}
                </style>
                </head>
                <body>
                    <table class="doc-header-table">
                        <tr>
                            <td style="width: 60px; vertical-align: middle;">
                                <div class="doc-logo">LOGO</div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 10px;">
                                <div class="doc-company">
                                    <b>{company_name}</b><br/>
                                    {company_addr}
                                </div>
                            </td>
                        </tr>
                    </table>

                    <h1 class="doc-title">{doc_title}</h1>

                    <div class="doc-body">
                        {body_html}
                    </div>

                    {signature_html}

                    <div class="doc-footer">
                        {footer_text}
                    </div>
                </body>
                </html>
                """
            
            pdf_bytes = doc_preview.html_to_pdf(html_content)
            filename = doc.nom_fichier or f"document_{doc.id_document}.pdf"
            if not filename.endswith(".pdf"):
                filename = filename.rsplit(".", 1)[0] + ".pdf"
            
            uid = emp.id_utilisateur or emp.matricule if emp else doc.matricule
            object_name = f"hr-documents/{uid}/{doc.id_document}/{filename}"
            if storage.put_bytes(object_name, pdf_bytes, content_type="application/pdf"):
                repo.set_document_minio(db, doc.id_document, object_name)
                logger.info(f"Successfully generated and uploaded PDF for document {document_id}")
            else:
                logger.error(f"Failed to upload PDF for document {document_id} to MinIO")
        except Exception as e:
            logger.error(f"Erreur compilation/upload PDF bg for doc {document_id}: {e}")
