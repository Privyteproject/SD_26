"""Renomme tous les collaborateurs avec des noms MAROCAINS (déterministe, respecte le genre).

Idempotent : réexécutable. Conserve matricules, e-mails, relations (seul prenom/nom change).
Exécution :  docker compose exec backend python -m app.db.seed_moroccan_names
"""

from sqlalchemy import select

from app.db.base import SessionLocal

PRENOMS_M = [
    "Mohamed", "Youssef", "Ahmed", "Omar", "Hamza", "Anas", "Mehdi", "Bilal", "Reda", "Yassine",
    "Khalid", "Said", "Karim", "Amine", "Ayoub", "Othmane", "Soufiane", "Hicham", "Tarik", "Nabil",
    "Rachid", "Adil", "Zakaria", "Ismail", "Marouane", "Abdellah", "Driss", "Jalal", "Noureddine", "Walid",
]
PRENOMS_F = [
    "Fatima", "Khadija", "Aicha", "Salma", "Imane", "Sara", "Hajar", "Nadia", "Meriem", "Hanae",
    "Yasmine", "Loubna", "Sanaa", "Najat", "Houda", "Ghita", "Amal", "Asmae", "Kenza", "Nawal",
    "Siham", "Wafaa", "Btissam", "Sofia", "Lina", "Zineb", "Rania", "Oumaima", "Chaimae", "Maryam",
]
NOMS = [
    "Alami", "Bennani", "Benali", "Cherkaoui", "El Idrissi", "El Fassi", "Bouzidi", "Haddad", "Naciri",
    "Tazi", "Berrada", "Sefrioui", "El Amrani", "Lahlou", "Bennis", "El Khattabi", "Chraibi", "Belkadi",
    "Ouazzani", "El Mansouri", "Sabri", "Daoudi", "El Ghazali", "Benjelloun", "Kabbaj", "Lamrani",
    "El Yousfi", "Filali", "Saidi", "Mernissi", "Bouhaddou", "Zerouali", "Hassani", "Benchekroun",
    "Skalli", "Aboulkacem", "Bargach", "Sqalli", "El Alaoui", "Karimi",
]


def run():
    db = SessionLocal()
    from app.db.models import Employe
    emps = list(db.scalars(select(Employe).order_by(Employe.matricule)))
    n = 0
    for i, e in enumerate(emps):
        g = (e.genre or "")
        pool = PRENOMS_M if g == "M" else PRENOMS_F if g == "F" else (PRENOMS_M if i % 2 == 0 else PRENOMS_F)
        e.prenom = pool[i % len(pool)]
        e.nom = NOMS[(i * 7 + 3) % len(NOMS)]
        n += 1
    db.commit()
    print(f"{n} collaborateurs renommés (noms marocains).")


if __name__ == "__main__":
    run()
