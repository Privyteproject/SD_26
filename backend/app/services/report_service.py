"""Génération de rapports RH PDF (ReportLab).

Produit un PDF formaté et auditable : effectifs, répartition par site, pyramide
des âges, masse salariale et alertes récentes. Repli en texte brut si ReportLab
n'est pas installé (l'endpoint reste fonctionnel).
"""

import io
from datetime import datetime

from sqlalchemy import select

from app.core.config import settings
from app.db import repository as repo


def _gather(db) -> dict:
    from app.db.models import Alerte
    counts = repo.dashboard_counts(db)
    alerts = list(db.scalars(select(Alerte).order_by(Alerte.date_creation.desc()).limit(10)))
    return {
        "counts": counts,
        "sites": repo.headcount_by_site(db),
        "pyramide": repo.age_pyramid(db),
        "masse": repo.salary_mass(db),
        "alertes": [(a.gravite, a.categorie, a.message) for a in alerts],
    }


def generate_pdf(db) -> tuple[bytes, str]:
    """Renvoie (contenu, content_type). PDF si ReportLab dispo, sinon texte brut."""
    data = _gather(db)
    stamp = datetime.now().strftime("%d/%m/%Y %H:%M")
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)
    except Exception:
        return _text_fallback(data, stamp), "text/plain; charset=utf-8"

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    elts = []

    elts.append(Paragraph(f"Rapport RH — {settings.COMPANY_NAME}", styles["Title"]))
    elts.append(Paragraph(f"Généré le {stamp} · Document auditable", styles["Normal"]))
    elts.append(Spacer(1, 10 * mm))

    def section(title):
        elts.append(Paragraph(title, styles["Heading2"]))

    def table(rows, header):
        t = Table([header] + rows, hAlign="LEFT")
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#b8860b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cccccc")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f1e7")]),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        elts.append(t)
        elts.append(Spacer(1, 7 * mm))

    c = data["counts"]
    section("Effectifs")
    table([[str(c.get("headcount", "—")), str(c.get("pending_requests", c.get("absences_pending", "—")))]],
          ["Effectif total", "Demandes en attente"])

    section("Répartition par site")
    table([[s["site"], str(s["count"])] for s in data["sites"]] or [["—", "0"]], ["Site", "Effectif"])

    section("Pyramide des âges")
    table([[p["tranche"], str(p["count"])] for p in data["pyramide"]], ["Tranche d'âge", "Effectif"])

    section("Masse salariale")
    m = data["masse"]
    table([[s["site"], f"{s['montant']:,.0f} €"] for s in m["by_site"]] + [["TOTAL", f"{m['total']:,.0f} €"]],
          ["Site", "Masse salariale annuelle"])

    section("Alertes récentes")
    table([[g, cat, (msg[:60])] for g, cat, msg in data["alertes"]] or [["—", "—", "Aucune"]],
          ["Gravité", "Catégorie", "Message"])

    doc.build(elts)
    return buf.getvalue(), "application/pdf"


def _text_fallback(data, stamp) -> bytes:
    lines = [f"RAPPORT RH — {settings.COMPANY_NAME}", f"Généré le {stamp}", "",
             f"Effectif total : {data['counts'].get('headcount', '—')}", "", "Par site :"]
    lines += [f"  - {s['site']} : {s['count']}" for s in data["sites"]]
    lines += ["", "Pyramide des âges :"]
    lines += [f"  - {p['tranche']} : {p['count']}" for p in data["pyramide"]]
    lines += ["", f"Masse salariale totale : {data['masse']['total']:,.0f} €"]
    return "\n".join(lines).encode("utf-8")
