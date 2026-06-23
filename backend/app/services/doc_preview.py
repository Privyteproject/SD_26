"""Workflow de génération documentaire en 2 temps (preview -> submit).

- Jeton de prévisualisation signé HMAC-SHA256 (anti-falsification).
- Données de preview stockées dans Redis (TTL court), jamais en base à cette étape.
- Rendu via templates Jinja2 `app/templates/documents/{type}.html.j2` (HTML imprimable).
"""

import hashlib
import hmac
import os
import re
import secrets
from datetime import date, datetime
from jinja2 import Environment, FileSystemLoader, select_autoescape, Undefined
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.document_types import DOCUMENT_TYPES, label_of

class SilentUndefined(Undefined):
    """Jinja undefined handler that absorbs any nested attributes/calls and renders as empty string."""
    def __getattr__(self, name):
        return self
    def __getitem__(self, key):
        return self
    def __str__(self):
        return ""
    def __html__(self):
        return ""
    def __call__(self, *args, **kwargs):
        return self

_TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
_ENV = None


def _format_date(value):
    if isinstance(value, (date, datetime)):
        return value.strftime("%d/%m/%Y")
    return str(value) if value is not None else ""


def _env():
    global _ENV
    if _ENV is not None:
        return _ENV

    _ENV = Environment(
        # On cherche à la racine ET dans documents/ pour que `{% extends "_base.html.j2" %}`
        # résolve le base situé dans documents/.
        loader=FileSystemLoader([_TEMPLATES_DIR, os.path.join(_TEMPLATES_DIR, "documents")]),
        autoescape=select_autoescape(["html", "j2"]),
        undefined=SilentUndefined,
    )
    _ENV.filters["format_date"] = _format_date
    return _ENV


# ───────────── Jeton signé ─────────────
def make_token() -> tuple[str, str]:
    nonce = secrets.token_urlsafe(16)
    sig = hmac.new(settings.DOC_PREVIEW_SECRET.encode(), nonce.encode(), hashlib.sha256).hexdigest()[:24]
    return f"{nonce}.{sig}", nonce


def verify_token(token: str) -> str | None:
    try:
        nonce, sig = token.split(".", 1)
    except (ValueError, AttributeError):
        return None
    expected = hmac.new(settings.DOC_PREVIEW_SECRET.encode(), nonce.encode(), hashlib.sha256).hexdigest()[:24]
    return nonce if hmac.compare_digest(sig, expected) else None


# ───────────── Rendu ─────────────
def _html_to_text(html: str) -> str:
    import html as _h
    # Retire d'abord les blocs <style>/<script> (leur contenu n'est pas du texte).
    txt = re.sub(r"(?is)<(style|script)[^>]*>.*?</\1>", "", html)
    txt = re.sub(r"(?i)</p>|<br\s*/?>|</h1>|</div>", "\n", txt)
    txt = re.sub(r"<[^>]+>", "", txt)
    txt = _h.unescape(txt)
    txt = re.sub(r"\n{3,}", "\n\n", txt)
    return "\n".join(line.strip() for line in txt.splitlines()).strip()


def _fallback_html(label: str, emp: dict, additional: dict) -> str:
    nom = f"{emp.get('prenom', '')} {emp.get('nom', '')}".strip()
    objet = additional.get("objet") or additional.get("motif") or ""
    return f"""
    <html>
    <head>
    <style>
        body {{
            background-color: #f8fafc;
            margin: 0;
            padding: 24px;
            display: flex;
            justify-content: center;
            font-family: Georgia, serif;
        }}
        .page {{
            background: #ffffff;
            width: 100%;
            max-width: 800px;
            min-height: 200mm;
            padding: 50px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-sizing: border-box;
            color: #1b1b1b;
            line-height: 1.6;
        }}
    </style>
    </head>
    <body>
        <div class="page">
            <h2 style='text-align:center'>{label}</h2>
            <p>{settings.COMPANY_NAME} certifie les informations relatives à 
            <b>{nom}</b> ({emp.get('poste') or '—'}).</p>
            {f'<p>Objet : {objet}</p>' if objet else ''}
            <p style='color:#888;font-size:12px;margin-top:40px;'>{_format_date(date.today())} — 
            Document généré par la plateforme RH</p>
        </div>
    </body>
    </html>
    """


