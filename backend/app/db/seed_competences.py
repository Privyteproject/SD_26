"""Seed du référentiel Carrières & Compétences (démo).

Crée le catalogue de compétences (hard/soft), les métiers (alignés sur les postes
existants), les compétences requises par niveau, et quelques auto-évaluations pour les
comptes démo (dont une partie validée) afin de peupler radar, file de validation et écarts.

Idempotent : catalogue/métiers créés s'ils manquent ; requis et évaluations démo réinitialisés.

    docker compose exec backend python -m app.db.seed_competences
"""

import random
import unicodedata
from datetime import date

from sqlalchemy import delete, select

from app.db.base import SessionLocal
from app.db.models import (Competence, CompetenceRequise, Employe, EvaluationCompetence,
                           Metier, NIVEAUX_CARRIERE)

# Catalogue : (nom, categorie, sous_categorie)
CATALOGUE = [
    ("Python", "hard", "Technologies"),
    ("JavaScript / React", "hard", "Technologies"),
    ("SQL & Bases de données", "hard", "Technologies"),
    ("Architecture logicielle", "hard", "Méthodologies"),
    ("Gestion de projet", "hard", "Gestion de projet"),
    ("Analyse de données", "hard", "Expertise métier"),
    ("Négociation commerciale", "hard", "Expertise métier"),
    ("Droit social", "hard", "Expertise métier"),
    ("Anglais", "hard", "Langues"),
    ("Communication", "soft", None),
    ("Travail d'équipe", "soft", None),
    ("Leadership", "soft", None),
    ("Esprit d'analyse", "soft", None),
    ("Adaptabilité", "soft", None),
    ("Gestion du stress", "soft", None),
]

# Métier : (description, missions, responsabilités, [compétences])
METIERS = {
    "Développeur": ("Conçoit, développe et maintient les applications.",
                    "Développement, tests, revue de code, documentation.",
                    "Qualité du code, respect des délais, sécurité.",
                    ["Python", "JavaScript / React", "SQL & Bases de données", "Architecture logicielle",
                     "Esprit d'analyse", "Travail d'équipe", "Communication", "Anglais"]),
    "Architecte": ("Définit l'architecture technique des solutions.",
                   "Conception, choix technologiques, encadrement technique.",
                   "Cohérence, scalabilité, sécurité du SI.",
                   ["Architecture logicielle", "Python", "SQL & Bases de données", "Gestion de projet",
                    "Leadership", "Communication", "Esprit d'analyse"]),
    "Commercial": ("Développe et fidélise le portefeuille clients.",
                   "Prospection, négociation, suivi client.",
                   "Atteinte des objectifs, satisfaction client.",
                   ["Négociation commerciale", "Communication", "Adaptabilité", "Travail d'équipe",
                    "Anglais", "Gestion du stress"]),
    "Chargé RH": ("Gère l'administration et l'accompagnement RH.",
                  "Recrutement, paie, conformité, accompagnement.",
                  "Conformité loi 09-08, qualité de service RH.",
                  ["Droit social", "Communication", "Travail d'équipe", "Esprit d'analyse", "Gestion de projet"]),
    "Analyste": ("Exploite les données pour éclairer la décision.",
                 "Collecte, analyse, restitution de données.",
                 "Fiabilité des analyses, pertinence des restitutions.",
                 ["Analyse de données", "SQL & Bases de données", "Python", "Esprit d'analyse", "Communication"]),
    "Chef de projet": ("Pilote les projets de bout en bout.",
                       "Planification, coordination, suivi.",
                       "Respect coûts/délais/qualité.",
                       ["Gestion de projet", "Leadership", "Communication", "Travail d'équipe", "Gestion du stress"]),
    "Manager": ("Encadre et fait grandir son équipe.",
                "Animation d'équipe, objectifs, feedback.",
                "Engagement et performance de l'équipe.",
                ["Leadership", "Communication", "Gestion de projet", "Travail d'équipe",
                 "Gestion du stress", "Adaptabilité"]),
    "Ingénieur": ("Conçoit et fiabilise les solutions techniques.",
                  "Conception, développement, fiabilisation.",
                  "Robustesse et performance technique.",
                  ["Python", "Architecture logicielle", "SQL & Bases de données", "Esprit d'analyse",
                   "Gestion de projet", "Anglais"]),
    "Consultant": ("Accompagne les clients sur leurs projets.",
                   "Conseil, cadrage, recommandations.",
                   "Valeur livrée au client.",
                   ["Gestion de projet", "Communication", "Négociation commerciale", "Adaptabilité", "Anglais"]),
    "Comptable": ("Gère la comptabilité et la conformité financière.",
                  "Saisie, contrôle, reporting financier.",
                  "Fiabilité des comptes, conformité.",
                  ["Analyse de données", "SQL & Bases de données", "Droit social", "Esprit d'analyse", "Communication"]),
    "Support client": ("Assiste et fidélise les clients.",
                       "Assistance, résolution, suivi.",
                       "Satisfaction et réactivité.",
                       ["Communication", "Adaptabilité", "Travail d'équipe", "Gestion du stress", "Anglais"]),
    "Designer": ("Conçoit l'expérience et les interfaces.",
                 "Maquettes, UX/UI, cohérence visuelle.",
                 "Qualité et cohérence de l'expérience.",
                 ["JavaScript / React", "Communication", "Esprit d'analyse", "Travail d'équipe", "Adaptabilité"]),
}

