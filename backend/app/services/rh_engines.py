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
    "sensible": "E5",
    "supervision": "E6",
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
    "à partir des indicateurs et scores de risque réels fournis ci-dessous. "
    "Donne une lecture factuelle et prudente (pas de diagnostic individuel définitif, "
    "aucune donnée médicale). N'invente aucun chiffre absent du contexte. "
    "IMPORTANT : si la ventilation EXACTE demandée n'est pas disponible mais qu'une "
    "donnée connexe l'est (valeur globale, ou ventilation par département des scores de "
    "risque), présente-la comme l'information disponible la plus proche — NE REFUSE PAS "
    "tant qu'une donnée pertinente est présente. Précise simplement le périmètre réel "
    "de la donnée (ex. « turnover global » + « risque par département »)."
)
SYSTEM_PROMPT_SENSIBLE = (
    "Tu es l'assistant RH de « Synapse Digital » habilité à consulter les données "
    "sensibles (rémunérations, paie). Réponds à la question de l'utilisateur "
    "UNIQUEMENT à partir des informations fournies ci-dessous. Si l'utilisateur demande "
    "les salaires globaux, donne-lui le résumé de la masse salariale. "
    "N'invente aucun chiffre."
)


SYSTEM_PROMPT_SUPERVISION = (
    "Tu es l'assistant de supervision RH de « Synapse Digital ». Réponds à partir des "
    "compteurs opérationnels réels fournis ci-dessous (files d'attente, indicateurs de "
    "sécurité IA). Donne des chiffres AGRÉGÉS uniquement — ne nomme JAMAIS d'employé. "
    "Sois concis et factuel. N'invente aucun chiffre absent du contexte."
)


def _has(t: str, words) -> bool:
    return any(w in t for w in words)


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
        return _analytics(db, user)
    if engine == "E5":
        return _sensible(db, user, message)
    if engine == "E6":
        return _supervision(db, user, message)
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
def _analytics(db, user=None) -> dict:
    role = (getattr(user, "role", "") or "").upper()
    is_exec = role in ("RH", "DIRECTION", "ADMIN")

    # Périmètre MANAGER : restreint à SON département (jamais les indicateurs entreprise
    # ni les autres départements). RH/Direction/Admin : vue entreprise complète.
    if not is_exec and role == "MANAGER":
        actor = _employe(db, user)
        dept = getattr(actor, "id_departement", None)
        rs = repo.risk_summary(db, dept=dept) if dept is not None else {"total": 0, "by_niveau": {}}
        context = ("Périmètre : VOTRE ÉQUIPE (département) uniquement.\n"
                   f"Scores de risque de l'équipe : {rs.get('total', 0)} collaborateurs analysés, "
                   f"répartition par niveau {rs.get('by_niveau', {})}.\n"
                   "Les indicateurs globaux de l'entreprise (turnover, masse salariale…) ne sont "
                   "pas accessibles à ce niveau.")
        sources = [{"id": "risk_team", "title": "Risque (équipe)", "score": 1.0}]
        return {"engine": "E4", "system": SYSTEM_PROMPT_ANALYTICS, "context": context, "sources": sources}

    indic = repo.latest_indicateurs(db)
    risk = repo.risk_summary(db)
    ind_lines = [f"- {k} : {v.get('valeur')} (période {v.get('periode')})"
                 for k, v in indic.items()] or ["(aucun indicateur)"]
    risk_line = (f"Scores de risque : {risk.get('total', 0)} au total, "
                 f"répartition par niveau {risk.get('by_niveau', {})}")

    # Ventilation PAR DÉPARTEMENT (agrégée, sans nommer d'employé) pour répondre aux
    # questions « par département / par service » (climat, risque).
    dept_lines = []
    try:
        for d in repo.list_departements(db):
            did = getattr(d, "id_departement", None)
            nom = getattr(d, "nom", None) or f"Département {did}"
            rs = repo.risk_summary(db, dept=did)
            if rs.get("total"):
                dept_lines.append(f"- {nom} : {rs['total']} collaborateurs analysés, "
                                  f"répartition {rs.get('by_niveau', {})}")
    except Exception:
        pass
    dept_block = ("\n\nRépartition du risque par département :\n" + "\n".join(dept_lines)) if dept_lines else ""

    context = ("Indicateurs RH (valeurs GLOBALES entreprise) :\n" + "\n".join(ind_lines) +
               "\n\n" + risk_line + dept_block +
               "\n\nNote : les indicateurs turnover/absentéisme/engagement sont fournis au niveau "
               "global ; la ventilation par département disponible porte sur les scores de risque.")
    sources = [{"id": k, "title": f"indicateur {k}", "score": 1.0} for k in indic]
    return {"engine": "E4", "system": SYSTEM_PROMPT_ANALYTICS, "context": context, "sources": sources}


# ── E5 · Module données sensibles (paie, contrat, dossier) avec ABAC ──
def _direct_e5(text: str, sources: list | None = None) -> dict:
    """Réponse DÉTERMINISTE : le pipeline la renvoie telle quelle, sans appeler le LLM
    externe (la donnée personnelle ne quitte jamais le système — loi 09-08)."""
    return {"engine": "E5", "direct_answer": True, "reply": text, "sources": sources or []}


