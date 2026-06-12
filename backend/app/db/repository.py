"""Dépôt : accès aux données via l'ORM (MLD v1.0).

Fait le pont entre le contrat plat du front et le modèle Merise :
- « employees » -> employe (+ utilisateur pour email/rôle)
- « absences »  -> demande filtrée sur les types d'absence
Renvoie des objets ORM ; la sérialisation passe par leur .to_dict().
"""

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Demande, Departement, Employe, Utilisateur
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
    emp = db.get(Employe, matricule)
    if emp is None:
        return False
    db.delete(emp)
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
def log_ia_interaction(db, *, user_email, prompt, reponse, tokens, model, sensible=False):
    from app.db.models import InteractionIA
    u = db.scalar(select(Utilisateur).where(Utilisateur.email == user_email))
    if u is None:
        return None  # pas de compte rattaché -> pas de log (FK obligatoire)
    it = InteractionIA(
        prompt=prompt, reponse=reponse, tokens_used=tokens, model_name=model,
        statut="ok", sensible=sensible, id_utilisateur=u.id_utilisateur,
    )
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


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
    stmt = select(ModeleTache)
    if type_parcours:
        stmt = stmt.where(ModeleTache.type_parcours == type_parcours)
    return list(db.scalars(stmt.order_by(ModeleTache.ordre)))


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
def list_modele_document(db):
    from app.db.models import ModeleDocument
    return list(db.scalars(select(ModeleDocument)))


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


def create_document(db, *, matricule, code_modele=None, nom_fichier=None):
    """« Génère » un document : crée l'enregistrement en statut pending.
    La génération de fichier réelle + upload MinIO se branchera ici (cle_minio)."""
    from app.db.models import Document, ModeleDocument
    if nom_fichier is None:
        libelle = None
        if code_modele:
            m = db.get(ModeleDocument, code_modele)
            libelle = m.libelle if m else code_modele
        nom_fichier = f"{(libelle or 'document').replace(' ', '_').lower()}_{matricule}.pdf"
    doc = Document(matricule=matricule, code_modele=code_modele,
                   nom_fichier=nom_fichier, statut="pending",
                   cle_minio=f"documents/{matricule}/{nom_fichier}")
    db.add(doc)
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
