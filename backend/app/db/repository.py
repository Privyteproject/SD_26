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


def update_my_profile(db, matricule: str, patch: dict) -> Employe:
    """Met à jour les champs personnels (téléphone, bio, photo) d'un collaborateur."""
    emp = db.get(Employe, matricule)
    if emp is None:
        return None
    for k in ("telephone", "bio", "photo"):
        if k in patch:
            setattr(emp, k, patch[k])
    db.commit()
    db.refresh(emp)
    return emp


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
    from app.services import crypto
    u = db.scalar(select(Utilisateur).where(Utilisateur.email == user_email))
    if u is None:
        return None  # pas de compte rattaché -> pas de log (FK obligatoire)
    it = InteractionIA(
        # Chiffrement au repos (§3.3) : contenu illisible en base sans la clé.
        prompt=crypto.encrypt(prompt), reponse=crypto.encrypt(reponse),
        tokens_used=tokens, model_name=model,
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


# ───────────── Notifications / Alertes ─────────────
_ALERT_BROADCAST_ROLES = {"ADMIN", "RH", "DIRECTION"}


def _alerte_to_dict(a) -> dict:
    return {
        "id": a.id_alerte, "message": a.message, "categorie": a.categorie,
        "gravite": a.gravite, "lue": bool(a.lue), "resolue": bool(a.resolue),
        "date_creation": a.date_creation.isoformat() if a.date_creation else None,
        "matricule": a.matricule, "id_destinataire": a.id_destinataire,
    }


def count_recent_refusals(db, matricule, hours: int = 1) -> int:
    """Nombre de refus d'accès récents (<= hours) pour un matricule (anti-abus)."""
    from datetime import datetime, timedelta, timezone
    from app.db.models import Alerte
    if not matricule:
        return 0
    rows = db.scalars(
        select(Alerte.date_creation).where(
            Alerte.matricule == matricule,
            Alerte.categorie.in_(["acces_refuse", "acces_refuse_repete"]),
        ).order_by(Alerte.date_creation.desc()).limit(20)
    ).all()
    now = datetime.now(timezone.utc)
    cnt = 0
    for d in rows:
        if not d:
            continue
        dd = d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        if now - dd <= timedelta(hours=hours):
            cnt += 1
    return cnt


_GRAVITE_RANK = {"high": 0, "mid": 1, "low": 2}


def list_alertes_prioritized(db, *, include_resolved=False, limit=100, department_id=None):
    """Worklist : alertes triées par criticité (high d'abord) puis date (récent d'abord)."""
    from app.db.models import Alerte, Employe
    stmt = select(Alerte)
    if department_id:
        stmt = stmt.join(Employe, Employe.matricule == Alerte.matricule).where(Employe.id_departement == department_id)
    if not include_resolved:
        stmt = stmt.where(Alerte.resolue.is_(False))
    rows = list(db.scalars(stmt.limit(500)))
    rows.sort(key=lambda a: (_GRAVITE_RANK.get(a.gravite, 3),
                             -(a.date_creation.timestamp() if a.date_creation else 0)))
    return [_alerte_to_dict(a) for a in rows[:limit]]


def resolve_alerte(db, id_alerte) -> bool:
    from datetime import date as _date
    from app.db.models import Alerte
    a = db.get(Alerte, id_alerte)
    if a is None:
        return False
    a.resolue = True
    a.date_resolution = _date.today()
    db.commit()
    return True


def create_alerte(db, *, message, categorie="info", gravite="mid", id_destinataire=None, matricule=None):
    """Crée une notification/alerte. id_destinataire=None => diffusion RH/Admin."""
    from app.db.models import Alerte
    a = Alerte(message=message, categorie=categorie, gravite=gravite,
               confidentielle=False, lue=False, resolue=False,
               id_destinataire=id_destinataire, matricule=matricule)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def create_feedback(db, *, matricule, note_1_5=None, categorie=None, commentaire=None,
                    auteur=None, date_feedback=None):
    """Enregistre un feedback interne sur un collaborateur (signal pour le ML désengagement)."""
    from app.db.models import Feedback
    f = Feedback(matricule=matricule, note_1_5=note_1_5, categorie=categorie,
                 commentaire=commentaire, auteur=auteur, date_feedback=date_feedback or date.today())
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def list_feedbacks(db, matricule=None, limit=200):
    from app.db.models import Feedback
    stmt = select(Feedback).order_by(Feedback.date_feedback.desc())
    if matricule:
        stmt = stmt.where(Feedback.matricule == matricule)
    return list(db.scalars(stmt.limit(limit)))


def check_overdue_onboarding(db) -> dict:
    """Crée une alerte par tâche d'onboarding EN RETARD (échéance dépassée, non terminée).
    Idempotent : ne re-signale pas une tâche déjà alertée non résolue (catégorie
    'parcours_retard', id de tâche encodé dans le message)."""
    from app.db.models import Alerte, Employe, ModeleTache, TacheParcours
    today = date.today()
    rows = list(db.execute(
        select(TacheParcours, ModeleTache.libelle, Employe.prenom, Employe.nom)
        .join(ModeleTache, TacheParcours.code_tache == ModeleTache.code_tache)
        .join(Employe, TacheParcours.matricule == Employe.matricule)
        .where(ModeleTache.type_parcours == "ONBOARDING",
               TacheParcours.completed.is_(False),
               TacheParcours.date_echeance.is_not(None),
               TacheParcours.date_echeance < today)
    ).all())

    # Tâches déjà signalées (alerte ouverte) -> éviter les doublons.
    already = set()
    for (msg,) in db.execute(
        select(Alerte.message).where(Alerte.categorie == "parcours_retard",
                                     Alerte.resolue.is_(False))).all():
        if msg and "#tache=" in msg:
            already.add(msg.split("#tache=")[-1].strip())

    created = 0
    for tache, libelle, prenom, nom in rows:
        tag = str(tache.id_tache)
        if tag in already:
            continue
        retard = (today - tache.date_echeance).days
        db.add(Alerte(
            categorie="parcours_retard", gravite="high" if retard > 7 else "mid",
            message=(f"Onboarding en retard : « {libelle} » pour {prenom} {nom} "
                     f"({tache.matricule}) — échéance dépassée de {retard} j. #tache={tag}"),
            confidentielle=False, lue=False, resolue=False, matricule=tache.matricule))
        created += 1
    db.commit()
    return {"overdue": len(rows), "alertes_creees": created}


def manager_utilisateur_id(db, matricule) -> int | None:
    """id_utilisateur du manager d'un employé (pour lui adresser une notification)."""
    from app.db.models import Employe
    emp = db.get(Employe, matricule)
    if emp is None or not emp.matricule_manager:
        return None
    mgr = db.get(Employe, emp.matricule_manager)
    return mgr.id_utilisateur if mgr else None


def list_alertes_for(db, *, user_email, role, limit=30):
    """Notifications visibles : celles adressées à l'utilisateur + diffusions (RH/Admin)."""
    from app.db.models import Alerte
    uid = _uid(db, user_email)
    conds = []
    if uid is not None:
        conds.append(Alerte.id_destinataire == uid)
    if role in _ALERT_BROADCAST_ROLES:
        conds.append(Alerte.id_destinataire.is_(None))
    if not conds:
        return [], 0
    stmt = select(Alerte).where(or_(*conds)).order_by(Alerte.lue.asc(), Alerte.date_creation.desc())
    rows = list(db.scalars(stmt.limit(limit)))
    unread = sum(1 for a in rows if not a.lue)
    return [_alerte_to_dict(a) for a in rows], unread


def mark_all_alertes_read(db, *, user_email, role) -> int:
    """Marque comme lues toutes les notifications visibles par l'utilisateur (« clear all »).
    Même périmètre que la lecture (anti-IDOR)."""
    from app.db.models import Alerte
    uid = _uid(db, user_email)
    conds = []
    if uid is not None:
        conds.append(Alerte.id_destinataire == uid)
    if role in _ALERT_BROADCAST_ROLES:
        conds.append(Alerte.id_destinataire.is_(None))
    if not conds:
        return 0
    res = db.execute(sa_update(Alerte).where(or_(*conds), Alerte.lue.is_(False)).values(lue=True))
    db.commit()
    return res.rowcount or 0


def mark_alerte_read(db, *, id_alerte, user_email, role) -> bool:
    from app.db.models import Alerte
    a = db.get(Alerte, id_alerte)
    if a is None:
        return False
    uid = _uid(db, user_email)
    owned = (a.id_destinataire == uid) or (a.id_destinataire is None and role in _ALERT_BROADCAST_ROLES)
    if not owned:
        return False
    a.lue = True
    db.commit()
    return True


def log_audit(db, *, action, type_entite, id_entite, user_email=None):
    """Écrit une entrée d'audit explicite (pour les actions non couvertes par les events)."""
    from app.db.models import JournalAudit
    uid = _uid(db, user_email) if user_email else None
    db.add(JournalAudit(action=action, type_entite=type_entite,
                        id_entite=str(id_entite), id_utilisateur=uid))
    db.commit()


def list_ia_interactions(db, *, limit: int = 100) -> list[dict]:
    """Journaux des échanges IA (supervision) — MÉTADONNÉES uniquement.

    Conformité : le contenu (prompt/réponse) n'est PAS exposé ici. On renvoie une
    longueur indicative (`prompt_len`) ; le détail est accessible via un endpoint
    dédié et tracé. Les e-mails sont pseudonymisés (partiellement masqués)."""
    from app.db.models import InteractionIA
    from app.services import crypto
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
            "user": _mask_email(u.email) if u else None,
            "role": u.code_role if u else None,
            "prompt_len": len(crypto.decrypt(it.prompt) or ""),  # longueur réelle (déchiffrée côté serveur)
            "statut": it.statut,
            "sensible": it.sensible,
            "tokens": it.tokens_used,
            "model": it.model_name,
        })
    return out


