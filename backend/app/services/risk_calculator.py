"""Calcul des scores de risque (désengagement) à partir des données métier.

Règles (déclenchables manuellement via l'endpoint de recalcul) :
- Burnout  : > 3 arrêts MALADIE sur les 6 derniers mois  -> niveau « high ».
- Turnover : > 3 ans d'ancienneté (date d'embauche)        -> niveau « high ».
  (Le « sans changement de poste » n'est pas historisé dans le schéma actuel :
   l'ancienneté seule sert d'approximation — à affiner si un historique de poste
   est ajouté.)

Le recalcul remplace les scores existants par les scores fraîchement calculés.
"""

from datetime import date, timedelta

from sqlalchemy import delete as sa_delete, func, select


def _niveau(value: float, high_at: float, mid_at: float) -> str:
    if value >= high_at:
        return "high"
    if value >= mid_at:
        return "mid"
    return "low"


def recompute(db) -> dict:
    """Recalcule tous les ScoreRisque (burnout + turnover). Renvoie un récapitulatif."""
    from app.db.models import Demande, Employe, ScoreRisque

    today = date.today()
    six_months_ago = today - timedelta(days=182)

    employees = list(db.scalars(select(Employe)))
    # On repart d'une base propre pour les types recalculés.
    db.execute(sa_delete(ScoreRisque).where(ScoreRisque.type.in_(["burnout", "turnover"])))

    created = 0
    high = 0
    for e in employees:
        # Règle 1 — Burnout : nb d'arrêts MALADIE sur 6 mois.
        maladie = db.scalar(
            select(func.count(Demande.id_demande)).where(
                Demande.matricule == e.matricule,
                Demande.code_type == "MALADIE",
                func.coalesce(Demande.date_debut, Demande.date_depot) >= six_months_ago,
            )
        ) or 0
        niveau_b = _niveau(maladie, high_at=4, mid_at=2)  # > 3 => high
        db.add(ScoreRisque(type="burnout", valeur=float(maladie), niveau=niveau_b,
                           date_calcul=today, matricule=e.matricule))
        created += 1
        high += niveau_b == "high"

        # Règle 2 — Turnover : ancienneté (années).
        anciennete = ((today - e.date_embauche).days / 365.0) if e.date_embauche else 0.0
        niveau_t = _niveau(anciennete, high_at=3.0, mid_at=2.0)  # > 3 ans => high
        db.add(ScoreRisque(type="turnover", valeur=round(anciennete, 1), niveau=niveau_t,
                           date_calcul=today, matricule=e.matricule))
        created += 1
        high += niveau_t == "high"

    db.commit()
    return {"employees": len(employees), "scores": created, "high": high,
            "date": today.isoformat()}
