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
    "de la donnée (ex. « turnover global » + « risque par département »). "
    "Lorsqu'une LISTE NOMINATIVE des collaborateurs les plus à risque est fournie ci-dessous "
    "(réservée RH/Direction/manager pour le suivi), tu PEUX la communiquer : nomme les personnes "
    "concernées avec leur niveau de risque, pour orienter les actions de rétention. Présente-la "
    "comme une AIDE À LA DÉCISION (pas un verdict définitif), sous responsabilité humaine."
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
        return _generation(db, user, message)
    if engine == "E3":
        return _parcours(db, user)
    if engine == "E4":
        return _analytics(db, user, message)
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


def _top_risque_block(rs: dict) -> str:
    """Bloc NOMINATIF des collaborateurs les plus à risque (RH/Direction/manager — pour suivi).
    Vide si la synthèse est anonymisée (médecine) ou sans données."""
    top = rs.get("top") or []
    if not top:
        return ""
    lines = []
    for t in top:
        nom = t.get("employee_name") or t.get("matricule") or "—"
        lines.append(f"- {nom} ({t.get('matricule', '—')}) : risque {t.get('type', '—')} — "
                     f"score {t.get('valeur', '—')}, niveau {t.get('niveau', '—')}")
    return ("\n\nCollaborateurs les plus à risque (à traiter en priorité pour la rétention — "
            "aide à la décision, pas un verdict) :\n" + "\n".join(lines))


def _who_at_risk_answer(db, dept, is_exec) -> dict:
    """Réponse DÉTERMINISTE à « qui risque de partir ? » : liste NOMINATIVE des collaborateurs en
    risque élevé (dédupliquée par personne, score max), bornée au périmètre. La donnée personnelle
    n'est JAMAIS envoyée au LLM externe (loi 09-08) ; l'accès est journalisé par le pipeline."""
    from app.db.models import Employe
    rows = repo.list_scores(db, niveau="high", department_id=dept)  # triés par score décroissant
    seen = {}
    for r in rows:
        seen.setdefault(r.matricule, r)  # conserve le score le plus élevé par personne
    top = list(seen.values())[:15]
    lines = []
    for r in top:
        e = db.get(Employe, r.matricule)
        nm = f"{e.prenom} {e.nom}" if e else r.matricule
        lines.append(f"- {nm} ({r.matricule}) : risque {r.type}, niveau {r.niveau} "
                     f"(score {float(r.valeur):.2f})")
    perim = "votre département" if dept is not None else "l'organisation"
    if not lines:
        reply = f"Aucun collaborateur en risque élevé sur {perim} actuellement."
    else:
        reply = (f"**Collaborateurs en risque élevé sur {perim}** "
                 f"({len(seen)} personne(s) ; {len(lines)} affichée(s)) — aide à la décision, "
                 f"à traiter avec discernement et suivi humain :\n" + "\n".join(lines))
        if is_exec:
            tn = repo.latest_indicateurs(db).get("turnover", {})
            if tn:
                reply += f"\n\nTurnover global : {tn.get('valeur')} % (période {tn.get('periode')})."
        reply += ("\n\nCes scores sont prédictifs (pas un verdict) : prévoir un entretien de suivi "
                  "ou un plan d'action. Détail par personne via « plan d'action pour [nom] ».")
    return {"engine": "E4", "direct_answer": True, "reply": reply,
            "sources": [{"id": "scores_risque", "title": "Scores de risque", "score": 1.0}]}