def _mask_email(email: str | None) -> str | None:
    """j***@domaine.com — pseudonymisation pour la supervision."""
    if not email or "@" not in email:
        return email
    local, dom = email.split("@", 1)
    return f"{local[0]}***@{dom}"


def ia_interaction_detail(db, id_interaction, *, viewer_email=None) -> dict | None:
    """Contenu complet d'un échange IA — accès réservé et TRACÉ (audit)."""
    from app.db.models import InteractionIA, Utilisateur
    from app.services import crypto
    it = db.get(InteractionIA, id_interaction)
    if it is None:
        return None
    u = db.get(Utilisateur, it.id_utilisateur) if it.id_utilisateur else None
    log_audit(db, action="IA_LOG_VIEW", type_entite="interaction_ia",
              id_entite=id_interaction, user_email=viewer_email)
    return {
        "id": it.id_interaction,
        "date": it.date_creation.isoformat() if it.date_creation else None,
        "user": u.email if u else None, "role": u.code_role if u else None,
        # Déchiffrement à la volée — accès exceptionnel, réservé ADMIN et tracé ci-dessus.
        "prompt": crypto.decrypt(it.prompt), "reponse": crypto.decrypt(it.reponse),
        "sensible": it.sensible, "tokens": it.tokens_used, "model": it.model_name,
    }


def purge_ia_logs(db, days: int = 90) -> dict:
    """Purge des journaux d'interactions IA au-delà de la rétention (RGPD / §4.4).
    Supprime aussi les liens source_ia associés pour respecter l'intégrité."""
    from datetime import timedelta, timezone
    from app.db.models import InteractionIA, SourceIA
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    old_ids = list(db.scalars(
        select(InteractionIA.id_interaction).where(InteractionIA.date_creation < cutoff)))
    if not old_ids:
        return {"purged": 0, "retention_days": days}
    db.execute(sa_delete(SourceIA).where(SourceIA.id_interaction.in_(old_ids)))
    db.execute(sa_delete(InteractionIA).where(InteractionIA.id_interaction.in_(old_ids)))
    db.commit()
    return {"purged": len(old_ids), "retention_days": days}


# ───────────── Accès données sensibles employé (moteur E5 / ABAC) ─────────────
def _norm_txt(s: str) -> str:
    """Normalise (sans accents, minuscules) pour la détection de noms dans un texte."""
    import unicodedata
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode("ascii").lower()


def find_employees_in_text(db, message: str, limit: int = 5) -> list:
    """Détecte les employés nommés dans le message (scan nom/prénom/matricule normalisé).

    Approche simple O(n) validée pour l'échelle actuelle ; indexable (pg_trgm) si > 10k.
    Match sur le nom de famille, le « prénom nom » complet, ou le matricule.
    """
    import re
    from app.db.models import Employe
    msg = _norm_txt(message)
    tokens = set(re.findall(r"[a-z0-9]+", msg))
    exact, partial = [], []  # exact = nom complet/matricule ; partial = nom de famille seul
    for e in db.scalars(select(Employe)):
        pn, nn = _norm_txt(e.prenom), _norm_txt(e.nom)
        full = f"{pn} {nn}".strip()
        full_rev = f"{nn} {pn}".strip()
        if (full and full in msg) or (full_rev and full_rev in msg) or (e.matricule or "").lower() in tokens:
            exact.append(e)
        elif len(nn) >= 3 and nn in tokens:
            partial.append(e)
    # Une correspondance par NOM COMPLET prime sur les homonymes partiels (« adam roux »
    # ne doit pas être noyé par les autres « Adam »). Repli sur le nom de famille sinon.
    return (exact or partial)[:limit]


def get_latest_salary(db, matricule):
    """Dernière ligne d'historique de salaire (ou None).
    Départage par id_historique pour les lignes de même date (ex. backfill + promotion le même jour)."""
    from app.db.models import HistoriqueSalaire
    return db.scalars(
        select(HistoriqueSalaire).where(HistoriqueSalaire.matricule == matricule)
        .order_by(HistoriqueSalaire.date_effet.desc(), HistoriqueSalaire.id_historique.desc())
        .limit(1)).first()


def get_dossier_confidentiel(db, matricule) -> dict | None:
    """Dossier confidentiel (CIN, adresse) déchiffré à la volée (no-op si déjà en clair)."""
    from app.db.models import DossierConfidentiel
    from app.services import crypto
    d = db.get(DossierConfidentiel, matricule)
    if d is None:
        return None
    return {"matricule": d.matricule, "cin": crypto.decrypt(d.cin), "adresse": crypto.decrypt(d.adresse)}