def html_to_pdf(html_content: str) -> bytes:
    """Compile du contenu HTML en binaire PDF via xhtml2pdf."""
    import io
    from xhtml2pdf import pisa

    pdf_io = io.BytesIO()
    pisa_status = pisa.CreatePDF(html_content, dest=pdf_io)
    if pisa_status.err:
        raise RuntimeError("Erreur lors de la génération du PDF")
    return pdf_io.getvalue()


def find_modele_document(db: Session, doc_type: str):
    """Looks up ModeleDocument by normalized keys to handle matching attestation_travail to ATTEST_TRAVAIL."""
    from app.db.models import ModeleDocument
    
    # 1. Direct code lookup
    m = db.get(ModeleDocument, doc_type)
    if m:
        return m
        
    # 2. Normalize and check
    norm = doc_type.upper().replace("-", "_")
    m = db.get(ModeleDocument, norm)
    if m:
        return m
        
    # 3. Check alias prefixes
    if norm.startswith("ATTEST_"):
        norm_alt = norm.replace("ATTEST_", "ATTESTATION_", 1)
        m = db.get(ModeleDocument, norm_alt)
        if m:
            return m
    if norm.startswith("ATTESTATION_"):
        norm_alt = norm.replace("ATTESTATION_", "ATTEST_", 1)
        m = db.get(ModeleDocument, norm_alt)
        if m:
            return m
            
    # 4. Fallback search (exact, prefix, or normalized compare)
    for row in db.query(ModeleDocument).all():
        code = row.code_modele.upper()
        if code == norm or code.replace("_", "") == norm.replace("_", ""):
            return row
        if norm.startswith(code) or code.startswith(norm[:15]):
            return row
            
    return None


def resolve_context_value(field_name: str, ctx: dict) -> str:
    # 0. Dynamic fallback for full name
    norm_field = field_name.lower().replace("_", ".").replace("employee.", "")
    if norm_field in ("nom_complet", "nomcomplet", "fullname", "name"):
        emp = ctx.get("employee") or ctx
        if isinstance(emp, dict):
            prenom = emp.get("prenom") or ""
            nom = emp.get("nom") or ""
            if prenom or nom:
                return f"{prenom} {nom}".strip()

    # 1. Direct match in ctx
    if field_name in ctx:
        val = ctx[field_name]
        return _format_date(val) if val is not None else ""

    # 2. Dot notation (e.g. employee.nom)
    parts = field_name.split(".")
    val = ctx
    for p in parts:
        if isinstance(val, dict) and p in val:
            val = val[p]
        else:
            val = None
            break
    if val is not None:
        return _format_date(val)

    # 3. Underscore fallback (e.g. employee_nom -> employee.nom)
    parts = field_name.split("_")
    val = ctx
    for p in parts:
        if isinstance(val, dict) and p in val:
            val = val[p]
        else:
            val = None
            break
    if val is not None:
        return _format_date(val)

    # 4. Check keys inside sub-dicts
    for k, v in ctx.items():
        if isinstance(v, dict) and field_name in v:
            return _format_date(v[field_name])

    return ""


