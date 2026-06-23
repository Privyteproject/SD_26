"""Dépôt : accès aux données via l'ORM (MLD v1.0).

Fait le pont entre le contrat plat du front et le modèle Merise :
- « employees » -> employe (+ utilisateur pour email/rôle)
- « absences »  -> demande filtrée sur les types d'absence
Renvoie des objets ORM ; la sérialisation passe par leur .to_dict().
"""

from datetime import date, datetime

from sqlalchemy import delete as sa_delete, func, or_, select, update as sa_update
from sqlalchemy.orm import Session

from app.db.models import (
    Alerte,
    Demande,
    Departement,
    Document,
    DossierConfidentiel,
    Employe,
    HistoriqueSalaire,
    InteractionIA,
    JournalAudit,
    ScoreRisque,
    SourceIA,
    TacheParcours,
    Utilisateur,
)
from app.db.seed import ABSENCE_TYPE_CODES


# ───────────── Helpers ─────────────
def _next_matricule(db: Session) -> str:
    n = db.scalar(select(Employe.matricule).order_by(Employe.matricule.desc()).limit(1))
    num = (int(n[3:]) + 1) if (n and n[3:].isdigit()) else (db.query(Employe).count() + 1)
    return f"EMP{num:03d}"


def resolve_departement_id(db: Session, value) -> int | None:
    """Accepte un id_departement (int/str numérique) OU un nom de département."""
    if value in (None, ""):
        return None
    if isinstance(value, int) or str(value).isdigit():
        return int(value)
    dep = db.scalar(select(Departement).where(Departement.nom == str(value)))
    return dep.id_departement if dep else None


# ───────────── Employés ─────────────
def list_employees(db, *, search=None, role=None, status=None, department_id=None) -> list[Employe]:
    stmt = select(Employe)
    if status:
        stmt = stmt.where(Employe.statut == status)
    dep_id = resolve_departement_id(db, department_id) if department_id else None
    if dep_id is not None:
        stmt = stmt.where(Employe.id_departement == dep_id)
    rows = list(db.scalars(stmt))
    if role:
        rows = [e for e in rows if e.utilisateur and e.utilisateur.code_role == role]
    if search:
        s = search.lower()
        rows = [e for e in rows
                if s in f"{e.prenom} {e.nom} {e.utilisateur.email if e.utilisateur else ''}".lower()]
    return rows


def get_employee(db, matricule: str) -> Employe | None:
    return db.get(Employe, matricule)


def find_employee_by_email(db, email: str) -> Employe | None:
    if not email:
        return None
    return db.scalar(
        select(Employe).join(Utilisateur, Employe.id_utilisateur == Utilisateur.id_utilisateur)
        .where(Utilisateur.email == email)
    )