def get_employee_documents(db, matricule, types=("CONTRAT", "FICHE_PAIE")) -> list:
    """Documents d'un employé filtrés par type métier (contrats, fiches de paie…)."""
    from app.db.models import Document
    return list(db.scalars(
        select(Document).where(Document.matricule == matricule, Document.type_doc.in_(list(types)))
        .order_by(Document.date_creation.desc())))


# ───────────── Carrières & compétences ─────────────
def list_metiers(db, dept=None):
    """Tous les métiers (dept=None) ou ceux du périmètre d'un manager (dept + non assignés)."""
    from app.db.models import Metier
    stmt = select(Metier).order_by(Metier.nom)
    if dept is not None:
        stmt = stmt.where(or_(Metier.id_departement == dept, Metier.id_departement.is_(None)))
    return list(db.scalars(stmt))


def get_metier(db, id_metier):
    from app.db.models import Metier
    return db.get(Metier, id_metier)


def resolve_metier_for_poste(db, poste):
    """Mappe l'intitulé de poste (texte libre) vers un métier du référentiel.
    Robuste aux variantes genre/pluriel via comparaison par préfixe (ex. Développeuse → Développeur)."""
    from app.db.models import Metier
    if not poste:
        return None
    p = _norm_txt(poste)
    pt = p.split()[0] if p.split() else p
    for m in db.scalars(select(Metier)):
        n = _norm_txt(m.nom)
        nt = n.split()[0] if n.split() else n
        if n in p or p in n or (len(nt) >= 5 and (pt.startswith(nt[:5]) or nt.startswith(pt[:5]))):
            return m
    return None


def list_competences(db, categorie=None):
    from app.db.models import Competence
    stmt = select(Competence).order_by(Competence.categorie, Competence.nom)
    if categorie:
        stmt = stmt.where(Competence.categorie == categorie)
    return list(db.scalars(stmt))


def add_competence(db, *, nom, categorie="hard", sous_categorie=None, description=None,
                   methode_evaluation=None, proposee=False):
    from app.db.models import Competence
    c = Competence(nom=nom, categorie=categorie, sous_categorie=sous_categorie,
                   description=description, methode_evaluation=methode_evaluation, proposee=proposee)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


# ── CRUD référentiels métiers (RH = tout, manager = son périmètre) ──
def create_metier(db, *, nom, description=None, missions=None, responsabilites=None, id_departement=None):
    from app.db.models import Metier
    m = Metier(nom=nom, description=description, missions=missions,
               responsabilites=responsabilites, id_departement=id_departement)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def update_metier(db, id_metier, patch: dict):
    from app.db.models import Metier
    m = db.get(Metier, id_metier)
    if m is None:
        return None
    for k in ("nom", "description", "missions", "responsabilites", "id_departement"):
        if k in patch:
            setattr(m, k, patch[k])
    db.commit()
    db.refresh(m)
    return m


def delete_metier(db, id_metier) -> bool:
    from app.db.models import CompetenceRequise, Metier
    m = db.get(Metier, id_metier)
    if m is None:
        return False
    db.execute(sa_delete(CompetenceRequise).where(CompetenceRequise.id_metier == id_metier))
    db.delete(m)
    db.commit()
    return True


def add_competence_requise(db, *, id_metier, niveau, id_competence, niveau_attendu):
    from app.db.models import CompetenceRequise
    r = CompetenceRequise(id_metier=id_metier, niveau=niveau,
                          id_competence=id_competence, niveau_attendu=int(niveau_attendu))
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def delete_competence_requise(db, id_req) -> bool:
    from app.db.models import CompetenceRequise
    r = db.get(CompetenceRequise, id_req)
    if r is None:
        return False
    db.delete(r)
    db.commit()
    return True


def list_proposed_competences(db, *, dept=None) -> list[dict]:
    """Nouvelles compétences proposées par les collaborateurs (RH = toutes ; manager = son équipe)."""
    from app.db.models import Competence, Employe, EvaluationCompetence
    mats = None
    if dept is not None:
        mats = set(db.scalars(select(Employe.matricule).where(Employe.id_departement == dept)))
        if not mats:
            return []
    rows = db.execute(
        select(EvaluationCompetence, Competence)
        .join(Competence, EvaluationCompetence.id_competence == Competence.id_competence)
        .where(Competence.proposee.is_(True))
        .order_by(EvaluationCompetence.date_evaluation.desc())).all()
    out, seen = [], set()
    for e, c in rows:
        if mats is not None and e.matricule not in mats:
            continue
        key = (c.id_competence, e.matricule)
        if key in seen:
            continue
        seen.add(key)
        emp = db.get(Employe, e.matricule)
        out.append({"id_competence": c.id_competence, "competence": c.nom, "categorie": c.categorie,
                    "matricule": e.matricule,
                    "nom_complet": f"{emp.prenom} {emp.nom}" if emp else e.matricule,
                    "niveau_auto": e.niveau_auto, "statut": e.statut,
                    "date": e.date_evaluation.isoformat() if e.date_evaluation else None})
    return out


def competences_requises(db, id_metier, niveau=None):
    from app.db.models import CompetenceRequise
    stmt = select(CompetenceRequise).where(CompetenceRequise.id_metier == id_metier)
    if niveau:
        stmt = stmt.where(CompetenceRequise.niveau == niveau)
    return list(db.scalars(stmt))


def evaluations_for(db, matricule):
    from app.db.models import EvaluationCompetence
    return list(db.scalars(
        select(EvaluationCompetence).where(EvaluationCompetence.matricule == matricule)))


def upsert_self_evaluation(db, *, matricule, id_competence, niveau_auto, commentaire=None):
    """Crée/met à jour l'auto-évaluation d'une compétence (1-5) pour un collaborateur."""
    from app.db.models import EvaluationCompetence
    e = db.scalar(select(EvaluationCompetence).where(
        EvaluationCompetence.matricule == matricule,
        EvaluationCompetence.id_competence == id_competence))
    if e is None:
        e = EvaluationCompetence(matricule=matricule, id_competence=id_competence,
                                 niveau_auto=niveau_auto, commentaire=commentaire,
                                 statut="auto", date_evaluation=date.today())
        db.add(e)
    else:
        e.niveau_auto = niveau_auto
        if commentaire is not None:
            e.commentaire = commentaire
        e.statut = "auto"  # une nouvelle auto-éval rouvre la validation
        e.date_evaluation = date.today()
    db.commit()
    db.refresh(e)
    return e


def validate_evaluation(db, *, id_eval, niveau_expert, evaluateur=None):
    from app.db.models import EvaluationCompetence
    e = db.get(EvaluationCompetence, id_eval)
    if e is None:
        return None
    # Niveau de poste AVANT la validation (pour détecter une montée de niveau).
    niveau_avant = current_career_level(db, e.matricule)
    e.niveau_expert = niveau_expert
    e.statut = "valide"
    e.evaluateur = evaluateur
    e.date_evaluation = date.today()
    db.flush()  # rend la validation visible pour le recalcul du niveau
    niveau_apres = current_career_level(db, e.matricule)
    # Si le niveau de poste a monté -> alignement du salaire sur la grille (promotion).
    apply_grille_on_promotion(db, e.matricule, niveau_avant, niveau_apres)
    db.commit()
    db.refresh(e)
    return e


