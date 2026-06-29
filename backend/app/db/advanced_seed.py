"""Seed avancé DÉTERMINISTE pour la démo + le Machine Learning (OPT-IN, destructif).

Génère un effectif RÉALISTE et STABLE : ~120 collaborateurs organisés en départements et
équipes de taille logique (un manager encadre ~10-13 personnes), avec une hiérarchie
(matricule_manager, chef de département), 3-5 ans d'historiques corrélés (salaires en MAD,
entretiens, enquêtes d'engagement, absences, feedbacks), objectifs (OKR) et humeurs — pour
que les écrans, la recherche, l'assistant et les modèles Random Forest aient des données
crédibles.

⚠️ IMPORTANT — déterminisme : un SEED fixe garantit que les IDENTITÉS (noms, e-mails) sont
IDENTIQUES à chaque exécution. Les noms ne « bougent » plus d'un run à l'autre (fini les
recherches/assistant qui cassent). Les comptes de démo (@waminey.ma) sont EMBARQUÉS ici avec
des identités fixes — ne PAS lancer seed_moroccan_names (qui réécrivait les noms).

⚠️ DESTRUCTIF : vide les tables RH avant de régénérer. Ne s'exécute qu'avec --confirm :

    docker compose exec backend python -m app.db.advanced_seed --confirm
"""

import random
import sys
from datetime import date, timedelta

from sqlalchemy import delete, select

from app.db.base import SessionLocal
from app.db.models import (
    Alerte, Annonce, AnnonceDestinataire, Bilan, ChatMessage, ChatSession, Consentement,
    ConversationIA, Demande, Departement, Document, DossierConfidentiel, Employe,
    EnqueteEngagement, EntretienAnnuel, EvaluationCompetence, Feedback, HistoriqueSalaire,
    Humeur, IndicateurRH, InteractionIA, JournalAudit, KeyResult, ModeleDocument,
    ModeleTache, Objectif, Role, ScoreRisque, SourceIA, TacheParcours, Utilisateur,
)
from app.db.seed_demo_accounts import ACCOUNTS as _DEMO_ACCOUNTS
from app.db.seed_moroccan_names import NOMS, PRENOMS_F, PRENOMS_M, slugify

SEED = 42  # graine fixe -> identités stables d'un run à l'autre
TODAY = date(2026, 6, 1)
SITES = ["Casablanca", "Rabat", "Marrakech", "Tanger"]
CONTRATS = ["CDI", "CDD", "Alternance"]

# Salaire annuel brut RÉALISTE au Maroc (MAD) : (palier d'entrée, palier sénior) par poste.
SALAIRE = {
    "Développeur": (110000, 260000), "Ingénieur": (130000, 300000),
    "Analyste": (110000, 240000), "Designer": (100000, 220000),
    "Commercial": (100000, 250000), "Consultant": (130000, 300000),
    "Support client": (80000, 150000), "Comptable": (110000, 220000),
    "Chargé RH": (110000, 230000), "Chef de projet": (180000, 360000),
    "Manager": (300000, 480000), "Médecin du travail": (360000, 560000),
    "Directeur": (600000, 950000), "Directrice générale": (1000000, 1500000),
    "Administrateur plateforme": (280000, 440000),
}

# Structure : (département, équipe, manager_pin, rôle_mgr, poste_mgr, n_membres, poste_membre, [membres_pin])
# manager_pin / membres_pin = matricules de comptes démo à placer ; None/[] => généré.
TEAMS = [
    ("Direction", "Comité de direction", "DEMO_DIR", "DIRECTION", "Directrice générale", 3, "Directeur", []),
    ("Systèmes d'information", "Plateforme & Données", "DEMO_ADMIN", "ADMIN", "Administrateur plateforme", 13, "Ingénieur", []),
    ("Systèmes d'information", "Produit & Développement", "DEMO_MGR", "MANAGER", "Manager", 13, "Développeur", ["DEMO_COL", "DEMO_NEW", "DEMO_OUT"]),
    ("Systèmes d'information", "Design & Expérience", None, "MANAGER", "Manager", 12, "Designer", []),
    ("Opérations", "Support & Exploitation", None, "MANAGER", "Manager", 13, "Support client", []),
    ("Opérations", "Logistique & Données", None, "MANAGER", "Manager", 12, "Analyste", []),
    ("Ventes", "Grands comptes", None, "MANAGER", "Manager", 13, "Commercial", []),
    ("Ventes", "PME & Indirect", None, "MANAGER", "Manager", 12, "Commercial", []),
    ("Ressources Humaines", "Pôle RH", "DEMO_RH", "RH", "Manager", 12, "Chargé RH", []),
    ("Santé au travail", "Service de santé au travail", "DEMO_MED", "MEDECINE", "Analyste", 7, "Analyste", []),
]

