"""Moteurs RH spécialisés de la branche 4A (schéma RAG v2).

Le routage `type_rh` (issu du classifieur) dirige vers le bon moteur :
  - E1  question RH simple / sensible -> RAG documentaire (géré par le pipeline)
  - E2  génération documentaire       -> modèles de documents + profil employé
  - E3  onboarding / offboarding      -> tâches RÉELLES du parcours de l'employé
  - E4  analytics prédictif           -> indicateurs RH + scores de risque réels

Contrairement à E1 (recherche vectorielle ChromaDB), E2/E3/E4 ancrent la réponse
sur les VRAIES données applicatives (repository). Chaque moteur renvoie
{engine, system, context, sources} : le pipeline injecte `context` dans le prompt
puis appelle le LLM avec `system`. Aucune invention : si une donnée est absente,
le contexte le signale explicitement.

Ce module NE touche pas à ChromaDB, aux modèles SQLAlchemy ni au RBAC : le
contrôle d'accès (notamment pour le prédictif/sensible) est appliqué en amont
par le pipeline avant tout appel ici.
"""

from app.db import repository as repo

# type_rh (classifieur) -> identifiant de moteur. Absent => E1 (RAG documentaire).
_ENGINE_BY_TYPE = {
    "generation": "E2",
    "parcours": "E3",
    "predictive": "E4",
}

SYSTEM_PROMPT_GENERATION = (
    "Tu es l'assistant RH de « Synapse Digital », spécialisé dans la préparation de "
    "documents administratifs. À partir des modèles de documents et du profil de "
    "l'employé fournis ci-dessous, aide la personne à préparer/rédiger le document "
    "demandé. N'invente AUCUNE donnée personnelle absente du contexte : "
    "laisse un champ « à compléter » le cas échéant. Précise que le document devra "
    "être validé par les RH via le module Documents."
)
SYSTEM_PROMPT_PARCOURS = (
    "Tu es l'assistant RH de « Synapse Digital » pour les parcours d'intégration et de "
    "départ. Réponds UNIQUEMENT à partir des tâches réelles du parcours "
    "fournies ci-dessous (libellé, statut, échéance). N'invente aucune tâche. Si aucune "
    "tâche n'est définie, invite la personne à contacter son référent RH."
)
SYSTEM_PROMPT_ANALYTICS = (
    "Tu es l'assistant analytique RH de « Synapse Digital ». Réponds "
    "UNIQUEMENT à partir des indicateurs et scores de risque réels fournis ci-dessous. "
    "Donne une lecture factuelle et prudente (pas de diagnostic individuel définitif, "
    "aucune donnée médicale). N'invente aucun chiffre absent du contexte."
)


def select(type_rh: str | None) -> str | None:
    """Identifiant du moteur spécialisé pour ce type RH, ou None (→ RAG E1)."""
    return _ENGINE_BY_TYPE.get(type_rh or "")


def build(db, user, message: str, type_rh: str) -> dict:
    """Construit le contexte du moteur spécialisé : {engine, system, context, sources}."""
    engine = select(type_rh)
    if engine == "E2":
        return _generation(db, user)
    if engine == "E3":
        return _parcours(db, user)
    if engine == "E4":
        return _analytics(db)
    return {}  # garde : le pipeline n'appelle build() que si select() != None


def _employe(db, user):
    try:
        return repo.find_employee_by_email(db, user.email)
    except Exception:
        return None


# ── E2 · Agent génération documentaire ──
def _generation(db, user) -> dict:
    modeles = repo.list_modele_document(db)
    emp = _employe(db, user)
    lines = [f"- {m.code_modele} : {m.libelle}" for m in modeles] or ["(aucun modèle disponible)"]
    profil = "(profil employé introuvable)"
    if emp:
        profil = (f"matricule={emp.matricule}, nom={emp.prenom} {emp.nom}, "
                  f"poste={emp.poste or '—'}, statut={emp.statut}")
    context = ("Modèles de documents disponibles :\n" + "\n".join(lines) +
               f"\n\nProfil de l'employé : {profil}")
    sources = [{"id": m.code_modele, "title": m.libelle, "score": 1.0} for m in modeles]
    return {"engine": "E2", "system": SYSTEM_PROMPT_GENERATION, "context": context, "sources": sources}


# ── E3 · Agent onboarding / offboarding ──
def _parcours(db, user) -> dict:
    emp = _employe(db, user)
    taches = []
    if emp:
        type_parcours = "OFFBOARDING" if emp.statut == "LEAVING" else "ONBOARDING"
        taches = repo.list_taches(db, emp.matricule, type_parcours)
    if taches:
        lines = [
            f"- [{t.statut}] {(t.modele.libelle if t.modele else t.code_tache)}"
            f" (échéance: {t.date_echeance.isoformat() if t.date_echeance else '—'})"
            for t in taches
        ]
        context = "Tâches du parcours :\n" + "\n".join(lines)
    else:
        context = "Aucune tâche de parcours définie pour cet employé."
    sources = [
        {"id": t.id_tache, "title": (t.modele.libelle if t.modele else t.code_tache), "score": 1.0}
        for t in taches
    ]
    return {"engine": "E3", "system": SYSTEM_PROMPT_PARCOURS, "context": context, "sources": sources}


# ── E4 · Module prédictif analytics ──
def _analytics(db) -> dict:
    indic = repo.latest_indicateurs(db)
    risk = repo.risk_summary(db)
    ind_lines = [f"- {k} : {v.get('valeur')} (période {v.get('periode')})"
                 for k, v in indic.items()] or ["(aucun indicateur)"]
    risk_line = (f"Scores de risque : {risk.get('total', 0)} au total, "
                 f"répartition par niveau {risk.get('by_niveau', {})}")
    context = "Indicateurs RH :\n" + "\n".join(ind_lines) + "\n\n" + risk_line
    sources = [{"id": k, "title": f"indicateur {k}", "score": 1.0} for k in indic]
    return {"engine": "E4", "system": SYSTEM_PROMPT_ANALYTICS, "context": context, "sources": sources}