def apply_grille_on_promotion(db, matricule, niveau_avant, niveau_apres) -> bool:
    """Insère une ligne salaire au palier supérieur SI le niveau de poste a monté.
    N'abaisse jamais le salaire ; n'agit que si la grille dépasse le salaire actuel."""
    from app.db.models import Employe, HistoriqueSalaire
    from app.services import salaire as grille
    if niveau_apres is None:
        return False
    if grille.niveau_index(niveau_apres) <= grille.niveau_index(niveau_avant):
        return False  # pas de montée de niveau
    emp = db.get(Employe, matricule)
    if emp is None:
        return False
    metier = resolve_metier_for_poste(db, emp.poste)
    cible = grille.salaire_grille(niveau_apres, metier.nom if metier else None)
    actuel = get_latest_salary(db, matricule)
    montant_actuel = float(actuel.montant) if actuel else 0.0
    if cible <= montant_actuel:
        return False  # déjà au-dessus de la grille du nouveau palier
    db.add(HistoriqueSalaire(matricule=matricule, montant=cible,
                             date_effet=date.today(), motif=f"Promotion {niveau_apres}"))
    db.flush()
    return True


def _niveau_pour_grille(db, emp) -> str | None:
    """Niveau retenu pour aligner un salaire sur la grille :
    niveau de poste validé si disponible, sinon dérivé de l'ancienneté (distribution réaliste)."""
    niv = current_career_level(db, emp.matricule)
    if niv:
        return niv
    if emp.date_embauche:
        ans = (date.today() - emp.date_embauche).days / 365.0
        if ans < 2:
            return "Junior"
        if ans < 4:
            return "Opérationnel"
        if ans < 7:
            return "Confirmé"
        return "Senior"
    return "Junior"


def backfill_grille_salaires(db) -> dict:
    """Aligne le salaire courant de TOUS les employés sur la grille (métier × niveau).
    Idempotent : n'ajoute une ligne que si le montant cible diffère du salaire actuel."""
    from app.db.models import Employe, HistoriqueSalaire
    from app.services import salaire as grille
    n_updated = 0
    for emp in db.scalars(select(Employe)):
        niveau = _niveau_pour_grille(db, emp)
        metier = resolve_metier_for_poste(db, emp.poste)
        cible = grille.salaire_grille(niveau, metier.nom if metier else None)
        actuel = get_latest_salary(db, emp.matricule)
        if actuel is not None and abs(float(actuel.montant) - cible) < 1:
            continue
        db.add(HistoriqueSalaire(matricule=emp.matricule, montant=cible,
                                 date_effet=date.today(), motif="Grille"))
        n_updated += 1
    db.commit()
    return {"updated": n_updated}


def pending_evaluations(db, *, dept=None, limit=500):
    """File de validation : auto-évaluations non encore validées par un expert.
    Les compétences NOUVELLEMENT PROPOSÉES par les collaborateurs (proposee=True) sont
    remontées en tête pour ne jamais être noyées par les auto-évaluations du référentiel.
    `dept` (manager) restreint aux collaborateurs de son équipe ; None = tout (RH/Direction/Admin)."""
    from app.db.models import Competence, Employe, EvaluationCompetence
    rows = list(db.scalars(
        select(EvaluationCompetence)
        .join(Competence, EvaluationCompetence.id_competence == Competence.id_competence)
        .where(EvaluationCompetence.statut == "auto")
        .order_by(Competence.proposee.desc(),
                  EvaluationCompetence.date_evaluation.desc(),
                  EvaluationCompetence.id.desc())
        .limit(limit)))
    if dept is not None:
        mats = set(db.scalars(select(Employe.matricule).where(Employe.id_departement == dept)))
        rows = [e for e in rows if e.matricule in mats]
    return rows


def missing_postes(db) -> list[str]:
    """Intitulés de poste d'employés qui ne correspondent à aucun métier du référentiel."""
    from app.db.models import Employe
    postes = [p for (p,) in db.execute(
        select(Employe.poste).where(Employe.poste.is_not(None)).distinct()).all()]
    out, seen = [], set()
    for poste in postes:
        p = (poste or "").strip()
        if not p or resolve_metier_for_poste(db, p) is not None:
            continue
        k = _norm_txt(p)
        if k in seen:
            continue
        seen.add(k)
        out.append(p)
    return out


def create_missing_metiers(db) -> dict:
    """Création auto : un métier vide par intitulé de poste non encore mappé (RH le complète ensuite)."""
    created = []
    for p in missing_postes(db):
        if resolve_metier_for_poste(db, p) is None:  # re-check : un create précédent peut matcher par préfixe
            created.append(create_metier(db, nom=p).nom)
    return {"created": created, "count": len(created)}


def _niveau_effectif(e):
    """Niveau retenu pour une éval : la note validée par le manager prime sur l'auto-éval."""
    if e is None:
        return 0
    return (e.niveau_expert if e.niveau_expert is not None else e.niveau_auto) or 0


def _niveau_valide(e):
    """Niveau OFFICIEL d'une compétence = uniquement la note validée par le manager.
    L'auto-évaluation du collaborateur ne compte pas pour le niveau de poste."""
    return (e.niveau_expert or 0) if e is not None else 0


def current_career_level(db, matricule, *, metier=None, evals=None):
    """Niveau de poste ATTEINT par le collaborateur, déduit de ses compétences VALIDÉES.

    Un niveau est atteint si, pour TOUTES les compétences requises à ce niveau, la note
    VALIDÉE PAR LE MANAGER atteint le niveau attendu. La progression est cumulative : on retient
    le plus haut niveau contigu atteint. Le niveau ne change donc QU'APRÈS confirmation du manager
    (l'auto-évaluation du collaborateur n'a aucun effet dessus).
    """
    from app.db.models import Employe, NIVEAUX_CARRIERE
    emp = db.get(Employe, matricule)
    if emp is None:
        return None
    if metier is None:
        metier = resolve_metier_for_poste(db, emp.poste)
    if metier is None:
        return None
    if evals is None:
        evals = {e.id_competence: e for e in evaluations_for(db, matricule)}
    atteint = None
    for niv in NIVEAUX_CARRIERE:  # ordre croissant Junior → Senior
        reqs = competences_requises(db, metier.id_metier, niv)
        if not reqs:
            continue
        if all(_niveau_valide(evals.get(r.id_competence)) >= r.niveau_attendu for r in reqs):
            atteint = niv
        else:
            break  # niveau non atteint : on arrête (progression cumulative)
    return atteint


def competence_radar(db, matricule, *, niveau=None):
    """Radar : pour le métier de l'employé + niveau cible, compare niveau attendu vs actuel.
    Inclut `niveau_actuel` = niveau de poste atteint (recalculé selon les notes validées)."""
    from app.db.models import Employe
    emp = db.get(Employe, matricule)
    if emp is None:
        return None
    metier = resolve_metier_for_poste(db, emp.poste)
    evals = {e.id_competence: e for e in evaluations_for(db, matricule)}
    items, niv = [], (niveau or "Confirmé")
    if metier:
        reqs = competences_requises(db, metier.id_metier, niv) or competences_requises(db, metier.id_metier)
        for r in reqs:
            e = evals.get(r.id_competence)
            actuel = _niveau_effectif(e)
            items.append({"competence": r.competence.nom if r.competence else None,
                          "categorie": r.competence.categorie if r.competence else None,
                          "attendu": r.niveau_attendu, "actuel": actuel,
                          "ecart": actuel - r.niveau_attendu})
    return {"matricule": matricule, "metier": metier.nom if metier else None, "niveau": niv,
            "items": items, "gaps": [i for i in items if i["ecart"] < 0],
            "niveau_actuel": current_career_level(db, matricule, metier=metier, evals=evals)}