def fill_docx_template(docx_bytes: bytes, ctx: dict) -> bytes:
    import io
    from docx import Document
    from jinja2 import Environment

    doc = Document(io.BytesIO(docx_bytes))
    env = Environment(undefined=SilentUndefined)
    env.filters["format_date"] = _format_date

    def process_paragraph(p):
        full_text = p.text
        if "{{" in full_text:
            try:
                rendered = env.from_string(full_text).render(**ctx)
                if rendered != full_text:
                    if len(p.runs) > 0:
                        p.runs[0].text = rendered
                        for r in p.runs[1:]:
                            r.text = ""
                    else:
                        p.text = rendered
            except Exception:
                pass

    for p in doc.paragraphs:
        process_paragraph(p)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    process_paragraph(p)

    out_io = io.BytesIO()
    doc.save(out_io)
    return out_io.getvalue()


def fill_pdf_template(pdf_bytes: bytes, ctx: dict) -> bytes:
    import io
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    writer.append(reader)

    # Resolve values for fields
    fields_to_update = {}
    fields = reader.get_fields()
    if fields:
        for field_name in fields.keys():
            val = resolve_context_value(field_name, ctx)
            if val:
                fields_to_update[field_name] = val

    if fields_to_update:
        # Update fields on all pages
        writer.update_page_form_field_values(None, fields_to_update, flatten=True)

    out_io = io.BytesIO()
    writer.write(out_io)
    return out_io.getvalue()


def docx_to_html_preview(docx_bytes: bytes) -> str:
    import io
    from docx import Document
    doc = Document(io.BytesIO(docx_bytes))
    html = ["""
    <html>
    <head>
    <style>
        body {
            background-color: #f8fafc;
            margin: 0;
            padding: 24px;
            display: flex;
            justify-content: center;
            font-family: Georgia, serif;
        }
        .page {
            background: #ffffff;
            width: 100%;
            max-width: 800px;
            min-height: 297mm;
            padding: 50px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-sizing: border-box;
            color: #1b1b1b;
            line-height: 1.6;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 15px;
            border-color: #e2e8f0;
        }
        td {
            padding: 8px;
            font-size: 12px;
            border: 1px solid #e2e8f0;
        }
        .alert {
            background: #fffdf5;
            border: 1px solid #fbeed5;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 13px;
            color: #b8860b;
            font-family: sans-serif;
        }
    </style>
    </head>
    <body>
        <div class="page">
            <div class="alert">
                <strong>Aperçu du document Word (.docx) :</strong> Les styles et la mise en page originaux du document Word seront conservés lors du téléchargement final.
            </div>
    """]
    
    for p in doc.paragraphs:
        text = p.text.strip()
        if text:
            if p.style.name.startswith("Heading"):
                html.append(f"<h3 style='color:#1a1a1a; margin-top:20px; margin-bottom:10px;'>{text}</h3>")
            else:
                html.append(f"<p style='margin-bottom:12px; text-align:justify;'>{text}</p>")
                
    for table in doc.tables:
        html.append("<table border='1' style='border-collapse:collapse; width:100%; margin-bottom:15px; border-color:#e2e8f0;'>")
        for row in table.rows:
            html.append("<tr>")
            for cell in row.cells:
                html.append(f"<td style='padding:8px; font-size:12px; border:1px solid #e2e8f0;'>{cell.text}</td>")
            html.append("</tr>")
        html.append("</table>")
        
    html.append("</div></body></html>")
    return "\n".join(html)