def create_employee(db, data: dict) -> Employe:
    """Crée le compte (utilisateur) + la personne (employe) en cohérence avec le MLD."""
    u = Utilisateur(email=data["email"], actif=True, code_role=data.get("role") or "COLLABORATEUR")
    db.add(u)
    db.flush()
    emp = Employe(
        matricule=_next_matricule(db),
        prenom=data["prenom"], nom=data["nom"], poste=data.get("poste"),
        statut=data.get("status") or "ACTIVE",
        id_departement=resolve_departement_id(db, data.get("department_id")),
        id_utilisateur=u.id_utilisateur,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


def update_employee(db, matricule: str, patch: dict) -> Employe | None:
    emp = db.get(Employe, matricule)
    if emp is None:
        return None
    if "prenom" in patch: emp.prenom = patch["prenom"]
    if "nom" in patch: emp.nom = patch["nom"]
    if "poste" in patch: emp.poste = patch["poste"]
    if "status" in patch: emp.statut = patch["status"]
    if "department_id" in patch:
        emp.id_departement = resolve_departement_id(db, patch["department_id"])
    # Champs portés par le compte
    if emp.utilisateur is not None:
        if patch.get("email"): emp.utilisateur.email = patch["email"]
        if patch.get("role"): emp.utilisateur.code_role = patch["role"]
    db.commit()
    db.refresh(emp)
    return emp


def delete_employee(db, matricule: str) -> bool:
    """Supprime définitivement un employé ET son compte utilisateur.

    Nettoie toutes les références (FK) pour éviter les violations d'intégrité :
    - enregistrements *possédés* par l'employé (matricule NOT NULL) -> supprimés ;
    - références *tierces* (FK nullable : chef de département, manager d'autres
      employés, décideur/valideur/destinataire, auteur d'audit) -> mises à NULL.
    Renvoie False si l'employé est introuvable.
    """
    emp = db.get(Employe, matricule)
    if emp is None:
        return False
    uid = emp.id_utilisateur
    db.expunge(emp)  # on pilote la suppression en SQL bulk pour contrôler l'ordre

    def run(stmt):
        db.execute(stmt.execution_options(synchronize_session=False))

    # 1) Associations N:M (source_ia) dépendant des documents / interactions visés
    doc_ids = list(db.scalars(select(Document.id_document).where(Document.matricule == matricule)))
    inter_ids = (
        list(db.scalars(select(InteractionIA.id_interaction).where(InteractionIA.id_utilisateur == uid)))
        if uid is not None else []
    )
    if doc_ids:
        run(sa_delete(SourceIA).where(SourceIA.id_document.in_(doc_ids)))
    if inter_ids:
        run(sa_delete(SourceIA).where(SourceIA.id_interaction.in_(inter_ids)))

    # 2) Enregistrements possédés par l'employé -> suppression
    run(sa_delete(Document).where(Document.matricule == matricule))
    run(sa_delete(Demande).where(Demande.matricule == matricule))
    run(sa_delete(TacheParcours).where(TacheParcours.matricule == matricule))
    run(sa_delete(ScoreRisque).where(ScoreRisque.matricule == matricule))
    run(sa_delete(HistoriqueSalaire).where(HistoriqueSalaire.matricule == matricule))
    run(sa_delete(DossierConfidentiel).where(DossierConfidentiel.matricule == matricule))

    # 3) Références tierces -> on annule le lien (sans détruire les données d'autrui)
    run(sa_update(Departement).where(Departement.matricule_chef == matricule).values(matricule_chef=None))
    run(sa_update(Employe).where(Employe.matricule_manager == matricule).values(matricule_manager=None))
    run(sa_update(Alerte).where(Alerte.matricule == matricule).values(matricule=None))
    if uid is not None:
        run(sa_update(Demande).where(Demande.id_decideur == uid).values(id_decideur=None))
        run(sa_update(Document).where(Document.id_valideur == uid).values(id_valideur=None))
        run(sa_update(Alerte).where(Alerte.id_destinataire == uid).values(id_destinataire=None))
        run(sa_update(Alerte).where(Alerte.id_resolveur == uid).values(id_resolveur=None))
        run(sa_update(JournalAudit).where(JournalAudit.id_utilisateur == uid).values(id_utilisateur=None))
        run(sa_delete(InteractionIA).where(InteractionIA.id_utilisateur == uid))

    # 4) L'employé puis son compte
    run(sa_delete(Employe).where(Employe.matricule == matricule))
    if uid is not None:
        run(sa_delete(Utilisateur).where(Utilisateur.id_utilisateur == uid))

    db.commit()
    return True


# ───────────── Absences (= demande filtrée) ─────────────
def list_absences(db, *, employee_id=None, status=None, date_from=None, date_to=None) -> list[Demande]:
    stmt = select(Demande).where(Demande.code_type.in_(ABSENCE_TYPE_CODES))
    if employee_id:
        stmt = stmt.where(Demande.matricule == employee_id)
    if status:
        stmt = stmt.where(Demande.statut == status)
    if date_from:
        stmt = stmt.where(Demande.date_fin >= date_from)
    if date_to:
        stmt = stmt.where(Demande.date_debut <= date_to)
    return list(db.scalars(stmt))


def get_absence(db, id_demande: int) -> Demande | None:
    d = db.get(Demande, id_demande)
    return d if (d and d.code_type in ABSENCE_TYPE_CODES) else None


def _resolve_type_code(db, type_value: str) -> str:
    """Mappe le libellé/code envoyé par le front vers un code_type d'absence."""
    from app.db.models import TypeDemande
    v = (type_value or "").strip()
    t = db.get(TypeDemande, v.upper())
    if t and t.code_type in ABSENCE_TYPE_CODES:
        return t.code_type
    t = db.scalar(select(TypeDemande).where(TypeDemande.libelle == v))
    if t and t.code_type in ABSENCE_TYPE_CODES:
        return t.code_type
    return "CONGE"  # défaut raisonnable


def create_absence(db, *, matricule: str, type_value: str, start_date, end_date, reason=None) -> Demande:
    d = Demande(
        matricule=matricule, code_type=_resolve_type_code(db, type_value),
        date_debut=start_date, date_fin=end_date, statut="pending", detail=reason,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


def set_absence_status(db, id_demande: int, new_status: str, decideur_id: int | None = None) -> Demande | None:
    d = get_absence(db, id_demande)
    if d is None:
        return None
    d.statut = new_status
    d.date_decision = date.today()
    if decideur_id:
        d.id_decideur = decideur_id
    db.commit()
    db.refresh(d)
    return d


def absence_stats(db) -> dict:
    rows = list_absences(db)
    by_status, by_type = {}, {}
    for d in rows:
        by_status[d.statut] = by_status.get(d.statut, 0) + 1
        by_type[d.code_type] = by_type.get(d.code_type, 0) + 1
    return {"total": len(rows), "by_status": by_status, "by_type": by_type,
            "pending": by_status.get("pending", 0)}


# ───────────── Tableau de bord ─────────────
def dashboard_counts(db) -> dict:
    emps = list(db.scalars(select(Employe)))
    pending = sum(1 for d in list_absences(db) if d.statut == "pending")
    return {
        "headcount": len(emps),
        "new_hires": sum(1 for e in emps if e.statut == "NEW"),
        "leaving": sum(1 for e in emps if e.statut == "LEAVING"),
        "pending_absences": pending,
    }


# ───────────── Journalisation IA (table interaction_ia) ─────────────
def log_ia_interaction(db, *, user_email, prompt, reponse, tokens, model, sensible=False, conversation_id=None):
    from app.db.models import InteractionIA
    u = db.scalar(select(Utilisateur).where(Utilisateur.email == user_email))
    if u is None:
        return None  # pas de compte rattaché -> pas de log (FK obligatoire)
    it = InteractionIA(
        prompt=prompt, reponse=reponse, tokens_used=tokens, model_name=model,
        statut="ok", sensible=sensible, id_utilisateur=u.id_utilisateur,
        id_conversation=conversation_id,
    )
    db.add(it)
    if conversation_id is not None:
        touch_conversation(db, conversation_id)  # met à jour date_maj
    db.commit()
    db.refresh(it)
    return it


# ───────────── Conversations IA (historique des chats) ─────────────
def _conversation_owned(db, id_conversation, user_email):
    """Renvoie la conversation si elle appartient à l'utilisateur, sinon None."""
    from app.db.models import ConversationIA
    c = db.get(ConversationIA, id_conversation)
    if c is None:
        return None
    u = db.scalar(select(Utilisateur).where(Utilisateur.email == user_email))
    if u is None or c.id_utilisateur != u.id_utilisateur:
        return None
    return c


def create_conversation(db, *, user_email, titre):
    from app.db.models import ConversationIA
    u = db.scalar(select(Utilisateur).where(Utilisateur.email == user_email))
    if u is None:
        return None
    titre = (titre or "Nouvelle conversation").strip()[:160] or "Nouvelle conversation"
    c = ConversationIA(titre=titre, id_utilisateur=u.id_utilisateur)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def touch_conversation(db, id_conversation):
    from app.db.models import ConversationIA
    c = db.get(ConversationIA, id_conversation)
    if c is not None:
        c.date_maj = datetime.now()
    return c


def list_conversations(db, *, user_email) -> list[dict]:
    """Conversations non archivées de l'utilisateur (récentes d'abord) + aperçu."""
    from app.db.models import ConversationIA, InteractionIA
    u = db.scalar(select(Utilisateur).where(Utilisateur.email == user_email))
    if u is None:
        return []
    rows = list(db.scalars(
        select(ConversationIA)
        .where(ConversationIA.id_utilisateur == u.id_utilisateur, ConversationIA.archivee.is_(False))
        .order_by(ConversationIA.date_maj.desc())
    ))
    out = []
    for c in rows:
        n = db.scalar(select(func.count(InteractionIA.id_interaction))
                      .where(InteractionIA.id_conversation == c.id_conversation)) or 0
        out.append({
            "id": c.id_conversation, "titre": c.titre,
            "date_creation": c.date_creation.isoformat() if c.date_creation else None,
            "date_maj": c.date_maj.isoformat() if c.date_maj else None,
            "messages": int(n),
        })
    return out


def conversation_messages(db, *, id_conversation) -> list[dict]:
    """Échanges (question/réponse) d'une conversation, du plus ancien au plus récent."""
    from app.db.models import InteractionIA
    rows = list(db.scalars(
        select(InteractionIA)
        .where(InteractionIA.id_conversation == id_conversation)
        .order_by(InteractionIA.date_creation.asc(), InteractionIA.id_interaction.asc())
    ))
    out = []
    for it in rows:
        out.append({"role": "user", "content": it.prompt})
        if it.reponse is not None:
            out.append({"role": "assistant", "content": it.reponse})
    return out


def rename_conversation(db, *, id_conversation, user_email, titre):
    c = _conversation_owned(db, id_conversation, user_email)
    if c is None:
        return None
    c.titre = (titre or c.titre).strip()[:160] or c.titre
    db.commit()
    db.refresh(c)
    return c


def archive_conversation(db, *, id_conversation, user_email) -> bool:
    """Suppression douce : marque la conversation comme archivée (conservée pour l'audit)."""
    c = _conversation_owned(db, id_conversation, user_email)
    if c is None:
        return False
    c.archivee = True
    db.commit()
    return True


# ───────────── Chat : sessions + messages persistés (chat_sessions / chat_messages) ─────────────
def _uid(db, user_email):
    return db.scalar(select(Utilisateur.id_utilisateur).where(Utilisateur.email == user_email))


def chat_session_owned(db, session_id, user_email):
    """Renvoie la session si elle appartient à l'utilisateur et n'est pas supprimée (anti-IDOR)."""
    from app.db.models import ChatSession
    s = db.get(ChatSession, session_id)
    if s is None or s.is_deleted:
        return None
    uid = _uid(db, user_email)
    return s if (uid is not None and s.id_utilisateur == uid) else None


def chat_create_session(db, *, user_email, title=None):
    from app.db.models import ChatSession
    uid = _uid(db, user_email)
    if uid is None:
        return None
    s = ChatSession(id_utilisateur=uid, title=(title or "Nouvelle conversation")[:200] or "Nouvelle conversation")
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def chat_list_sessions(db, *, user_email):
    from app.db.models import ChatMessage, ChatSession
    uid = _uid(db, user_email)
    if uid is None:
        return []
    rows = list(db.scalars(
        select(ChatSession)
        .where(ChatSession.id_utilisateur == uid, ChatSession.is_deleted.is_(False))
        .order_by(ChatSession.updated_at.desc())
    ))
    out = []
    for s in rows:
        n = db.scalar(select(func.count(ChatMessage.id)).where(ChatMessage.session_id == s.id)) or 0
        out.append({
            "id": s.id, "title": s.title,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            "message_count": int(n),
        })
    return out


def chat_get_messages(db, *, session_id):
    from app.db.models import ChatMessage
    rows = list(db.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
    ))
    return [{"id": m.id, "role": m.role, "content": m.content, "mode": m.mode,
             "sources": m.sources, "created_at": m.created_at.isoformat() if m.created_at else None}
            for m in rows]


def chat_history_for_llm(db, session_id, limit=20):
    """Derniers échanges au format LLM [{role, content}] (source de vérité serveur)."""
    msgs = chat_get_messages(db, session_id=session_id)
    return [{"role": m["role"], "content": m["content"]} for m in msgs][-limit:]


def chat_add_message(db, *, session_id, role, content, mode=None, sources=None):
    from app.db.models import ChatMessage, ChatSession
    # Horodatage Python (microseconde) pour un ordre fiable, même sur SQLite (func.now()
    # n'a qu'une résolution à la seconde et le PK UUID n'est pas triable).
    m = ChatMessage(session_id=session_id, role=role, content=content, mode=mode,
                    sources=sources, created_at=datetime.now())
    db.add(m)
    s = db.get(ChatSession, session_id)
    if s is not None:
        s.updated_at = datetime.now()
        # Titre auto = 50 premiers caractères du 1er message utilisateur.
        if role == "user" and (not s.title or s.title == "Nouvelle conversation"):
            s.title = content[:50] or s.title
    db.commit()
    db.refresh(m)
    return m


def chat_soft_delete(db, *, session_id, user_email) -> bool:
    s = chat_session_owned(db, session_id, user_email)
    if s is None:
        return False
    s.is_deleted = True
    db.commit()
    # Audit explicite (uniquement la suppression de session, pas chaque message).
    log_audit(db, action="CHAT_SESSION_DELETED", type_entite="chat_sessions",
              id_entite=session_id, user_email=user_email)
    return True


def log_audit(db, *, action, type_entite, id_entite, user_email=None):
    """Écrit une entrée d'audit explicite (pour les actions non couvertes par les events)."""
    from app.db.models import JournalAudit
    uid = _uid(db, user_email) if user_email else None
    db.add(JournalAudit(action=action, type_entite=type_entite,
                        id_entite=str(id_entite), id_utilisateur=uid))
    db.commit()


def list_ia_interactions(db, *, limit: int = 100) -> list[dict]:
    """Journaux des échanges IA (supervision) : prompt, statut, tokens, utilisateur."""
    from app.db.models import InteractionIA
    rows = db.execute(
        select(InteractionIA, Utilisateur)
        .join(Utilisateur, InteractionIA.id_utilisateur == Utilisateur.id_utilisateur, isouter=True)
        .order_by(InteractionIA.date_creation.desc())
        .limit(limit)
    ).all()
    out = []
    for it, u in rows:
        out.append({
            "id": it.id_interaction,
            "date": it.date_creation.isoformat() if it.date_creation else None,
            "email": u.email if u else None,
            "role": u.code_role if u else None,
            "prompt": it.prompt,
            "reponse": it.reponse,
            "statut": it.statut,
            "sensible": it.sensible,
            "tokens": it.tokens_used,
            "model": it.model_name,
        })
    return out


def ia_interactions_stats(db) -> dict:
    """Agrégats pour la supervision : nombre d'échanges, total tokens, sensibles."""
    from app.db.models import InteractionIA
    total = db.scalar(select(func.count(InteractionIA.id_interaction))) or 0
    tokens = db.scalar(select(func.coalesce(func.sum(InteractionIA.tokens_used), 0))) or 0
    sensibles = db.scalar(
        select(func.count(InteractionIA.id_interaction)).where(InteractionIA.sensible.is_(True))
    ) or 0
    return {"count": int(total), "total_tokens": int(tokens), "sensibles": int(sensibles)}


# ───────────── Journal d'audit ─────────────
def list_audit(db, *, limit: int = 200, action: str | None = None, type_entite: str | None = None) -> list[dict]:
    """Journal d'audit : mutations tracées automatiquement (cf. db/audit.py)."""
    stmt = (
        select(JournalAudit, Utilisateur)
        .join(Utilisateur, JournalAudit.id_utilisateur == Utilisateur.id_utilisateur, isouter=True)
        .order_by(JournalAudit.date_creation.desc(), JournalAudit.id_log.desc())
    )
    if action:
        stmt = stmt.where(JournalAudit.action == action)
    if type_entite:
        stmt = stmt.where(JournalAudit.type_entite == type_entite)
    rows = db.execute(stmt.limit(limit)).all()
    out = []
    for a, u in rows:
        out.append({
            "id": a.id_log,
            "date": a.date_creation.isoformat() if a.date_creation else None,
            "action": a.action,
            "entite": a.type_entite,
            "id_entite": a.id_entite,
            "changements": a.changements,
            "ip": a.adresse_ip,
            "actor": u.email if u else None,
            "role": u.code_role if u else None,
        })
    return out


# ───────────── Demandes génériques (tous types) ─────────────
def list_type_demande(db):
    from app.db.models import TypeDemande
    return list(db.scalars(select(TypeDemande)))


def type_exists(db, code_type: str) -> bool:
    from app.db.models import TypeDemande
    return db.get(TypeDemande, code_type) is not None


def list_demandes(db, *, employee_id=None, code_type=None, status=None) -> list[Demande]:
    stmt = select(Demande)
    if employee_id:
        stmt = stmt.where(Demande.matricule == employee_id)
    if code_type:
        stmt = stmt.where(Demande.code_type == code_type)
    if status:
        stmt = stmt.where(Demande.statut == status)
    return list(db.scalars(stmt.order_by(Demande.date_depot.desc())))


def get_demande(db, id_demande: int) -> Demande | None:
    return db.get(Demande, id_demande)


def create_demande(db, *, matricule, code_type, date_debut=None, date_fin=None, detail=None) -> Demande:
    d = Demande(matricule=matricule, code_type=code_type, date_debut=date_debut,
                date_fin=date_fin, detail=detail, statut="pending")
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


def set_demande_status(db, id_demande, new_status, *, commentaire=None, decideur_id=None) -> Demande | None:
    d = db.get(Demande, id_demande)
    if d is None:
        return None
    d.statut = new_status
    d.date_decision = date.today()
    if commentaire is not None:
        d.commentaire = commentaire
    if decideur_id:
        d.id_decideur = decideur_id
    db.commit()
    db.refresh(d)
    return d


# ───────────── Parcours on/offboarding ─────────────
def list_modele_taches(db, type_parcours=None):
    from app.db.models import ModeleTache
    # Les tâches "CUSTOM_*" sont des tâches personnalisées par employé : on les exclut
    # des modèles par défaut (donc elles ne sont pas réappliquées à tous les arrivants).
    stmt = select(ModeleTache).where(~ModeleTache.code_tache.like("CUSTOM\\_%", escape="\\"))
    if type_parcours:
        stmt = stmt.where(ModeleTache.type_parcours == type_parcours)
    return list(db.scalars(stmt.order_by(ModeleTache.ordre)))


def create_modele_tache(db, *, libelle, type_parcours, ordre=0, delai_jours=None, code=None):
    """Crée un modèle de tâche par défaut (appliqué aux nouveaux parcours)."""
    import uuid

    from app.db.models import ModeleTache
    code = code or ("M_" + uuid.uuid4().hex[:6].upper())
    m = ModeleTache(code_tache=code, libelle=libelle, type_parcours=type_parcours,
                    ordre=ordre or 0, delai_jours=delai_jours)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def update_modele_tache(db, code, patch: dict):
    from app.db.models import ModeleTache
    m = db.get(ModeleTache, code)
    if m is None:
        return None
    if patch.get("libelle"):
        m.libelle = patch["libelle"]
    if patch.get("ordre") is not None:
        m.ordre = patch["ordre"]
    if "delai_jours" in patch:
        m.delai_jours = patch["delai_jours"]
    db.commit()
    db.refresh(m)
    return m


def delete_modele_tache(db, code) -> str:
    """Renvoie 'not_found', 'in_use' (référencé par des tâches) ou 'ok'."""
    from app.db.models import ModeleTache, TacheParcours
    m = db.get(ModeleTache, code)
    if m is None:
        return "not_found"
    used = db.scalar(select(func.count(TacheParcours.id_tache)).where(TacheParcours.code_tache == code))
    if used:
        return "in_use"
    db.delete(m)
    db.commit()
    return "ok"


def add_tache(db, *, matricule, libelle, type_parcours, date_echeance=None):
    """Ajoute une tâche PERSONNALISÉE au parcours d'un employé (crée un modèle CUSTOM dédié)."""
    import uuid

    from app.db.models import ModeleTache, TacheParcours
    code = "CUSTOM_" + uuid.uuid4().hex[:8]
    db.add(ModeleTache(code_tache=code, libelle=libelle, type_parcours=type_parcours, ordre=99, delai_jours=None))
    db.flush()
    t = TacheParcours(matricule=matricule, code_tache=code, statut="todo", date_echeance=date_echeance)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def delete_tache(db, id_tache) -> bool:
    from app.db.models import ModeleTache, TacheParcours
    t = db.get(TacheParcours, id_tache)
    if t is None:
        return False
    code = t.code_tache
    db.delete(t)
    db.flush()
    # Nettoie le modèle custom devenu orphelin.
    if code.startswith("CUSTOM_"):
        still = db.scalar(select(func.count(TacheParcours.id_tache)).where(TacheParcours.code_tache == code))
        if not still:
            m = db.get(ModeleTache, code)
            if m:
                db.delete(m)
    db.commit()
    return True


def list_taches(db, matricule, type_parcours=None):
    from app.db.models import ModeleTache, TacheParcours
    stmt = select(TacheParcours).where(TacheParcours.matricule == matricule)
    if type_parcours:
        stmt = stmt.join(ModeleTache).where(ModeleTache.type_parcours == type_parcours)
    return list(db.scalars(stmt))


def get_tache(db, id_tache):
    from app.db.models import TacheParcours
    return db.get(TacheParcours, id_tache)


def init_parcours(db, matricule, type_parcours):
    """Instancie les tâches manquantes du parcours pour un employé.
    date_echeance = aujourd'hui + delai_jours. Renvoie les tâches du parcours."""
    from datetime import timedelta

    from app.db.models import ModeleTache, TacheParcours
    existing = {t.code_tache for t in list_taches(db, matricule, type_parcours)}
    today = date.today()
    for m in list_modele_taches(db, type_parcours):
        if m.code_tache in existing:
            continue
        ech = today + timedelta(days=m.delai_jours) if m.delai_jours else None
        db.add(TacheParcours(matricule=matricule, code_tache=m.code_tache,
                             statut="todo", date_echeance=ech))
    db.commit()
    return list_taches(db, matricule, type_parcours)


def set_tache_status(db, id_tache, new_status, date_realisation=None):
    from app.db.models import TacheParcours
    t = db.get(TacheParcours, id_tache)
    if t is None:
        return None
    t.statut = new_status
    if new_status == "done" and date_realisation is None:
        t.date_realisation = date.today()
    elif date_realisation is not None:
        t.date_realisation = date_realisation
    db.commit()
    db.refresh(t)
    return t


# ───────────── Documents (génération + validation) ─────────────
def list_modele_document(db, *, only_active: bool = False):
    from app.db.models import ModeleDocument
    stmt = select(ModeleDocument)
    if only_active:
        stmt = stmt.where(ModeleDocument.actif.is_(True))
    return list(db.scalars(stmt.order_by(ModeleDocument.libelle)))


def create_modele_document(db, *, libelle, categorie=None, gabarit=None, code=None):
    """Crée un type de document (modèle). Code auto si non fourni."""
    import uuid

    from app.db.models import ModeleDocument
    code = code or ("D_" + uuid.uuid4().hex[:6].upper())
    m = ModeleDocument(code_modele=code, libelle=libelle, categorie=categorie,
                       gabarit=gabarit, actif=True)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def update_modele_document(db, code, patch: dict):
    from app.db.models import ModeleDocument
    m = db.get(ModeleDocument, code)
    if m is None:
        return None
    if patch.get("libelle"):
        m.libelle = patch["libelle"]
    if "categorie" in patch:
        m.categorie = patch["categorie"]
    if "gabarit" in patch:
        m.gabarit = patch["gabarit"]
    if patch.get("actif") is not None:
        m.actif = patch["actif"]
    db.commit()
    db.refresh(m)
    return m


def delete_modele_document(db, code) -> str:
    """Renvoie 'not_found', 'in_use' (référencé par des documents) ou 'ok'."""
    from app.db.models import Document, ModeleDocument
    m = db.get(ModeleDocument, code)
    if m is None:
        return "not_found"
    used = db.scalar(select(func.count(Document.id_document)).where(Document.code_modele == code))
    if used:
        return "in_use"
    db.delete(m)
    db.commit()
    return "ok"


def modele_document_exists(db, code_modele: str) -> bool:
    from app.db.models import ModeleDocument
    return db.get(ModeleDocument, code_modele) is not None


def list_documents(db, *, employee_id=None, status=None):
    from app.db.models import Document
    stmt = select(Document)
    if employee_id:
        stmt = stmt.where(Document.matricule == employee_id)
    if status:
        stmt = stmt.where(Document.statut == status)
    return list(db.scalars(stmt.order_by(Document.date_creation.desc())))


def get_document(db, id_document: int):
    from app.db.models import Document
    return db.get(Document, id_document)


def _default_document_body(db, matricule, code_modele) -> str:
    """Corps de brouillon par défaut (modèle + données réelles de l'employé)."""
    from app.db.models import Employe, ModeleDocument
    libelle = "Document"
    gabarit = None
    if code_modele:
        m = db.get(ModeleDocument, code_modele)
        if m:
            libelle = m.libelle
            gabarit = m.gabarit
    if gabarit:
        return gabarit
    emp = db.get(Employe, matricule)
    nom = f"{emp.prenom} {emp.nom}" if emp else matricule
    poste = (emp.poste if emp else None) or "—"
    return (
        f"{libelle}\n{'=' * len(libelle)}\n\n"
        f"Collaborateur : {nom}\n"
        f"Matricule     : {matricule}\n"
        f"Poste         : {poste}\n\n"
        "Objet : à compléter.\n\n"
        "[ Rédigez ici le contenu du document. Ce brouillon n'est pas encore soumis. ]\n"
    )


def create_document(db, *, matricule, code_modele=None, nom_fichier=None, contenu=None):
    """« Génère » un document en BROUILLON (statut draft). L'utilisateur le relit,
    le modifie, puis le soumet explicitement (draft -> pending). Upload MinIO à brancher."""
    import uuid

    from app.db.models import Document, ModeleDocument
    if nom_fichier is None:
        libelle = None
        if code_modele:
            m = db.get(ModeleDocument, code_modele)
            libelle = m.libelle if m else code_modele
        nom_fichier = f"{(libelle or 'document').replace(' ', '_').lower()}_{matricule}.pdf"
    if contenu is None:
        contenu = _default_document_body(db, matricule, code_modele)
    # Clé MinIO unique (un même collaborateur peut générer plusieurs fois le même type).
    uniq = uuid.uuid4().hex[:8]
    doc = Document(matricule=matricule, code_modele=code_modele,
                   nom_fichier=nom_fichier, statut="draft", contenu=contenu,
                   cle_minio=f"documents/{matricule}/{uniq}_{nom_fichier}")
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def create_submitted_document(db, *, matricule, document_name, contenu, type_doc=None, cle_minio=None, code_modele=None, statut="pending", date_validation=None, id_valideur=None):
    """Crée un document directement en statut spécifié (workflow preview -> submit)."""
    from app.db.models import Document
    doc = Document(matricule=matricule, code_modele=code_modele, nom_fichier=document_name,
                   type_doc=type_doc, contenu=contenu, statut=statut, cle_minio=cle_minio,
                   date_validation=date_validation, id_valideur=id_valideur)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def set_document_minio(db, id_document, cle_minio):
    from app.db.models import Document
    doc = db.get(Document, id_document)
    if doc is not None:
        doc.cle_minio = cle_minio
        db.commit()
    return doc


def update_document(db, id_document, *, nom_fichier=None, contenu=None):
    """Édite un brouillon (nom et/ou contenu). Renvoie None si introuvable."""
    from app.db.models import Document
    doc = db.get(Document, id_document)
    if doc is None:
        return None
    if nom_fichier is not None:
        doc.nom_fichier = nom_fichier
    if contenu is not None:
        doc.contenu = contenu
    db.commit()
    db.refresh(doc)
    return doc


def set_document_status(db, id_document, new_status, *, valideur_id=None):
    from app.db.models import Document
    doc = db.get(Document, id_document)
    if doc is None:
        return None
    doc.statut = new_status
    if new_status in ("validated", "refused"):
        doc.date_validation = date.today()
        doc.id_valideur = valideur_id
    db.commit()
    db.refresh(doc)
    return doc


# ───────────── Recherche globale v2 (contrat plat results[]) ─────────────
def dept_matricules(db, dept_id) -> list[str]:
    """Matricules d'un département (périmètre manager)."""
    from app.db.models import Employe
    if dept_id is None:
        return []
    return list(db.scalars(select(Employe.matricule).where(Employe.id_departement == dept_id)))


def gsearch_employees(db, q, *, dept_id=None, limit=5):
    """Employés par nom/prénom/email/poste (ILIKE). dept_id => périmètre équipe."""
    from app.db.models import Departement, Employe, Utilisateur
    like = f"%{q}%"
    stmt = (
        select(Employe, Utilisateur.email, Departement.nom)
        .join(Utilisateur, Employe.id_utilisateur == Utilisateur.id_utilisateur, isouter=True)
        .join(Departement, Employe.id_departement == Departement.id_departement, isouter=True)
        .where(or_(Employe.nom.ilike(like), Employe.prenom.ilike(like),
                   Employe.poste.ilike(like), Utilisateur.email.ilike(like)))
    )
    if dept_id is not None:
        stmt = stmt.where(Employe.id_departement == dept_id)
    rows = db.execute(stmt.limit(limit)).all()
    out = []
    for e, email, dept in rows:
        sub = " · ".join(x for x in [e.poste, dept] if x) or (email or e.matricule)
        out.append({"type": "employee", "id": e.matricule,
                    "title": f"{e.prenom} {e.nom}".strip() or e.matricule,
                    "subtitle": sub, "url": "/rh/collaborateurs", "icon": "user"})
    return out


def gsearch_documents(db, q, *, matricules=None, limit=3):
    """Documents par nom/type. matricules=None => tous ; sinon restreint au périmètre."""
    from app.db.models import Document
    like = f"%{q}%"
    stmt = select(Document).where(or_(Document.nom_fichier.ilike(like), Document.type_doc.ilike(like)))
    if matricules is not None:
        if not matricules:
            return []
        stmt = stmt.where(Document.matricule.in_(matricules))
    rows = list(db.scalars(stmt.order_by(Document.date_creation.desc()).limit(limit)))
    return [{"type": "document", "id": d.id_document, "title": d.nom_fichier,
             "subtitle": (d.type_doc or d.statut or "document"),
             "url": "/app/documents", "icon": "file"} for d in rows]


def gsearch_absences(db, q, *, matricules=None, limit=3):
    """Absences (demandes de type absence) par type/détail. matricules => périmètre."""
    from app.db.models import Demande
    from app.db.seed import ABSENCE_TYPE_CODES
    like = f"%{q}%"
    stmt = select(Demande).where(
        Demande.code_type.in_(ABSENCE_TYPE_CODES),
        or_(Demande.code_type.ilike(like), Demande.detail.ilike(like)),
    )
    if matricules is not None:
        if not matricules:
            return []
        stmt = stmt.where(Demande.matricule.in_(matricules))
    rows = list(db.scalars(stmt.order_by(Demande.date_depot.desc()).limit(limit)))
    return [{"type": "absence", "id": d.id_demande, "title": f"{d.code_type} — {d.matricule}",
             "subtitle": f"{d.statut}", "url": "/rh/demandes", "icon": "calendar"} for d in rows]


# ───────────── Recherche globale (legacy, conservée) ─────────────
def search_documents(db, q, *, matricule=None, limit=8):
    from app.db.models import Document
    like = f"%{q}%"
    stmt = select(Document).where(or_(Document.nom_fichier.ilike(like), Document.contenu.ilike(like)))
    if matricule:
        stmt = stmt.where(Document.matricule == matricule)
    rows = list(db.scalars(stmt.order_by(Document.date_creation.desc()).limit(limit)))
    return [{"id": d.id_document, "title": d.nom_fichier, "subtitle": d.statut,
             "matricule": d.matricule} for d in rows]


def search_conversations(db, q, *, user_email, limit=8):
    from app.db.models import ConversationIA
    u = db.scalar(select(Utilisateur).where(Utilisateur.email == user_email))
    if u is None:
        return []
    like = f"%{q}%"
    rows = list(db.scalars(
        select(ConversationIA).where(
            ConversationIA.id_utilisateur == u.id_utilisateur,
            ConversationIA.archivee.is_(False),
            ConversationIA.titre.ilike(like),
        ).order_by(ConversationIA.date_maj.desc()).limit(limit)
    ))
    return [{"id": c.id_conversation, "title": c.titre} for c in rows]


def search_employees(db, q, *, limit=8):
    from app.db.models import Employe
    like = f"%{q}%"
    rows = list(db.scalars(
        select(Employe).where(or_(
            Employe.nom.ilike(like), Employe.prenom.ilike(like),
            Employe.poste.ilike(like), Employe.matricule.ilike(like),
        )).limit(limit)
    ))
    return [{"id": e.matricule, "title": f"{e.prenom} {e.nom}".strip(),
             "subtitle": e.poste or e.matricule} for e in rows]


def search_demandes(db, q, *, matricule=None, limit=8):
    from app.db.models import Demande
    like = f"%{q}%"
    stmt = select(Demande).where(or_(Demande.detail.ilike(like), Demande.code_type.ilike(like)))
    if matricule:
        stmt = stmt.where(Demande.matricule == matricule)
    rows = list(db.scalars(stmt.order_by(Demande.date_depot.desc()).limit(limit)))
    return [{"id": d.id_demande, "title": d.code_type, "subtitle": d.statut,
             "matricule": d.matricule} for d in rows]


def search_procedures(db, q, *, limit=8):
    """Procédures internes = modèles de tâches de parcours (hors tâches CUSTOM)."""
    from app.db.models import ModeleTache
    like = f"%{q}%"
    rows = list(db.scalars(
        select(ModeleTache).where(
            ~ModeleTache.code_tache.like("CUSTOM\\_%", escape="\\"),
            ModeleTache.libelle.ilike(like),
        ).limit(limit)
    ))
    return [{"id": m.code_tache, "title": m.libelle, "subtitle": m.type_parcours} for m in rows]


# ───────────── Scores de risque & indicateurs RH ─────────────
def list_scores(db, *, niveau=None, type=None):
    from app.db.models import ScoreRisque
    stmt = select(ScoreRisque)
    if niveau:
        stmt = stmt.where(ScoreRisque.niveau == niveau)
    if type:
        stmt = stmt.where(ScoreRisque.type == type)
    return list(db.scalars(stmt.order_by(ScoreRisque.valeur.desc())))


def risk_summary(db, top: int = 5) -> dict:
    from app.db.models import Employe, ScoreRisque
    rows = list(db.scalars(select(ScoreRisque)))
    by_niveau: dict[str, int] = {}
    for s in rows:
        by_niveau[s.niveau] = by_niveau.get(s.niveau, 0) + 1
    ranked = sorted(rows, key=lambda s: float(s.valeur or 0), reverse=True)[:top]
    top_list = []
    for s in ranked:
        emp = db.get(Employe, s.matricule)
        d = s.to_dict()
        d["employee_name"] = f"{emp.prenom} {emp.nom}" if emp else None
        top_list.append(d)
    return {"total": len(rows), "by_niveau": by_niveau, "top": top_list}


def list_indicateurs(db, *, type=None, periode=None):
    from app.db.models import IndicateurRH
    stmt = select(IndicateurRH)
    if type:
        stmt = stmt.where(IndicateurRH.type == type)
    if periode:
        stmt = stmt.where(IndicateurRH.periode == periode)
    return list(db.scalars(stmt.order_by(IndicateurRH.date_calcul.desc())))


def latest_indicateurs(db) -> dict:
    """Dernière valeur connue par type d'indicateur."""
    from app.db.models import IndicateurRH
    rows = list(db.scalars(select(IndicateurRH).order_by(IndicateurRH.date_calcul.desc())))
    seen: dict[str, dict] = {}
    for i in rows:
        if i.type not in seen:
            seen[i.type] = i.to_dict()
    return seen