def trajectoire_carriere(db, matricule):
    """Trajectoire = niveaux d'évolution disponibles du métier de l'employé."""
    from app.db.models import CompetenceRequise, Employe, NIVEAUX_CARRIERE
    emp = db.get(Employe, matricule)
    if emp is None:
        return None
    metier = resolve_metier_for_poste(db, emp.poste)
    niveaux = []
    if metier:
        present = set(db.scalars(
            select(CompetenceRequise.niveau).where(CompetenceRequise.id_metier == metier.id_metier)))
        niveaux = [n for n in NIVEAUX_CARRIERE if n in present] or NIVEAUX_CARRIERE
    return {"matricule": matricule, "poste": emp.poste,
            "metier": metier.nom if metier else None, "niveaux": niveaux,
            "niveau_actuel": current_career_level(db, matricule, metier=metier) if metier else None}


# ───────────── Objectifs (OKR) & bilans ─────────────
def list_objectifs(db, matricule, periode=None):
    from app.db.models import Objectif
    stmt = select(Objectif).where(Objectif.matricule == matricule)
    if periode:
        stmt = stmt.where(Objectif.periode == periode)
    return list(db.scalars(stmt.order_by(Objectif.periode.desc(), Objectif.id_objectif.desc())))


def team_objectifs(db, *, dept=None, periode=None):
    """Tous les objectifs (dept=None) ou ceux des collaborateurs d'un département (manager)."""
    from app.db.models import Employe, Objectif
    stmt = select(Objectif)
    if periode:
        stmt = stmt.where(Objectif.periode == periode)
    rows = list(db.scalars(stmt.order_by(Objectif.periode.desc(), Objectif.id_objectif.desc())))
    if dept is not None:
        mats = set(db.scalars(select(Employe.matricule).where(Employe.id_departement == dept)))
        rows = [o for o in rows if o.matricule in mats]
    return rows


def create_objectif(db, *, matricule, periode, type_obj, titre, description=None, key_results=None, groupe_id=None):
    from app.db.models import KeyResult, Objectif
    o = Objectif(matricule=matricule, periode=periode, type_obj=type_obj, titre=titre,
                 description=description, statut="actif", groupe_id=groupe_id)
    db.add(o)
    db.flush()
    for kr in (key_results or []):
        db.add(KeyResult(id_objectif=o.id_objectif, libelle=kr.get("libelle", ""),
                         cible=kr.get("cible"), progression=int(kr.get("progression") or 0)))
    db.commit()
    db.refresh(o)
    return o


def update_key_result(db, id_kr, *, progression=None, cible=None):
    from app.db.models import KeyResult
    kr = db.get(KeyResult, id_kr)
    if kr is None:
        return None
    if progression is not None:
        kr.progression = max(0, min(100, int(progression)))
    if cible is not None:
        kr.cible = cible
    db.commit()
    db.refresh(kr)
    return kr


def update_kr_group(db, id_kr, *, progression, dept=None):
    """Met à jour l'avancement d'un résultat clé sur TOUT le groupe d'un objectif partagé.
    Le même KR (même libellé) de chaque collaborateur du groupe est aligné sur la valeur.
    `dept` (manager) limite l'effet aux collaborateurs de son équipe. Retourne le nb de KR modifiés."""
    from app.db.models import Employe, KeyResult, Objectif
    kr = db.get(KeyResult, id_kr)
    if kr is None:
        return 0
    obj = db.get(Objectif, kr.id_objectif)
    if obj is None:
        return 0
    val = max(0, min(100, int(progression)))
    if not obj.groupe_id:                       # objectif individuel : MAJ simple
        kr.progression = val
        db.commit()
        return 1
    mats = None
    if dept is not None:
        mats = set(db.scalars(select(Employe.matricule).where(Employe.id_departement == dept)))
    n = 0
    for o in db.scalars(select(Objectif).where(Objectif.groupe_id == obj.groupe_id)):
        if mats is not None and o.matricule not in mats:
            continue
        for k in o.key_results:
            if k.libelle == kr.libelle:
                k.progression = val
                n += 1
    db.commit()
    return n


def set_objectif_statut(db, id_objectif, statut):
    from app.db.models import Objectif
    o = db.get(Objectif, id_objectif)
    if o is None:
        return None
    o.statut = statut
    db.commit()
    db.refresh(o)
    return o


def get_objectif(db, id_objectif):
    from app.db.models import Objectif
    return db.get(Objectif, id_objectif)


def list_bilans(db, matricule):
    from app.db.models import Bilan
    return list(db.scalars(
        select(Bilan).where(Bilan.matricule == matricule).order_by(Bilan.date_bilan.desc())))


def create_bilan(db, *, matricule, type_bilan, periode, synthese=None, points_forts=None,
                 axes_amelioration=None, aspirations=None, auteur=None):
    from app.db.models import Bilan
    b = Bilan(matricule=matricule, type_bilan=type_bilan, periode=periode, synthese=synthese,
              points_forts=points_forts, axes_amelioration=axes_amelioration,
              aspirations=aspirations, auteur=auteur, date_bilan=date.today())
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


# ───────────── Humeur / climat social (engagement hebdo, anonymisé) ─────────────
def _iso_week(d) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def submit_humeur(db, *, matricule, niveau, commentaire=None, anonyme=True):
    """Enregistre/met à jour l'humeur de la semaine en cours (1 saisie / semaine ISO).
    `anonyme` : choix du collaborateur — si False son nom accompagne le commentaire (consentement explicite)."""
    from app.db.models import Humeur
    sem = _iso_week(date.today())
    h = db.scalar(select(Humeur).where(Humeur.matricule == matricule, Humeur.semaine == sem))
    if h is None:
        h = Humeur(matricule=matricule, semaine=sem, niveau=int(niveau),
                   commentaire=commentaire, anonyme=bool(anonyme), date_saisie=date.today())
        db.add(h)
    else:
        h.niveau = int(niveau)
        if commentaire is not None:
            h.commentaire = commentaire
        h.anonyme = bool(anonyme)
        h.date_saisie = date.today()
    db.commit()
    db.refresh(h)
    return h


def my_humeur(db, matricule):
    """Humeur de la semaine en cours pour un collaborateur (ou None)."""
    from app.db.models import Humeur
    return db.scalar(select(Humeur).where(
        Humeur.matricule == matricule, Humeur.semaine == _iso_week(date.today())))


