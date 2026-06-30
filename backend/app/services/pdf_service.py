"""Génération PDF d'un document RH individuel (ReportLab).

Produit un PDF propre et auditable (en-tête société, titre, corps, pied de page)
à partir d'un titre + corps texte. Repli en texte brut si ReportLab est absent —
l'appelant choisit alors le bon Content-Type.
"""

import io
from datetime import date

from app.core.config import settings


def build_pdf(title: str, body: str, *, subtitle: str | None = None) -> tuple[bytes, str]:
    """Renvoie (contenu, content_type). PDF si ReportLab dispo, sinon texte brut."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import (HRFlowable, Paragraph, SimpleDocTemplate, Spacer)
    except Exception:
        return _text(title, subtitle, body), "text/plain; charset=utf-8"

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=22 * mm, bottomMargin=18 * mm,
                            leftMargin=22 * mm, rightMargin=22 * mm,
                            title=title, author=settings.COMPANY_NAME)
    styles = getSampleStyleSheet()
    company = ParagraphStyle("company", parent=styles["Normal"], fontSize=10,
                             textColor=colors.HexColor("#555555"))
    h_title = ParagraphStyle("htitle", parent=styles["Title"], fontSize=18, spaceAfter=4)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10, alignment=TA_CENTER,
                         textColor=colors.HexColor("#888888"), spaceAfter=8)
    para = ParagraphStyle("para", parent=styles["Normal"], fontSize=11, leading=16, spaceAfter=6)
    foot = ParagraphStyle("foot", parent=styles["Normal"], fontSize=8.5,
                          textColor=colors.HexColor("#999999"))

    elts = [
        Paragraph(f"<b>{settings.COMPANY_NAME}</b>", company),
        Spacer(1, 2 * mm),
        HRFlowable(width="100%", thickness=1.2, color=colors.HexColor("#b8860b")),
        Spacer(1, 8 * mm),
        Paragraph(title, h_title),
    ]
    if subtitle:
        elts.append(Paragraph(subtitle, sub))
    elts.append(Spacer(1, 4 * mm))
    for block in (body or "").split("\n"):
        block = block.strip()
        elts.append(Paragraph(block.replace("&", "&amp;"), para) if block else Spacer(1, 3 * mm))
    elts += [
        Spacer(1, 12 * mm),
        HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#dddddd")),
        Spacer(1, 2 * mm),
        Paragraph(f"Émis le {date.today().strftime('%d/%m/%Y')} · "
                  f"Document généré par la plateforme RH {settings.COMPANY_NAME}.", foot),
    ]
    doc.build(elts)
    return buf.getvalue(), "application/pdf"


def _text(title, subtitle, body) -> bytes:
    head = f"{settings.COMPANY_NAME} — {title}\n{'=' * 52}\n"
    if subtitle:
        head += f"{subtitle}\n"
    return f"{head}\n{body or ''}\n".encode("utf-8")