# ── E2 · Agent génération documentaire ──
def _generation(db, user, message: str = "") -> dict:
    """Prépare un document. Le profil utilisé pour le PRÉREMPLISSAGE est celui de l'employé
    NOMMÉ dans la demande s'il est dans le périmètre du demandeur (RH/Direction/Admin : tous ;
    manager : son département) ; sinon le profil du demandeur (self-service collaborateur)."""
    from app.core import scope
    modeles = repo.list_modele_document(db)
    role = (user.role or "").upper()
    emp = None
    # Cible nommée (« attestation pour X ») : autorisée si dans le périmètre du demandeur.
    if message and role in ("RH", "DIRECTION", "ADMIN", "MANAGER"):
        try:
            named = repo.find_employees_in_text(db, message)
            if named and scope.is_in_scope(db, user, named[0].matricule):
                emp = named[0]
        except Exception:
            emp = None
    if emp is None:  # repli : le demandeur lui-même (collaborateur -> ses propres documents)
        emp = _employe(db, user)

    lines = [f"- {m.code_modele} : {m.libelle}" for m in modeles] or ["(aucun modèle disponible)"]
    profil = "(profil employé introuvable)"
    if emp:
        profil = (f"matricule={emp.matricule}, nom={emp.prenom} {emp.nom}, "
                  f"poste={emp.poste or '—'}, statut={emp.statut}, "
                  f"date_embauche={emp.date_embauche.isoformat() if emp.date_embauche else '—'}, "
                  f"type_contrat={emp.type_contrat or '—'}, site={emp.site or '—'}")
    context = ("Modèles de documents disponibles :\n" + "\n".join(lines) +
               f"\n\nProfil de l'employé concerné (pour préremplissage) : {profil}")
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
def _analytics(db, user=None, message: str = "") -> dict:
    role = (getattr(user, "role", "") or "").upper()
    is_exec = role in ("RH", "DIRECTION", "ADMIN")

    # Intention « QUI est à risque ? » -> réponse DÉTERMINISTE nominative (fiable, sans LLM ni PII
    # externe). Réservée RH/Direction (organisation) et manager (son département). La liste
    # nominative reste interne (jamais transmise au LLM), conformément à la loi 09-08.
    from app.services.text_utils import normalize
    nt = normalize(message or "")
    _who = ("qui ", "liste", "nominati", "noms", "lesquels", "quels collaborateurs", "quels employes")
    _risk = ("risque", "partir", "depart", "desengag", "burnout", "turnover", "quitter")
    if (is_exec or role == "MANAGER") and any(k in nt for k in _who) and any(k in nt for k in _risk):
        dept = None if is_exec else getattr(_employe(db, user), "id_departement", None)
        return _who_at_risk_answer(db, dept, is_exec)

    # Périmètre MANAGER : restreint à SON département (jamais les indicateurs entreprise
    # ni les autres départements). RH/Direction/Admin : vue entreprise complète.
    if not is_exec and role == "MANAGER":
        actor = _employe(db, user)
        dept = getattr(actor, "id_departement", None)
        rs = repo.risk_summary(db, top=10, dept=dept) if dept is not None else {"total": 0, "by_niveau": {}}
        context = ("Périmètre : VOTRE ÉQUIPE (département) uniquement.\n"
                   f"Scores de risque de l'équipe : {rs.get('total', 0)} collaborateurs analysés, "
                   f"répartition par niveau {rs.get('by_niveau', {})}." + _top_risque_block(rs) +
                   "\nLes indicateurs globaux de l'entreprise (turnover, masse salariale…) ne sont "
                   "pas accessibles à ce niveau.")
        sources = [{"id": "risk_team", "title": "Risque (équipe)", "score": 1.0}]
        return {"engine": "E4", "system": SYSTEM_PROMPT_ANALYTICS, "context": context, "sources": sources}

    indic = repo.latest_indicateurs(db)
    risk = repo.risk_summary(db, top=12)
    ind_lines = [f"- {k} : {v.get('valeur')} (période {v.get('periode')})"
                 for k, v in indic.items()] or ["(aucun indicateur)"]
    risk_line = (f"Scores de risque : {risk.get('total', 0)} au total, "
                 f"répartition par niveau {risk.get('by_niveau', {})}" + _top_risque_block(risk))

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


def _mask_cin(c) -> str:
    """Masque partiellement un CIN (ex. BK123456 -> BK••••56) — minimisation des données (loi 09-08).
    Le détail complet reste accessible via le module Dossier (accès explicite et tracé)."""
    c = (c or "").strip()
    if not c:
        return "—"
    if len(c) <= 4:
        return "•" * len(c)
    return c[:2] + "•" * (len(c) - 4) + c[-2:]


def _fmt_eur(x) -> str:
    """Formate un montant en dirhams avec séparateur d'espace (ex. 52 819 889 MAD)."""
    try:
        return f"{float(x):,.0f} MAD".replace(",", " ")
    except (TypeError, ValueError):
        return f"{x} MAD"


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