def humeur_aggregate(db, *, weeks=8, dept=None, min_n=3) -> dict:
    """Climat social AGRÉGÉ et anonymisé : distribution de la semaine + tendance hebdo.
    Les semaines comptant moins de `min_n` réponses sont masquées (anti-réidentification)."""
    from collections import defaultdict
    from app.db.models import Employe, Humeur
    mats = None
    if dept is not None:
        mats = set(db.scalars(select(Employe.matricule).where(Employe.id_departement == dept)))
        if not mats:
            return {"semaine_courante": None, "n": 0, "distribution": None,
                    "score_satisfaction": None, "min_n": min_n, "trend": []}
    by_week = defaultdict(list)
    for sem, niv, mat in db.execute(select(Humeur.semaine, Humeur.niveau, Humeur.matricule)).all():
        if mats is not None and mat not in mats:
            continue
        by_week[sem].append(niv)
    weeks_sorted = sorted(by_week)[-weeks:]
    trend = []
    for w in weeks_sorted:
        vals = by_week[w]
        masque = len(vals) < min_n
        trend.append({"semaine": w, "n": len(vals),
                      "moyenne": (None if masque else round(sum(vals) / len(vals), 2)),
                      "masque": masque})
    cur_week = weeks_sorted[-1] if weeks_sorted else None
    cur = by_week[cur_week] if cur_week else []
    n = len(cur)
    enough = n >= min_n
    dist = ({"satisfait": sum(1 for v in cur if v == 3),
             "neutre": sum(1 for v in cur if v == 2),
             "insatisfait": sum(1 for v in cur if v == 1)} if enough else None)
    score = round((sum(cur) / n) / 3 * 100) if enough else None  # 0-100 (humeur déclarative)

    # ── Enrichissement NLP : sentiment des commentaires de la semaine (agrégé, anonyme) ──
    score_sentiment = sentiment_label = None
    n_comments = 0
    if cur_week:
        from app.services.sentiment import score_texts
        # Conformité : exclure les collaborateurs ayant RETIRÉ leur consentement à l'analyse de sentiment.
        refus = matricules_refusant(db, "analyse_sentiment")
        comments = []
        for com, mat in db.execute(
                select(Humeur.commentaire, Humeur.matricule).where(
                    Humeur.semaine == cur_week, Humeur.commentaire.is_not(None))).all():
            if mats is not None and mat not in mats:
                continue
            if mat in refus:
                continue
            if (com or "").strip():
                comments.append(com)
        sent = score_texts(comments)
        n_comments = sent["n"]
        if n_comments >= min_n:  # seuil anti-réidentification, comme pour le score déclaratif
            score_sentiment = sent["score"]
            sentiment_label = sent["label"]

    # Score global : humeur déclarative (70%) pondérée par le sentiment des commentaires (30%).
    if score is not None and score_sentiment is not None:
        score_global = round(0.7 * score + 0.3 * score_sentiment)
    else:
        score_global = score

    return {"semaine_courante": cur_week, "n": n,
            "distribution": dist, "score_satisfaction": score, "min_n": min_n, "trend": trend,
            "score_declaratif": score, "score_sentiment": score_sentiment,
            "sentiment_label": sentiment_label, "n_comments": n_comments,
            "score_global": score_global}


def humeur_comments(db, *, dept=None, semaine=None, limit=80) -> list[dict]:
    """Retours qualitatifs (commentaires) du climat social.
    Par défaut anonymes ; si le collaborateur a explicitement levé l'anonymat (anonyme=False),
    son nom accompagne le commentaire. Aucun matricule n'est jamais exposé.
    Filtrables par semaine ; scope département pour les managers."""
    from app.db.models import Employe, Humeur
    mats = None
    if dept is not None:
        mats = set(db.scalars(select(Employe.matricule).where(Employe.id_departement == dept)))
        if not mats:
            return []
    stmt = (select(Humeur.semaine, Humeur.niveau, Humeur.commentaire, Humeur.matricule,
                   Humeur.anonyme, Humeur.date_saisie)
            .where(Humeur.commentaire.is_not(None)).order_by(Humeur.date_saisie.desc()))
    if semaine:
        stmt = stmt.where(Humeur.semaine == semaine)
    out = []
    for sem, niv, com, mat, anon, _d in db.execute(stmt).all():
        if mats is not None and mat not in mats:
            continue
        if not (com or "").strip():
            continue
        is_anon = anon is None or bool(anon)
        auteur = None
        if not is_anon:
            emp = db.get(Employe, mat)
            auteur = f"{emp.prenom} {emp.nom}".strip() if emp else None
        out.append({"semaine": sem, "niveau": niv, "commentaire": com,
                    "anonyme": is_anon, "auteur": auteur})  # matricule jamais exposé
        if len(out) >= limit:
            break
    return out


# ───────────── Tickets d'assistance (l'IA agit) ─────────────
TICKET_TYPE = "TICKET_ASSISTANCE"
TICKET_STATUTS = ["Nouveau", "En cours", "Résolu"]


def _ensure_ticket_type(db):
    from app.db.models import TypeDemande
    if db.get(TypeDemande, TICKET_TYPE) is None:
        db.add(TypeDemande(code_type=TICKET_TYPE, libelle="Ticket d'assistance"))
        db.commit()


def create_ticket(db, *, matricule, sujet, description):
    """Crée un ticket d'assistance (réutilise la table Demande). Renvoie la ligne créée."""
    from app.db.models import Demande
    _ensure_ticket_type(db)
    detail = (f"{sujet}\n\n{description}" if sujet else description) or sujet or "(sans description)"
    t = Demande(matricule=matricule, code_type=TICKET_TYPE, detail=detail,
                statut="pending", ticket_statut="Nouveau")
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def list_tickets(db, *, matricule=None, dept=None):
    from app.db.models import Demande, Employe
    stmt = select(Demande).where(Demande.code_type == TICKET_TYPE).order_by(Demande.date_depot.desc())
    if matricule:
        stmt = stmt.where(Demande.matricule == matricule)
    elif dept is not None:
        mats = set(db.scalars(select(Employe.matricule).where(Employe.id_departement == dept)))
        if not mats:
            return []
        stmt = stmt.where(Demande.matricule.in_(mats))
    return list(db.scalars(stmt))


def set_ticket_statut(db, id_demande, statut):
    from app.db.models import Demande
    if statut not in TICKET_STATUTS:
        return None
    t = db.get(Demande, id_demande)
    if t is None or t.code_type != TICKET_TYPE:
        return None
    t.ticket_statut = statut
    # Reflète sur le statut contraint (pending/validated) : Résolu -> validated.
    t.statut = "validated" if statut == "Résolu" else "pending"
    db.commit()
    db.refresh(t)
    return t


def ia_interactions_stats(db) -> dict:
    """Agrégats pour la supervision : nombre d'échanges, total tokens, sensibles."""
    from app.db.models import InteractionIA
    total = db.scalar(select(func.count(InteractionIA.id_interaction))) or 0
    tokens = db.scalar(select(func.coalesce(func.sum(InteractionIA.tokens_used), 0))) or 0
    sensibles = db.scalar(
        select(func.count(InteractionIA.id_interaction)).where(InteractionIA.sensible.is_(True))
    ) or 0
    return {"count": int(total), "total_tokens": int(tokens), "sensibles": int(sensibles)}


