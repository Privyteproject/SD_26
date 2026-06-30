"""Renomme tous les collaborateurs avec des noms MAROCAINS et aligne leurs e-mails sur le nom.

Idempotent : réexécutable. Conserve matricules et relations. E-mail = prenom.nom@waminey.ma (unique).
N'affecte PAS les comptes de connexion démo (@synapse.io), qui ne sont pas des employés.
Exécution :  docker compose exec backend python -m app.db.seed_moroccan_names
"""

import re
import unicodedata

from sqlalchemy import select

from app.db.base import SessionLocal

EMAIL_DOMAIN = "waminey.ma"


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", s.lower())

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


# ⚠️ DÉPRÉCIÉ — ce module ne fournit plus que les POOLS de noms (NOMS, PRENOMS_M/F, slugify),
# importés par advanced_seed. La passe de RENOMMAGE est désactivée : elle réécrivait les noms
# de TOUS les employés à chaque exécution (indexés par position), ce qui cassait la recherche
# et l'assistant. Les identités sont désormais générées de façon DÉTERMINISTE par advanced_seed
# (seed fixe) ; il ne faut donc plus jamais relancer un renommage global.
def run():
    print("DÉSACTIVÉ : le renommage global déstabilisait les identités. "
          "Les noms sont générés de façon déterministe par advanced_seed (seed fixe). "
          "Aucune action effectuée.")


if __name__ == "__main__":
    run()