def _fmt_eur(x) -> str:
    """Formate un montant en euros avec séparateur d'espace (ex. 52 819 889 €)."""
    try:
        return f"{float(x):,.0f} €".replace(",", " ")
    except (TypeError, ValueError):
        return f"{x} €"


def _sensible_aggregate(db) -> dict:
    """Masse salariale AGRÉGÉE — réponse DÉTERMINISTE (loi 09-08 : la donnée financière ne
    transite PAS par le LLM externe, et n'est donc pas altérée par le masquage PII)."""
    ms = repo.salary_mass(db)
    total = ms.get("total", 0)
    lines = [f"- {item['site']} : {_fmt_eur(item['montant'])}" for item in ms.get("by_site", [])]
    reply = (f"**Masse salariale totale : {_fmt_eur(total)}**"
             + ("\n\nRépartition par site :\n" + "\n".join(lines) if lines else "")
             + "\n\nPour une fiche individuelle, précisez le collaborateur concerné.")
    return _direct_e5(reply, sources=[{"id": "db_salaires",
                                       "title": "Base des rémunérations", "score": 1.0}])


def _sensible(db, user, message: str) -> dict:
    """E5 — données sensibles individuelles avec contrôle d'accès attributaire (ABAC).

    Conformité loi 09-08 :
    - la donnée personnelle (salaire, CIN, adresse, documents) n'est JAMAIS envoyée au LLM
      externe : la réponse est construite de façon DÉTERMINISTE côté serveur ;
    - RH/Direction/Admin : accès à tout employé ; Manager : uniquement ses collaborateurs directs ;
    - chaque accès autorisé est journalisé (audit), chaque refus génère une alerte ;
    - sans employé nommé : repli sur la masse salariale agrégée.
    """
    role = (user.role or "").upper()
    actor = _employe(db, user)
    # L'agrégat entreprise (masse salariale globale) est réservé à RH/Direction/Admin.
    # Le manager n'accède qu'aux fiches individuelles de SON équipe (ABAC ci-dessous).
    can_aggregate = role in ("RH", "DIRECTION", "ADMIN")

    # Intention AGRÉGÉE explicite (« masse salariale », « globale », « par site »…) :
    # on répond directement par l'agrégat, sans chercher un employé nommé (sinon un mot
    # comme « masse » peut entrer en collision avec un nom de famille « Masse »).
    from app.services.text_utils import normalize
    nt = normalize(message)
    _AGG = ["masse salariale", "salariale", "globale", "global", "agrege", "agregee",
            "par site", "par departement", "par service", "total des salaires", "enveloppe"]
    if any(k in nt for k in _AGG):
        if not can_aggregate:
            return _direct_e5("La masse salariale globale est réservée aux RH et à la Direction. "
                              "En tant que manager, vous pouvez consulter la fiche d'un collaborateur "
                              "de votre équipe en le nommant.")
        return _sensible_aggregate(db)

    targets = repo.find_employees_in_text(db, message)

    if not targets:
        if not can_aggregate:
            return _direct_e5("Veuillez préciser le collaborateur de votre équipe concerné "
                              "(nom complet ou matricule).")
        return _sensible_aggregate(db)

    if len(targets) > 1:
        noms = ", ".join(f"{t.prenom} {t.nom} ({t.matricule})" for t in targets[:5])
        return _direct_e5(f"Plusieurs collaborateurs correspondent : {noms}. "
                          f"Merci de préciser le nom complet ou le matricule.")

    emp = targets[0]

    # ── ABAC : périmètre d'accès ──
    allowed = role in ("RH", "DIRECTION", "ADMIN")
    if not allowed and role == "MANAGER":
        allowed = bool(actor and emp.matricule_manager == actor.matricule)

    if not allowed:
        try:
            repo.create_alerte(
                db, message=(f"Accès refusé (ABAC) aux données de {emp.matricule} par "
                             f"{user.email} — hors périmètre."),
                categorie="acces_refuse", gravite="mid",
                id_destinataire=None, matricule=(actor.matricule if actor else None))
        except Exception:
            db.rollback()
        return _direct_e5(
            f"Accès refusé : {emp.prenom} {emp.nom} ne fait pas partie de votre périmètre. "
            f"Seules les données de vos collaborateurs directs sont accessibles (ou via un compte RH).")

    # ── Accès autorisé : réponse déterministe (aucune PII vers le LLM) ──
    sal = repo.get_latest_salary(db, emp.matricule)
    docs = repo.get_employee_documents(db, emp.matricule)
    # Le dossier (CIN/adresse) reste réservé RH/Direction/Admin, pas aux managers.
    dossier = repo.get_dossier_confidentiel(db, emp.matricule) if role in ("RH", "DIRECTION", "ADMIN") else None

    parts = [f"Données de {emp.prenom} {emp.nom} ({emp.matricule}) — poste : {emp.poste or '—'}, "
             f"statut : {emp.statut}."]
    if sal:
        parts.append(f"Dernier salaire connu : {float(sal.montant):,.0f} MAD (effet "
                     f"{sal.date_effet.isoformat() if sal.date_effet else '—'}, motif {sal.motif or '—'}).")
    else:
        parts.append("Aucun historique de salaire enregistré.")

    if docs:
        dl = []
        for d in docs:
            datec = d.date_creation.strftime("%d/%m/%Y") if d.date_creation else "—"
            if d.contenu:  # document texte -> on restitue le contenu (clauses, détail)
                dl.append(f"  • [{d.type_doc}] {d.nom_fichier} ({datec}) :\n{d.contenu}")
            elif d.cle_minio:  # PDF binaire -> non restitué dans le chat
                dl.append(f"  • [{d.type_doc}] {d.nom_fichier} ({datec}) — PDF à télécharger via le module Documents")
            else:
                dl.append(f"  • [{d.type_doc}] {d.nom_fichier} ({datec})")
        parts.append("Documents :\n" + "\n".join(dl))
    else:
        parts.append("Aucun contrat ni fiche de paie enregistré.")

    if dossier and (dossier.get("cin") or dossier.get("adresse")):
        parts.append(f"Dossier confidentiel — CIN : {dossier.get('cin') or '—'}, "
                     f"adresse : {dossier.get('adresse') or '—'}.")

    # Journalisation de l'accès (traçabilité loi 09-08).
    try:
        repo.log_audit(db, action="SENSITIVE_DATA_VIEW", type_entite="employe",
                       id_entite=emp.matricule, user_email=user.email)
    except Exception:
        db.rollback()

    return _direct_e5("\n".join(parts),
                      sources=[{"id": emp.matricule, "title": f"Dossier {emp.matricule}", "score": 1.0}])