def security_stats(db) -> dict:
    """Indicateurs de sécurité IA : refus 24h/7j, alertes par gravité, taux sensibles."""
    from datetime import datetime, timedelta, timezone
    from app.db.models import Alerte, InteractionIA

    now = datetime.now(timezone.utc)

    def _within(d, hours):
        if not d:
            return False
        dd = d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        return now - dd <= timedelta(hours=hours)

    refus_cats = {"acces_refuse", "acces_refuse_repete"}
    alertes = list(db.scalars(select(Alerte).order_by(Alerte.date_creation.desc()).limit(2000)))
    refus_24h = sum(1 for a in alertes if a.categorie in refus_cats and _within(a.date_creation, 24))
    refus_7j = sum(1 for a in alertes if a.categorie in refus_cats and _within(a.date_creation, 24 * 7))
    by_gravite = {g: sum(1 for a in alertes if a.gravite == g) for g in ("high", "mid", "low")}
    injections = sum(1 for a in alertes if a.categorie == "securite")
    escalades = sum(1 for a in alertes if a.categorie == "escalade")
    non_resolues = sum(1 for a in alertes if not a.resolue)

    total = db.scalar(select(func.count(InteractionIA.id_interaction))) or 0
    sensibles = db.scalar(
        select(func.count(InteractionIA.id_interaction)).where(InteractionIA.sensible.is_(True))) or 0
    taux_sensibles = round(100.0 * sensibles / total, 1) if total else 0.0

    return {
        "refus_24h": refus_24h, "refus_7j": refus_7j,
        "alertes_total": len(alertes), "alertes_non_resolues": non_resolues,
        "par_gravite": by_gravite, "injections": injections, "escalades": escalades,
        "interactions": int(total), "sensibles": int(sensibles), "taux_sensibles": taux_sensibles,
    }


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


def create_modele_tache(db, *, libelle, type_parcours, ordre=0, delai_jours=None, code=None, acteur="RH"):
    """Crée un modèle de tâche par défaut (appliqué aux nouveaux parcours)."""
    import uuid

    from app.db.models import ModeleTache
    code = code or ("M_" + uuid.uuid4().hex[:6].upper())
    m = ModeleTache(code_tache=code, libelle=libelle, type_parcours=type_parcours,
                    ordre=ordre or 0, delai_jours=delai_jours, acteur=acteur)
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
    if "acteur" in patch and patch["acteur"] is not None:
        m.acteur = patch["acteur"]
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


def add_tache(db, *, matricule, libelle, type_parcours, date_echeance=None, acteur="RH"):
    """Ajoute une tâche PERSONNALISÉE au parcours d'un employé (crée un modèle CUSTOM dédié)."""
    import uuid

    from app.db.models import ModeleTache, TacheParcours
    code = "CUSTOM_" + uuid.uuid4().hex[:8]
    db.add(ModeleTache(code_tache=code, libelle=libelle, type_parcours=type_parcours, ordre=99, delai_jours=None, acteur=acteur))
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
    t.completed = (new_status == "done")  # garde le booléen synchronisé avec le statut
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


def create_submitted_document(db, *, matricule, document_name, contenu, type_doc=None, cle_minio=None, code_modele=None):
    """Crée un document directement en statut 'pending' (workflow preview -> submit)."""
    from app.db.models import Document
    doc = Document(matricule=matricule, code_modele=code_modele, nom_fichier=document_name,
                   type_doc=type_doc, contenu=contenu, statut="pending", cle_minio=cle_minio)
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