def _sensible_self(db, user, message: str) -> dict:
    """E5 self-service : un COLLABORATEUR consulte SES PROPRES données sensibles (sa paie,
    son contrat). Réponse DÉTERMINISTE — la donnée personnelle ne quitte jamais le serveur
    (loi 09-08) — et STRICTEMENT limitée au matricule du demandeur : aucun accès à autrui.
    C'est ce moteur qui répond aux questions « ma fiche de paie », « les clauses de mon contrat ».
    """
    emp = _employe(db, user)
    if not emp:
        return _direct_e5("Je ne retrouve pas votre fiche employé dans la plateforme. "
                          "Contactez votre référent RH pour mettre à jour votre profil.")

    from app.services.text_utils import normalize
    nt = normalize(message)
    want_paie = _has(nt, ["paie", "salaire", "bulletin", "remuneration", "net", "brut",
                          "prime", "fiche de paie"])
    want_contrat = _has(nt, ["contrat", "clause", "cdi", "cdd", "avenant", "preavis",
                             "periode d'essai", "engagement"])
    if not (want_paie or want_contrat):  # intention non explicite -> résumé personnel complet
        want_paie = want_contrat = True

    docs = repo.get_employee_documents(db, emp.matricule)
    parts = [f"Voici vos informations personnelles, {emp.prenom} {emp.nom} "
             f"({emp.matricule}) — poste : {emp.poste or '—'}."]

    if want_paie:
        sal = repo.get_latest_salary(db, emp.matricule)
        if sal:
            parts.append("**Rémunération** — dernier salaire annuel brut enregistré : "
                         f"{_fmt_eur(sal.montant)} (effet "
                         f"{sal.date_effet.isoformat() if sal.date_effet else '—'}, "
                         f"motif {sal.motif or '—'}).")
        bulletins = [d for d in docs if (d.type_doc or "").upper() == "FICHE_PAIE"]
        if bulletins:
            latest = bulletins[0]
            block = "**Votre dernière fiche de paie**"
            if latest.contenu:
                block += " :\n" + latest.contenu
            if len(bulletins) > 1:
                autres = ", ".join(d.nom_fichier for d in bulletins[1:6])
                block += f"\n\nAutres bulletins disponibles : {autres}."
            block += "\n(Tous vos bulletins sont téléchargeables dans le module « Ma paie ».)"
            parts.append(block)
        elif not sal:
            parts.append("Aucune information de paie n'est encore enregistrée à votre nom. "
                         "Pour toute question, contactez le service RH.")

    if want_contrat:
        contrats = [d for d in docs if (d.type_doc or "").upper() == "CONTRAT"]
        if contrats:
            cl = []
            for d in contrats:
                datec = d.date_creation.strftime("%d/%m/%Y") if d.date_creation else "—"
                if d.contenu:
                    cl.append(f"• {d.nom_fichier} ({datec}) :\n{d.contenu}")
                else:
                    cl.append(f"• {d.nom_fichier} ({datec}) — à télécharger via le module Documents")
            parts.append("**Votre contrat** :\n" + "\n".join(cl))
        else:
            parts.append("Aucun contrat n'est enregistré sous votre profil. Votre exemplaire "
                         "signé fait foi ; contactez le service RH pour en obtenir une copie.")

    # Journalisation de l'accès à ses propres données (traçabilité loi 09-08).
    try:
        repo.log_audit(db, action="SELF_DATA_VIEW", type_entite="employe",
                       id_entite=emp.matricule, user_email=user.email)
    except Exception:
        db.rollback()

    return _direct_e5("\n\n".join(parts),
                      sources=[{"id": emp.matricule, "title": "Mes informations", "score": 1.0}])


def _sensible(db, user, message: str) -> dict:
    """E5 — données sensibles individuelles avec contrôle d'accès attributaire (ABAC).

    Conformité loi 09-08 :
    - la donnée personnelle (salaire, CIN, adresse, documents) n'est JAMAIS envoyée au LLM
      externe : la réponse est construite de façon DÉTERMINISTE côté serveur ;
    - le COLLABORATEUR n'accède QU'À ses propres données (self-service, ci-dessous) ;
    - RH/Direction/Admin : accès à tout employé ; Manager : les employés de SON département ;
    - chaque accès autorisé est journalisé (audit), chaque refus génère une alerte ;
    - sans employé nommé : repli sur la masse salariale agrégée.
    """
    role = (user.role or "").upper()
    # Self-service : un collaborateur ne peut consulter QUE sa propre situation (jamais autrui).
    # S'il NOMME un autre employé (« salaire de mon collègue X »), on refuse et on trace —
    # on ne sert pas non plus ses propres données (la demande visait quelqu'un d'autre).
    if role == "COLLABORATEUR":
        actor = _employe(db, user)
        actor_mat = actor.matricule if actor else None
        if any(t.matricule != actor_mat for t in repo.find_employees_in_text(db, message)):
            try:
                repo.create_alerte(
                    db, message=(f"Accès refusé (IA) : {user.email} (collaborateur) a tenté de "
                                 f"consulter les données sensibles d'un autre employé."),
                    categorie="acces_refuse", gravite="mid", id_destinataire=None, matricule=actor_mat)
            except Exception:
                db.rollback()
            return _direct_e5("Accès refusé : vous ne pouvez consulter que VOS propres informations "
                              "(paie, contrat). Pour les données d'un collègue, adressez-vous au "
                              "service RH.")
        return _sensible_self(db, user, message)
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

    # ── ABAC : périmètre d'accès (source unique = scope.is_in_scope, cohérent avec /employees,
    # demandes, absences…). RH/Direction/Admin : organisation ; Manager : SON DÉPARTEMENT. ──
    from app.core import scope
    allowed = scope.is_in_scope(db, user, emp.matricule)

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
            f"Seules les données des collaborateurs de votre département sont accessibles "
            f"(ou via un compte RH).")

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
        # Minimisation : on ne restitue JAMAIS le CIN/l'adresse en clair dans le chat ; le détail
        # complet passe par le module Dossier (accès explicite et tracé). loi 09-08 / §4.4.
        cin_m = _mask_cin(dossier.get("cin"))
        addr = "enregistrée — consultable via le module Dossier (accès tracé)" if dossier.get("adresse") else "—"
        parts.append(f"Dossier confidentiel — CIN : {cin_m} (partiellement masqué), adresse : {addr}.")

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