def render_binary_template(db: Session, doc_type: str, emp: dict, additional: dict | None = None) -> tuple[str, bytes, str, str] | None:
    """Rend un modèle binaire et renvoie (document_name, binary_bytes, format, text_content).
    Renvoie None s'il ne s'agit pas d'un modèle binaire."""
    additional = additional or {}
    modele = find_modele_document(db, doc_type)
    if not modele or not modele.gabarit:
        return None
        
    import json
    if not modele.gabarit.strip().startswith("{"):
        return None
        
    try:
        meta = json.loads(modele.gabarit)
        if not meta.get("is_binary"):
            return None
            
        fmt = meta.get("format").lower()
        binary_bytes = None
        
        # Try MinIO first if available
        from app.services import storage
        minio_key = meta.get("minio_key")
        if minio_key and storage.available():
            binary_bytes = storage.get_bytes(minio_key)
            
        # Fallback to base64
        if not binary_bytes and meta.get("content_b64"):
            import base64
            binary_bytes = base64.b64decode(meta["content_b64"])
            
        if not binary_bytes:
            return None
            
        label = label_of(doc_type)
        ctx = {
            "employee": emp,
            "additional": additional,
            "company": {"nom": settings.COMPANY_NAME, "adresse": settings.COMPANY_ADDRESS},
            "date_generation": _format_date(date.today()),
            "label": label,
            "requires_rh_validation": DOCUMENT_TYPES.get(doc_type, {}).get("requires_rh_validation", False),
            **additional,
        }
        
        document_name = f"{doc_type}_{emp.get('matricule', 'doc')}.{fmt}"
        
        if fmt == "docx":
            filled_bytes = fill_docx_template(binary_bytes, ctx)
            from docx import Document
            import io
            doc = Document(io.BytesIO(filled_bytes))
            text_content = "\n".join(p.text for p in doc.paragraphs)
            for t in doc.tables:
                for r in t.rows:
                    text_content += "\n" + " | ".join(c.text for c in r.cells)
            return document_name, filled_bytes, fmt, text_content
            
        elif fmt == "pdf":
            filled_bytes = fill_pdf_template(binary_bytes, ctx)
            from pypdf import PdfReader
            import io
            text_content = ""
            try:
                reader = PdfReader(io.BytesIO(filled_bytes))
                for page in reader.pages:
                    text_content += page.extract_text() or ""
            except Exception:
                pass
            return document_name, filled_bytes, fmt, text_content
            
    except Exception:
        pass
        
    return None


def render(db: Session, doc_type: str, emp: dict, additional: dict | None = None) -> tuple[str, str, str]:
    """Renvoie (document_name, html_preview, text_content)."""
    additional = additional or {}
    label = label_of(doc_type)
    
    # Try rendering binary template
    bin_res = render_binary_template(db, doc_type, emp, additional)
    if bin_res:
        document_name, filled_bytes, fmt, text_content = bin_res
        if fmt == "docx":
            html_preview = docx_to_html_preview(filled_bytes)
            return document_name, html_preview, text_content
        elif fmt == "pdf":
            # Iframe embedding PDF preview with Token replacement placeholder
            api_prefix = "/api/v1"
            html_preview = f'<iframe src="{api_prefix}/documents/preview/pdf?token=TOKEN_PLACEHOLDER#toolbar=0&navpanes=0&view=Fit" style="width:100%; height:100%; border:none; background:#ffffff; border-radius:6px;"></iframe>'
            return document_name, html_preview, text_content

    # Try database-stored template first (Jinja HTML)
    modele = find_modele_document(db, doc_type)
    ctx = {
        "employee": emp,
        "additional": additional,
        "company": {"nom": settings.COMPANY_NAME, "adresse": settings.COMPANY_ADDRESS},
        "date_generation": _format_date(date.today()),
        "label": label,
        "requires_rh_validation": DOCUMENT_TYPES.get(doc_type, {}).get("requires_rh_validation", False),
        **additional,  # champs spécifiques accessibles directement ({{ objet }}, {{ motif }}…)
    }
    
    if modele and modele.gabarit:
        try:
            env = Environment(undefined=SilentUndefined)
            env.filters["format_date"] = _format_date
            html = env.from_string(modele.gabarit).render(**ctx)
            return f"{doc_type}_{emp.get('matricule', 'doc')}.pdf", html, _html_to_text(html)
        except Exception:
            pass  # Fallback to local files if rendering error occurs

    try:
        html = _env().get_template(f"documents/{doc_type}.html.j2").render(**ctx)
    except Exception:
        html = _fallback_html(label, emp, additional)
    return f"{doc_type}_{emp.get('matricule', 'doc')}.pdf", html, _html_to_text(html)