# ───────────── KPIs analytiques (pyramide âges / masse salariale / sites) ─────────────
def age_pyramid(db) -> list[dict]:
    from app.db.models import Employe
    buckets = ["20-25", "26-30", "31-35", "36-40", "41-45", "46-50", "51-55", "56-60", "60+"]
    counts = {b: 0 for b in buckets}
    today = date.today()
    for dn in db.scalars(select(Employe.date_naissance)):
        if not dn:
            continue
        age = (today - dn).days // 365
        if age < 26:
            b = "20-25"
        elif age >= 60:
            b = "60+"
        else:
            lo = ((age - 1) // 5) * 5 + 1
            b = f"{lo}-{lo + 4}"
        counts[b] = counts.get(b, 0) + 1
    return [{"tranche": b, "count": counts[b]} for b in buckets]


def headcount_by_site(db, *, dept=None) -> list[dict]:
    from app.db.models import Employe
    stmt = select(Employe.site, func.count()).group_by(Employe.site)
    if dept is not None:
        stmt = stmt.where(Employe.id_departement == dept)
    rows = db.execute(stmt).all()
    return [{"site": s or "—", "count": int(c)} for s, c in rows]


def salary_mass(db) -> dict:
    """Masse salariale = somme du DERNIER salaire connu par employé (table historique_salaire)."""
    from app.db.models import Employe, HistoriqueSalaire
    latest: dict[str, tuple] = {}
    for m, d, mt, hid in db.execute(select(
            HistoriqueSalaire.matricule, HistoriqueSalaire.date_effet,
            HistoriqueSalaire.montant, HistoriqueSalaire.id_historique)).all():
        # « dernier » = date la plus récente ; à date égale, id_historique le plus grand.
        key = (d, hid)
        if m not in latest or key > latest[m][0]:
            latest[m] = (key, float(mt or 0))
    emp_site = dict(db.execute(select(Employe.matricule, Employe.site)).all())
    by_site: dict[str, float] = {}
    for m, (_, mt) in latest.items():
        s = emp_site.get(m) or "—"
        by_site[s] = by_site.get(s, 0.0) + mt
    total = sum(v[1] for v in latest.values())
    return {"total": round(total, 2),
            "by_site": [{"site": s, "montant": round(v, 2)} for s, v in sorted(by_site.items())]}


# ───────────── Scores de risque & indicateurs RH ─────────────
def list_scores(db, *, niveau=None, type=None, department_id=None):
    from app.db.models import ScoreRisque, Employe
    stmt = select(ScoreRisque)
    if department_id:
        stmt = stmt.join(Employe, Employe.matricule == ScoreRisque.matricule).where(Employe.id_departement == department_id)
    if niveau:
        stmt = stmt.where(ScoreRisque.niveau == niveau)
    if type:
        stmt = stmt.where(ScoreRisque.type == type)
    return list(db.scalars(stmt.order_by(ScoreRisque.valeur.desc())))


def risk_summary(db, top: int = 5, dept=None) -> dict:
    from app.db.models import Employe, ScoreRisque
    rows = list(db.scalars(select(ScoreRisque)))
    if dept is not None:  # manager : restreint aux scores de son équipe
        mats = set(db.scalars(select(Employe.matricule).where(Employe.id_departement == dept)))
        rows = [s for s in rows if s.matricule in mats]
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


# ───────────── Actualités / Annonces ─────────────
def create_annonce(db, *, titre, contenu, auteur, matricules, epingle=False) -> dict:
    """Crée une annonce, l'adresse aux collaborateurs choisis et notifie chacun (cloche)."""
    from app.db.models import Alerte, Annonce, AnnonceDestinataire, Employe
    a = Annonce(titre=titre, contenu=contenu, auteur=auteur, epingle=bool(epingle))
    db.add(a)
    db.flush()
    n = 0
    for mat in dict.fromkeys(matricules):
        emp = db.get(Employe, mat)
        if emp is None:
            continue
        db.add(AnnonceDestinataire(id_annonce=a.id_annonce, matricule=mat, lu=False))
        # Notification individuelle (apparaît dans la cloche du destinataire)
        if emp.id_utilisateur:
            db.add(Alerte(message=f"Annonce : {titre}", categorie="annonce", gravite="low",
                          confidentielle=False, lue=False, resolue=False,
                          id_destinataire=emp.id_utilisateur, matricule=mat))
        n += 1
    db.commit()
    db.refresh(a)
    return {"annonce": a.to_dict(), "destinataires": n}


def list_annonces_authored(db, *, limit=100):
    """Toutes les annonces publiées (vue RH/gestion), de la plus récente à la plus ancienne."""
    from app.db.models import Annonce
    return list(db.scalars(select(Annonce).order_by(Annonce.date_creation.desc()).limit(limit)))


def list_annonces_for(db, matricule, *, limit=100) -> list[dict]:
    """Fil d'actualités d'un collaborateur : annonces reçues + statut de lecture, épinglées en tête."""
    from app.db.models import Annonce, AnnonceDestinataire
    rows = db.execute(
        select(Annonce, AnnonceDestinataire)
        .join(AnnonceDestinataire, AnnonceDestinataire.id_annonce == Annonce.id_annonce)
        .where(AnnonceDestinataire.matricule == matricule)
        .order_by(Annonce.epingle.desc(), Annonce.date_creation.desc())
        .limit(limit)).all()
    out = []
    for a, d in rows:
        item = a.to_dict()
        item["lu"] = bool(d.lu)
        out.append(item)
    return out


def count_unread_annonces(db, matricule) -> int:
    from app.db.models import AnnonceDestinataire
    return db.scalar(select(func.count()).select_from(AnnonceDestinataire).where(
        AnnonceDestinataire.matricule == matricule, AnnonceDestinataire.lu.is_(False))) or 0


def mark_annonce_read(db, *, id_annonce, matricule) -> bool:
    """Marque une annonce comme lue pour ce collaborateur (dans son fil d'actualités)."""
    from app.db.models import AnnonceDestinataire
    d = db.scalar(select(AnnonceDestinataire).where(
        AnnonceDestinataire.id_annonce == id_annonce, AnnonceDestinataire.matricule == matricule))
    if d is None:
        return False
    d.lu = True
    db.commit()
    return True


# ───────────── Conformité / Consentement (RGPD-like) ─────────────
# Finalités révocables par le collaborateur (les autres traitements relèvent de la sécurité
# ou d'une obligation et sont seulement documentés, non révocables).
FINALITES_REVOCABLES = {"analyse_sentiment", "detection_desengagement"}


def get_consentements(db, matricule) -> dict:
    """Consentements du collaborateur par finalité (défaut = accordé tant qu'aucun retrait)."""
    from app.db.models import Consentement
    rows = {c.finalite: c.accorde for c in db.scalars(
        select(Consentement).where(Consentement.matricule == matricule))}
    return {f: rows.get(f, True) for f in FINALITES_REVOCABLES}


def set_consentement(db, *, matricule, finalite, accorde) -> bool:
    from app.db.models import Consentement
    if finalite not in FINALITES_REVOCABLES:
        return False
    c = db.scalar(select(Consentement).where(
        Consentement.matricule == matricule, Consentement.finalite == finalite))
    if c is None:
        c = Consentement(matricule=matricule, finalite=finalite, accorde=bool(accorde))
        db.add(c)
    else:
        c.accorde = bool(accorde)
    db.commit()
    return True


def matricules_refusant(db, finalite) -> set:
    """Matricules ayant RETIRÉ leur consentement pour une finalité (à exclure des traitements)."""
    from app.db.models import Consentement
    return set(db.scalars(select(Consentement.matricule).where(
        Consentement.finalite == finalite, Consentement.accorde.is_(False))))


def export_my_data(db, matricule) -> dict:
    """Export des données personnelles d'un collaborateur (droit d'accès / portabilité)."""
    from app.db.models import (Demande, EvaluationCompetence, Humeur, Objectif)
    emp = get_employee(db, matricule)
    if emp is None:
        return {}
    demandes = db.scalars(select(Demande).where(Demande.matricule == matricule))
    evals = db.scalars(select(EvaluationCompetence).where(EvaluationCompetence.matricule == matricule))
    objs = db.scalars(select(Objectif).where(Objectif.matricule == matricule))
    hums = db.scalars(select(Humeur).where(Humeur.matricule == matricule))
    return {
        "profil": emp.to_dict(),
        "demandes": [d.to_dict() for d in demandes],
        "competences": [e.to_dict() for e in evals],
        "objectifs": [o.to_dict() for o in objs],
        "humeurs": [h.to_dict() for h in hums],
        "consentements": get_consentements(db, matricule),
    }


def list_departements(db):
    """Liste des départements (pour les vues consolidées par entité)."""
    from app.db.models import Departement
    return list(db.scalars(select(Departement).order_by(Departement.nom)))


# ───────────── Paramètres / Règles configurables ─────────────
def get_parametre(db, cle, default=None):
    from app.db.models import Parametre
    import json as _json
    p = db.get(Parametre, cle)
    if p is None or p.valeur is None:
        return default
    try:
        return _json.loads(p.valeur)
    except Exception:
        return default


def set_parametre(db, cle, value):
    from app.db.models import Parametre
    import json as _json
    p = db.get(Parametre, cle)
    if p is None:
        p = Parametre(cle=cle, valeur=_json.dumps(value))
        db.add(p)
    else:
        p.valeur = _json.dumps(value)
    db.commit()
    return value


# ───────────── Solde de congés ─────────────
CONGE_ALLOC_ANNUEL = 25  # jours de congés payés par an (paramétrable ultérieurement)


# ───────────── Tâches personnelles (cockpit : Agenda & mes tâches) ─────────────
def list_taches_perso(db, user_email):
    from app.db.models import TachePerso
    return list(db.scalars(
        select(TachePerso).where(TachePerso.user_email == user_email).order_by(
            TachePerso.fait, TachePerso.date_echeance.is_(None),
            TachePerso.date_echeance, TachePerso.id.desc())))


def create_tache_perso(db, *, user_email, titre, date_echeance=None, priorite="normale"):
    from app.db.models import TachePerso
    t = TachePerso(user_email=user_email, titre=titre, date_echeance=date_echeance,
                   priorite=priorite or "normale")
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def update_tache_perso(db, *, id_tache, user_email, **fields):
    from app.db.models import TachePerso
    t = db.get(TachePerso, id_tache)
    if t is None or t.user_email != user_email:
        return None
    for k, v in fields.items():
        if v is not None and hasattr(t, k):
            setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t


def delete_tache_perso(db, *, id_tache, user_email) -> bool:
    from app.db.models import TachePerso
    t = db.get(TachePerso, id_tache)
    if t is None or t.user_email != user_email:
        return False
    db.delete(t)
    db.commit()
    return True


def leave_balance(db, matricule) -> dict:
    """Solde de congés de l'année en cours : alloué - jours de CONGÉ validés."""
    from datetime import date as _date
    from app.db.models import Demande
    annee = _date.today().year
    used = 0
    rows = db.scalars(select(Demande).where(
        Demande.matricule == matricule, Demande.code_type == "CONGE",
        Demande.statut == "validated"))
    for d in rows:
        deb, fin = d.date_debut, d.date_fin
        if deb and fin and fin >= deb and deb.year == annee:
            used += (fin - deb).days + 1
    return {"annee": annee, "alloue": CONGE_ALLOC_ANNUEL, "pris": used,
            "restant": max(0, CONGE_ALLOC_ANNUEL - used)}