# ── E6 · Supervision opérationnelle (files d'attente RH + sécurité IA) ──
def _supervision(db, user, message: str) -> dict:
    """Compteurs agrégés pour encadrants : demandes en attente (périmètre équipe pour un
    manager) et indicateurs de sécurité IA (interactions, refus d'accès). Aucun nom d'employé."""
    from app.services.text_utils import normalize
    nt = normalize(message)
    role = (user.role or "").upper()
    parts, sources = [], []

    _SEC = ["interaction ia", "interactions ia", "tentative", "acces refuse", "acces refuses",
            "securite", "alerte", "injection", "refus d'acces", "refus dacces", "fuite"]
    _ABS = ["absence", "conge", "demande", "en attente", "a valider", "a approuver", "a traiter"]

    sec_q = _has(nt, _SEC)
    if sec_q:
        # Supervision de la sécurité IA : réservée à RH/Direction/Admin (pas le manager).
        if role not in ("RH", "DIRECTION", "ADMIN"):
            return _direct_e5("La supervision de la sécurité de l'IA (interactions, tentatives "
                              "d'accès) est réservée aux RH et à la Direction.")
        sec = repo.security_stats(db)
        parts.append(
            f"Indicateurs de sécurité IA :\n"
            f"- Interactions IA totales : {sec.get('interactions', 0)} "
            f"(dont sensibles : {sec.get('sensibles', 0)}, soit {sec.get('taux_sensibles', 0)} %)\n"
            f"- Tentatives d'accès refusées : {sec.get('refus_24h', 0)} sur 24 h, "
            f"{sec.get('refus_7j', 0)} sur 7 jours\n"
            f"- Alertes : {sec.get('alertes_total', 0)} au total "
            f"({sec.get('alertes_non_resolues', 0)} non résolues), par gravité "
            f"{sec.get('par_gravite', {})}\n"
            f"- Injections bloquées : {sec.get('injections', 0)} | Escalades : {sec.get('escalades', 0)}")
        sources.append({"id": "ia_security_stats", "title": "Supervision sécurité IA", "score": 1.0})

    # Files d'attente RH (demandes/absences) — par défaut, ou si la question le demande.
    if _has(nt, _ABS) or not parts:
        actor = _employe(db, user)
        pending = repo.list_absences(db, status="pending")
        scope = "entreprise"
        if role == "MANAGER" and actor and getattr(actor, "id_departement", None):
            team = set(repo.dept_matricules(db, actor.id_departement))
            pending = [d for d in pending if d.matricule in team]
            scope = "votre équipe"
        by_type: dict[str, int] = {}
        for d in pending:
            by_type[d.code_type] = by_type.get(d.code_type, 0) + 1
        detail = ", ".join(f"{k}: {v}" for k, v in by_type.items()) or "—"
        parts.append(f"Demandes d'absence/congé EN ATTENTE de validation ({scope}) : "
                     f"{len(pending)} au total (répartition par type — {detail}).")
        sources.append({"id": "absences_pending", "title": "File de validation des absences", "score": 1.0})

    context = "\n\n".join(parts)
    return {"engine": "E6", "system": SYSTEM_PROMPT_SUPERVISION, "context": context, "sources": sources}
