"""Seed démo des Objectifs (OKR) & Bilans pour les comptes de démonstration.

Idempotent : purge puis recrée objectifs/Key Results/bilans des matricules visés.

    docker compose exec backend python -m app.db.seed_okr
"""

from datetime import date

from sqlalchemy import delete, select

from app.db.base import SessionLocal
from app.db.models import Bilan, Employe, KeyResult, Objectif

PERIODE = "2026-Q2"

# matricule -> liste d'objectifs (type, titre, description, [(libellé KR, cible, progression)])
OBJECTIFS = {
    "EMP008": [
        ("projet", "Livrer le module Paie v1", "Contribution au lancement du module paie.",
         [("Spécifier et maquetter les écrans", "100%", 80),
          ("Couvrir 80 % du code par des tests", "80%", 45)]),
        ("developpement", "Monter en compétence sur React avancé", "Plan de développement.",
         [("Suivre la formation React avancé", "1 formation", 60),
          ("Refactorer 2 modules clés", "2 modules", 30)]),
    ],
    "EMP002": [
        ("projet", "Améliorer l'engagement de l'équipe", "Pilotage managérial.",
         [("Atteindre un eNPS > 30", "eNPS 30", 50),
          ("Tenir des 1:1 mensuels", "100%", 100)]),
    ],
    "EMP003": [
        ("developpement", "Obtenir la certification en droit social", "Développement RH.",
         [("Réussir l'examen de certification", "Certifié", 30)]),
    ],
}

BILANS = [
    ("EMP008", "trimestriel", "2026-Q1",
     "Bonne intégration, montée en compétence rapide sur le frontend.",
     "Autonomie, qualité du code.", "Approfondir les tests automatisés.",
     "Évoluer vers un rôle de développeuse confirmée."),
    ("EMP002", "trimestriel", "2026-Q1",
     "Équipe stable, objectifs globalement atteints.",
     "Leadership, communication.", "Déléguer davantage.",
     "Prendre en charge un périmètre élargi."),
]


def run():
    db = SessionLocal()
    try:
        mats = list(OBJECTIFS)
        # Purge (KR via cascade sur Objectif).
        existing = list(db.scalars(select(Objectif.id_objectif).where(Objectif.matricule.in_(mats))))
        if existing:
            db.execute(delete(KeyResult).where(KeyResult.id_objectif.in_(existing)))
            db.execute(delete(Objectif).where(Objectif.id_objectif.in_(existing)))
        db.execute(delete(Bilan).where(Bilan.matricule.in_([b[0] for b in BILANS])))
        db.commit()

        n_obj = n_kr = 0
        for mat, objs in OBJECTIFS.items():
            if db.get(Employe, mat) is None:
                continue
            for type_obj, titre, desc, krs in objs:
                o = Objectif(matricule=mat, periode=PERIODE, type_obj=type_obj, titre=titre,
                             description=desc, statut="actif")
                db.add(o)
                db.flush()
                n_obj += 1
                for lib, cible, prog in krs:
                    db.add(KeyResult(id_objectif=o.id_objectif, libelle=lib, cible=cible, progression=prog))
                    n_kr += 1
        for mat, tb, per, syn, pf, axes, asp in BILANS:
            if db.get(Employe, mat) is None:
                continue
            db.add(Bilan(matricule=mat, type_bilan=tb, periode=per, synthese=syn, points_forts=pf,
                         axes_amelioration=axes, aspirations=asp, auteur="manager@demo", date_bilan=date.today()))
        db.commit()
        print(f"OK — {n_obj} objectifs, {n_kr} key results, {len(BILANS)} bilans (période {PERIODE}).")
    finally:
        db.close()


if __name__ == "__main__":
    run()