# Identités fixes des comptes démo (depuis la source unique seed_demo_accounts).
DEMO = {a[0]: {"email": a[1], "prenom": a[2], "nom": a[3], "role": a[4], "statut": a[5]} for a in _DEMO_ACCOUNTS}


def _iso_week(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def _wipe(db):
    """Supprime les données RH (enfants -> parents). Conserve roles/types/modèles/départements."""
    for model in (SourceIA, InteractionIA, ChatMessage, ChatSession, ConversationIA,
                  Document, TacheParcours, HistoriqueSalaire, EnqueteEngagement,
                  EntretienAnnuel, Feedback, ScoreRisque, EvaluationCompetence, KeyResult,
                  Objectif, Bilan, Humeur, DossierConfidentiel, Demande, AnnonceDestinataire,
                  Annonce, Consentement, Alerte, JournalAudit):
        db.execute(delete(model))
    db.execute(Departement.__table__.update().values(matricule_chef=None))
    db.execute(delete(Employe))
    db.execute(delete(Utilisateur))
    db.commit()


def _ensure_referentiels(db):
    if db.query(Role).count() == 0:
        db.add_all([Role(code_role=c, libelle=c.title()) for c in
                    ["ADMIN", "DIRECTION", "RH", "MANAGER", "MEDECINE", "COLLABORATEUR"]])
    if db.query(ModeleDocument).count() == 0:
        db.add(ModeleDocument(code_modele="ATTEST_TRAVAIL", libelle="Attestation de travail"))
    from app.db.models import TypeDemande
    for code, lib in [("CONGE", "Congé payé"), ("MALADIE", "Arrêt maladie"),
                      ("TELETRAVAIL", "Télétravail"), ("RTT", "RTT"),
                      ("ABSENCE", "Absence Injustifiée"), ("ATTESTATION", "Attestation de travail")]:
        if db.get(TypeDemande, code) is None:
            db.add(TypeDemande(code_type=code, libelle=lib))
    db.flush()
    depts = {d.nom: d for d in db.query(Departement).all()}
    for nom in ["Systèmes d'information", "Opérations", "Ressources Humaines",
                "Ventes", "Direction", "Santé au travail"]:
        if nom not in depts:
            d = Departement(nom=nom)
            db.add(d)
            db.flush()
            depts[nom] = d
    return depts


# ───────────────────────── Génération ─────────────────────────
def _new_identity(genre, used_emails):
    """Identité marocaine UNIQUE (déterministe car random est seedé)."""
    pool = PRENOMS_M if genre == "M" else PRENOMS_F
    for _ in range(200):
        prenom, nom = random.choice(pool), random.choice(NOMS)
        base = f"{slugify(prenom)}.{slugify(nom)}"
        email, k = f"{base}@waminey.ma", 1
        while email in used_emails:
            k += 1
            email = f"{base}{k}@waminey.ma"
        if k <= 3:  # privilégie les e-mails « propres »
            used_emails.add(email)
            return prenom, nom, email
    used_emails.add(email)
    return prenom, nom, email


def _salaire_cible(poste, anciennete):
    lo, hi = SALAIRE.get(poste, (95000, 200000))
    frac = min(max(anciennete, 0) / 15.0, 1.0)
    base = lo + (hi - lo) * frac
    return int(round(base * random.uniform(0.95, 1.06) / 1000) * 1000)


def _profile_for(matricule):
    if matricule in DEMO:  # comptes démo : profils variés mais fixes
        return {"DEMO_OUT": "turnover", "DEMO_NEW": "stable"}.get(matricule, "stable")
    return random.choices(["stable", "desengage", "turnover"], weights=[70, 20, 10])[0]


def _make_employee(db, matricule, *, prenom, nom, email, genre, role, poste, statut,
                   dept_id, manager_mat, used_emails, histories):
    u = Utilisateur(email=email, keycloak_sub=f"kc-{matricule}", actif=True, code_role=role)
    db.add(u)
    db.flush()
    profile = _profile_for(matricule)
    # Ancienneté déterministe.
    emb_year = random.choices(range(2016, 2026), weights=[1, 1, 2, 2, 3, 3, 4, 4, 5, 4])[0]
    if statut == "NEW":
        emb_year = 2026
    date_embauche = date(emb_year, random.randint(1, 12), random.randint(1, 28)) if emb_year < 2026 \
        else date(2026, random.randint(1, 5), random.randint(1, 28))
    age = random.randint(24, 60)
    date_naissance = date(TODAY.year - age, random.randint(1, 12), random.randint(1, 28))
    emp = Employe(
        matricule=matricule, nom=nom, prenom=prenom, poste=poste, statut=statut,
        date_embauche=date_embauche, date_naissance=date_naissance,
        site=random.choices(SITES, weights=[45, 22, 18, 15])[0],
        type_contrat=random.choices(CONTRATS, weights=[82, 11, 7])[0],
        genre=genre, id_departement=dept_id, id_utilisateur=u.id_utilisateur,
        matricule_manager=manager_mat,
    )
    db.add(emp)

    # ── Salaire (MAD) : embauche + augmentations annuelles vers la cible ──
    anc = TODAY.year - date_embauche.year
    cible = _salaire_cible(poste, anc)
    sal = max(SALAIRE.get(poste, (95000, 200000))[0], int(cible / (1.03 ** max(anc, 1))))
    histories.append(HistoriqueSalaire(matricule=matricule, montant=sal, date_effet=date_embauche, motif="Embauche"))
    for y in range(date_embauche.year + 1, TODAY.year + 1):
        reste = TODAY.year - y + 1
        step = (cible - sal) / max(1, reste)
        proba = 0.85 if profile == "stable" else 0.4
        if step > 0 and random.random() < proba:
            sal = int(round((sal + step) / 100) * 100)
            motif = "Promotion" if (profile == "stable" and random.random() < 0.25) else "Augmentation"
            histories.append(HistoriqueSalaire(matricule=matricule, montant=sal, date_effet=date(y, 2, 1), motif=motif))

    # ── Historiques annuels (entretien, enquêtes, absences) ──
    for y in range(date_embauche.year + 1, TODAY.year + 1):
        note = 5 if (profile == "stable" and random.random() < 0.5) else (4 if profile == "stable" else random.choice([2, 3]))
        histories.append(EntretienAnnuel(matricule=matricule, date_entretien=date(y, 11, 15), note_performance_1_5=note))
        for q in range(4):
            month = q * 3 + 2
            if profile == "stable":
                b = random.randint(7, 9)
                sat, eq, ch, rec = b, random.randint(6, 9), random.randint(4, 7), b
            else:
                recent = (y == TODAY.year)
                lo, hi = (3, 5) if recent else (4, 7)
                sat, eq, ch, rec = random.randint(lo, hi), random.randint(3, 6), random.randint(6, 9), random.randint(lo, hi)
            histories.append(EnqueteEngagement(matricule=matricule, date_enquete=date(y, month, 10),
                                               satisfaction_globale=sat, equilibre_pro_perso=eq,
                                               charge_travail=ch, reconnaissance=rec))
        for _ in range(random.randint(0, 1) if profile == "stable" else random.randint(3, 5)):
            d0 = date(y, random.randint(1, 12), random.randint(1, 28))
            histories.append(Demande(matricule=matricule, code_type="MALADIE", date_debut=d0,
                                     date_fin=d0 + timedelta(days=random.randint(1, 3)), statut="validated"))
        if profile == "desengage":
            for _ in range(random.randint(1, 3)):
                d0 = date(y, random.randint(1, 12), random.randint(1, 28))
                histories.append(Demande(matricule=matricule, code_type="ABSENCE", date_debut=d0, date_fin=d0, statut="validated"))
        if random.random() < 0.5:
            d0 = date(y, random.randint(1, 12), random.randint(1, 28))
            histories.append(Demande(matricule=matricule, code_type="TELETRAVAIL", date_debut=d0, date_fin=d0, statut="validated"))

    # ── Feedbacks récents (signal ML) ──
    for _ in range(random.randint(1, 3)):
        if profile == "stable":
            n, cat = random.choice([4, 4, 5, 5]), random.choice(["performance", "ambiance", "collaboration"])
        else:
            n, cat = random.choice([1, 2, 2, 3]), random.choice(["charge", "performance", "engagement"])
        d0 = TODAY - timedelta(days=random.randint(15, 350))
        histories.append(Feedback(matricule=matricule, date_feedback=d0, note_1_5=n, categorie=cat, auteur="manager"))

    # ── Objectifs (OKR) : Q1 clos + Q2 actif ──
    titres = {"projet": ["Livrer la refonte du module", "Migrer le service vers le cloud",
                         "Augmenter le taux de conversion", "Automatiser le reporting", "Réduire le délai de traitement"],
              "developpement": ["Monter en compétence sur l'architecture", "Certification professionnelle",
                                "Améliorer la communication client", "Maîtriser l'analyse de données"]}
    for periode, statut_o in [("2026-Q1", "clos"), ("2026-Q2", "actif")]:
        for typ in ("projet", "developpement"):
            if random.random() < 0.75:
                histories.append(Objectif(matricule=matricule, periode=periode, type_obj=typ,
                                          titre=random.choice(titres[typ]), statut=statut_o))

    # ── Humeur (climat) : quelques semaines récentes pour ~60% des actifs ──
    if statut == "ACTIVE" and random.random() < 0.6:
        for w in range(random.randint(2, 6)):
            d0 = TODAY - timedelta(weeks=w)
            niv = 3 if profile == "stable" else random.choice([1, 2, 2])
            histories.append(Humeur(matricule=matricule, semaine=_iso_week(d0), niveau=niv,
                                    anonyme=True, date_saisie=d0))

    return emp


def _generate(db, depts):
    used_emails = set()
    histories = []
    chefs = {}  # id_departement -> matricule du chef (appliqué après commit, évite un FK transitoire)
    next_emp = [1000]  # compteur de matricules auto (EMP1000..)
    dg_mat = "DEMO_DIR"

    def auto_mat():
        m = f"EMP{next_emp[0]}"
        next_emp[0] += 1
        return m

    n = 0
    for dept_nom, equipe, mgr_pin, role_mgr, poste_mgr, n_mem, poste_mem, mem_pins in TEAMS:
        dept = depts[dept_nom]
        # ── Manager / chef d'équipe ──
        if mgr_pin and mgr_pin in DEMO:
            d = DEMO[mgr_pin]
            mgr_mat = mgr_pin
            used_emails.add(d["email"])
            _make_employee(db, mgr_mat, prenom=d["prenom"], nom=d["nom"], email=d["email"],
                           genre=random.choice(["M", "F"]), role=d["role"], poste=poste_mgr,
                           statut="ACTIVE", dept_id=dept.id_departement,
                           manager_mat=(None if mgr_mat == dg_mat else dg_mat),
                           used_emails=used_emails, histories=histories)
        else:
            genre = random.choice(["M", "F"])
            prenom, nom, email = _new_identity(genre, used_emails)
            mgr_mat = auto_mat()
            _make_employee(db, mgr_mat, prenom=prenom, nom=nom, email=email, genre=genre,
                           role=role_mgr, poste=poste_mgr, statut="ACTIVE",
                           dept_id=dept.id_departement, manager_mat=dg_mat,
                           used_emails=used_emails, histories=histories)
        n += 1
        # Chef de département = premier manager rencontré (appliqué après le commit des employés).
        chefs.setdefault(dept.id_departement, mgr_mat)

        # ── Membres (pins démo d'abord, puis générés) ──
        for j in range(n_mem):
            pin = mem_pins[j] if j < len(mem_pins) else None
            if pin and pin in DEMO:
                d = DEMO[pin]
                used_emails.add(d["email"])
                _make_employee(db, pin, prenom=d["prenom"], nom=d["nom"], email=d["email"],
                               genre=random.choice(["M", "F"]), role=d["role"], poste=poste_mem,
                               statut=d["statut"], dept_id=dept.id_departement, manager_mat=mgr_mat,
                               used_emails=used_emails, histories=histories)
            else:
                genre = random.choices(["M", "F", "Autre"], weights=[48, 48, 4])[0]
                gg = genre if genre in ("M", "F") else random.choice(["M", "F"])
                prenom, nom, email = _new_identity(gg, used_emails)
                profile = random.choices(["stable", "desengage", "turnover"], weights=[70, 20, 10])[0]
                statut = "LEAVING" if profile == "turnover" else "ACTIVE"
                _make_employee(db, auto_mat(), prenom=prenom, nom=nom, email=email, genre=genre,
                               role="COLLABORATEUR", poste=poste_mem, statut=statut,
                               dept_id=dept.id_departement, manager_mat=mgr_mat,
                               used_emails=used_emails, histories=histories)
            n += 1

    db.flush()
    db.bulk_save_objects(histories)
    db.commit()

    # Chefs de département (après persistance des employés -> pas de FK transitoire).
    for id_dept, mat in chefs.items():
        db.execute(Departement.__table__.update()
                   .where(Departement.id_departement == id_dept).values(matricule_chef=mat))
    db.commit()

    # ── Dossiers confidentiels + contrat (chiffrés) pour l'équipe démo : alimente E5 ──
    from app.services import crypto
    villes = {"Casablanca": "Bd Zerktouni", "Rabat": "Av. Hassan II", "Marrakech": "Av. Mohammed V", "Tanger": "Bd Pasteur"}
    for mat in ("DEMO_COL", "DEMO_NEW", "DEMO_OUT", "DEMO_MGR", "DEMO_RH"):
        e = db.get(Employe, mat)
        if not e:
            continue
        rue = villes.get(e.site, "Av. Mohammed V")
        db.add(DossierConfidentiel(matricule=mat, cin=crypto.encrypt(f"BK{random.randint(100000, 999999)}"),
                                   adresse=crypto.encrypt(f"{random.randint(2, 80)} {rue}, {e.site}")))
        db.add(Document(matricule=mat, nom_fichier=f"contrat_{mat}.txt", type_doc="CONTRAT", statut="validated",
                        contenu=(f"CONTRAT DE TRAVAIL — {e.prenom} {e.nom}. Poste : {e.poste}. "
                                 f"Type : {e.type_contrat}. Site : {e.site}. Entreprise : Waminey Tech (Synapse Digital).")))
        # Bulletins de paie (3 derniers mois) — alimentent l'écran « Ma paie » self-service.
        from app.db.models import HistoriqueSalaire as _HS
        last = db.scalars(select(_HS).where(_HS.matricule == mat)
                          .order_by(_HS.date_effet.desc(), _HS.id_historique.desc()).limit(1)).first()
        mensuel = round(float(last.montant) / 12) if last else 0
        y, m = TODAY.year, TODAY.month
        for _k in range(3):
            db.add(Document(matricule=mat, nom_fichier=f"bulletin_{y}_{m:02d}.txt",
                            type_doc="FICHE_PAIE", statut="validated",
                            contenu=(f"BULLETIN DE PAIE — {e.prenom} {e.nom} ({mat})\n"
                                     f"Période : {m:02d}/{y}\nPoste : {e.poste}\n"
                                     f"Salaire brut mensuel : {mensuel} MAD\n"
                                     f"Employeur : Waminey Tech (Synapse Digital).")))
            m -= 1
            if m == 0:
                m, y = 12, y - 1
    db.commit()
    return n, len(histories)


def run():
    random.seed(SEED)  # ← déterminisme : mêmes identités à chaque exécution
    db = SessionLocal()
    try:
        _wipe(db)
        depts = _ensure_referentiels(db)
        db.commit()
        n_emp, n_hist = _generate(db, depts)
        # Compétences (catalogue + métiers + évaluations) — déterministe lui aussi.
        from app.db.seed_competences import run as seed_competences
        seed_competences()
        print(f"OK : {n_emp} employés déterministes (seed={SEED}) répartis en {len(TEAMS)} équipes, "
              f"{n_hist} lignes d'historique + compétences. Comptes démo @waminey.ma embarqués.")
    finally:
        db.close()


if __name__ == "__main__":
    if "--confirm" not in sys.argv:
        print("DESTRUCTIF. Relancez avec --confirm pour vider et régénérer la base :")
        print("  python -m app.db.advanced_seed --confirm")
        sys.exit(1)
    run()
