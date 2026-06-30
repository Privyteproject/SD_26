"""Seed démo des humeurs hebdomadaires (climat social, anonymisé).

Génère des saisies d'humeur sur les 6 dernières semaines pour un échantillon de
collaborateurs, afin d'alimenter le climat agrégé (au-dessus du seuil d'anonymat).

    docker compose exec backend python -m app.db.seed_humeur
"""

import random
from datetime import date, timedelta

from sqlalchemy import delete, select

from app.db.base import SessionLocal
from app.db.models import Employe, Humeur


COMMENTS = [
    "Bonne semaine, ambiance d'équipe au top.",
    "Charge de travail un peu élevée en ce moment.",
    "Manque de visibilité sur les priorités.",
    "Merci pour le soutien du manager cette semaine.",
    "Les réunions sont trop nombreuses.",
    "Projet motivant, j'apprends beaucoup.",
    "Besoin de plus de reconnaissance.",
    "Outils parfois lents, ça ralentit le travail.",
    "Équilibre pro/perso correct cette semaine.",
    "Un peu de stress avant la deadline.",
]


def _isow(d) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def run():
    db = SessionLocal()
    try:
        mats = list(db.scalars(select(Employe.matricule).limit(80)))  # échantillon
        if not mats:
            print("Aucun employé. Lance d'abord un seed de base.")
            return
        db.execute(delete(Humeur).where(Humeur.matricule.in_(mats)))
        db.commit()
        today = date.today()
        rows = []
        for k in range(6):  # 6 dernières semaines
            wd = today - timedelta(weeks=k)
            sem = _isow(wd)
            for m in mats:
                if random.random() < 0.75:  # taux de réponse ~75 %
                    niveau = random.choices([1, 2, 3], weights=[12, 28, 60])[0]
                    com = random.choice(COMMENTS) if random.random() < 0.3 else None
                    rows.append(Humeur(matricule=m, semaine=sem, niveau=niveau, commentaire=com, date_saisie=wd))
        db.bulk_save_objects(rows)
        db.commit()
        print(f"OK — {len(rows)} humeurs (6 semaines) pour {len(mats)} collaborateurs (échantillon).")
    finally:
        db.close()


if __name__ == "__main__":
    run()