# Auto-évaluations démo : matricule -> [(compétence, niveau_auto)]
EVALS = {
    "EMP008": [("Python", 4), ("JavaScript / React", 3), ("SQL & Bases de données", 3),
               ("Communication", 4), ("Esprit d'analyse", 3)],
    "EMP003": [("Droit social", 4), ("Communication", 4), ("Travail d'équipe", 4), ("Gestion de projet", 2)],
    "EMP002": [("Leadership", 4), ("Communication", 5), ("Gestion de projet", 3), ("Travail d'équipe", 4)],
}
# Compétences déjà validées par un expert (sous-ensemble) : (matricule, compétence, niveau_expert)
VALIDATED = [("EMP008", "Python", 4), ("EMP003", "Droit social", 5), ("EMP002", "Leadership", 4)]


def run():
    db = SessionLocal()
    try:
        # 1) Catalogue de compétences (créé si absent).
        by_nom = {c.nom: c for c in db.scalars(select(Competence))}
        for nom, cat, sous in CATALOGUE:
            if nom not in by_nom:
                c = Competence(nom=nom, categorie=cat, sous_categorie=sous,
                               methode_evaluation="Auto-évaluation + validation expert")
                db.add(c)
        db.commit()
        by_nom = {c.nom: c for c in db.scalars(select(Competence))}

        # 2) Métiers (créés si absents).
        by_metier = {m.nom: m for m in db.scalars(select(Metier))}
        for nom, (desc, miss, resp, _comps) in METIERS.items():
            if nom not in by_metier:
                db.add(Metier(nom=nom, description=desc, missions=miss, responsabilites=resp))
        db.commit()
        by_metier = {m.nom: m for m in db.scalars(select(Metier))}

        # 3) Compétences requises par niveau (réinitialisées pour les métiers seedés).
        ids = [by_metier[n].id_metier for n in METIERS]
        db.execute(delete(CompetenceRequise).where(CompetenceRequise.id_metier.in_(ids)))
        db.commit()
        for nom, (_d, _m, _r, comps) in METIERS.items():
            mid = by_metier[nom].id_metier
            for idx, niveau in enumerate(NIVEAUX_CARRIERE):
                attendu = min(5, 2 + idx)  # Junior 2 → Expert 5
                for cnom in comps:
                    c = by_nom.get(cnom)
                    if c:
                        db.add(CompetenceRequise(id_metier=mid, niveau=niveau,
                                                 id_competence=c.id_competence, niveau_attendu=attendu))
        db.commit()

        # 4) Réinitialise TOUTES les évaluations puis régénère.
        db.execute(delete(EvaluationCompetence))
        db.commit()

        # Map métier -> compétences distinctes (depuis les requis), pour générer les évals.
        comps_by_metier = {}
        for nom, (_d, _m, _r, comps) in METIERS.items():
            mid = by_metier[nom].id_metier
            comps_by_metier[mid] = [by_nom[c].id_competence for c in comps if c in by_nom]

        # Résolveur poste -> métier (préchargé, sans requête par employé).
        def _norm(s):
            return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
        metiers_idx = [(m, _norm(m.nom)) for m in by_metier.values()]

        def resolve(poste):
            p = _norm(poste)
            pt = p.split()[0] if p.split() else p
            for m, n in metiers_idx:
                nt = n.split()[0] if n.split() else n
                if n in p or p in n or (len(nt) >= 5 and (pt.startswith(nt[:5]) or nt.startswith(pt[:5]))):
                    return m
            return None

        # 4a) Population : évaluations pour tous les employés (hors comptes démo curatés).
        demo = set(EVALS)
        today = date.today()
        pop_rows = []
        for e in db.scalars(select(Employe)):
            if e.matricule in demo:
                continue
            metier = resolve(e.poste)
            if metier is None:
                continue
            for cid in comps_by_metier.get(metier.id_metier, []):
                auto = random.choices([2, 3, 4, 5], weights=[20, 40, 30, 10])[0]
                # La base population est une RÉFÉRENCE établie (radar / ML) : déjà validée,
                # pour ne pas noyer la file de validation avec des milliers d'auto-évaluations.
                pop_rows.append(EvaluationCompetence(
                    matricule=e.matricule, id_competence=cid, niveau_auto=auto,
                    niveau_expert=auto, statut="valide",
                    evaluateur="système (référence)", date_evaluation=today))
        db.bulk_save_objects(pop_rows)
        db.commit()

        # 4b) Comptes démo : évaluations curatées (radar + file de validation).
        validated_set = {(m, c): n for m, c, n in VALIDATED}
        n_eval = 0
        for mat, items in EVALS.items():
            for cnom, auto in items:
                c = by_nom.get(cnom)
                if not c:
                    continue
                exp = validated_set.get((mat, cnom))
                db.add(EvaluationCompetence(
                    matricule=mat, id_competence=c.id_competence, niveau_auto=auto,
                    niveau_expert=exp, statut=("valide" if exp is not None else "auto"),
                    evaluateur=("rh@demo" if exp is not None else None),
                    date_evaluation=today))
                n_eval += 1
        db.commit()

        print(f"OK — {len(by_nom)} compétences, {len(by_metier)} métiers, requis régénérés, "
              f"{len(pop_rows)} évaluations population + {n_eval} évaluations démo.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
