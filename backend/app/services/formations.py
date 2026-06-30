"""Catalogue de formations internes + moteur de recommandation par poste.

Le catalogue par défaut s'auto-injecte si la table est vide (idempotent). La
recommandation matche les mots-clés du poste avec ceux des formations, complétée
par un tronc commun proposé à tous les nouveaux arrivants.
"""

# Catalogue par défaut (code, titre, categorie, mots_cles, duree_jours, niveau, description).
DEFAULT_CATALOGUE = [
    ("ONB-ACCUEIL", "Parcours d'accueil & culture d'entreprise", "transverse",
     "tous,onboarding,accueil", 1, "débutant",
     "Présentation de l'entreprise, des valeurs, de l'organisation et des outils internes."),
    ("ONB-OUTILS", "Outils internes & poste de travail", "transverse",
     "tous,onboarding,outils", 1, "débutant",
     "Prise en main de la messagerie, du SIRH, des espaces collaboratifs et de la sécurité."),
    ("SEC-RGPD", "Sensibilisation RGPD & protection des données", "transverse",
     "tous,securite,donnees,rgpd", 1, "débutant",
     "Bonnes pratiques de confidentialité et traitement des données personnelles."),
    ("DEV-CLEAN", "Qualité de code & bonnes pratiques", "technique",
     "développeur,ingénieur,analyste,tech", 3, "intermédiaire",
     "Tests, revue de code, CI/CD et standards de développement."),
    ("DATA-ANALYSE", "Analyse de données & reporting", "technique",
     "analyste,data,designer,consultant", 2, "intermédiaire",
     "Exploration, visualisation et restitution de données pour la décision."),
    ("COM-VENTE", "Techniques de vente & relation client", "métier",
     "commercial,vente,consultant,support client", 2, "intermédiaire",
     "Découverte client, argumentation, négociation et suivi du portefeuille."),
    ("MAN-EQUIPE", "Management d'équipe & posture managériale", "management",
     "manager,chef de projet,directeur,directrice,chef", 3, "avancé",
     "Animation d'équipe, délégation, feedback et conduite des entretiens."),
    ("RH-DROIT", "Fondamentaux du droit social", "métier",
     "chargé rh,rh,comptable", 2, "intermédiaire",
     "Contrats, congés, absences et obligations légales côté RH."),
    ("PROJ-AGILE", "Gestion de projet agile", "transverse",
     "chef de projet,développeur,ingénieur,consultant", 2, "intermédiaire",
     "Cadres agiles (Scrum/Kanban), planification et pilotage de projet."),
    ("SOFT-COMM", "Communication & collaboration", "transverse",
     "tous,soft skills", 1, "débutant",
     "Communication écrite/orale, collaboration transverse et gestion du temps."),
]

_COMMON = {"ONB-ACCUEIL", "ONB-OUTILS", "SEC-RGPD"}  # tronc commun nouvel arrivant
_seeded = False


def ensure_seeded(db) -> None:
    """Injecte le catalogue par défaut si la table est vide (idempotent)."""
    global _seeded
    from app.db.models import Formation
    if _seeded:
        return
    if db.query(Formation).count() == 0:
        db.add_all([Formation(code=c, titre=t, categorie=cat, mots_cles=mk,
                              duree_jours=d, niveau=n, description=desc, actif=True)
                    for c, t, cat, mk, d, n, desc in DEFAULT_CATALOGUE])
        db.commit()
    _seeded = True


def list_catalogue(db, only_active=True):
    from app.db.models import Formation
    ensure_seeded(db)
    rows = db.query(Formation)
    if only_active:
        rows = rows.filter(Formation.actif.is_(True))
    return list(rows.all())


def _matches(tag: str, poste_tokens: list[str]) -> bool:
    """Matching robuste aux variantes genre/pluriel : comparaison par préfixe (≥5 car.).
    Ex. « développeur » ↔ « développeuse » (préfixe « développe »)."""
    for w in poste_tokens:
        if len(w) >= 4 and (tag.startswith(w[:5]) or w.startswith(tag[:5]) or tag in w or w in tag):
            return True
    return False


def recommend_for(db, poste: str | None, limit: int = 6) -> list[dict]:
    """Recommande des formations pour un poste : tronc commun + matching par mots-clés."""
    ensure_seeded(db)
    poste_l = (poste or "").lower()
    poste_tokens = [t for t in poste_l.replace("'", " ").split() if len(t) >= 3]
    scored = []
    for f in list_catalogue(db):
        tags = [m.strip().lower() for m in (f.mots_cles or "").split(",") if m.strip()]
        score = 0
        if f.code in _COMMON:
            score += 1  # tronc commun toujours pertinent
        if "tous" in tags:
            score += 1
        for tag in tags:
            if tag and tag != "tous" and _matches(tag, poste_tokens):
                score += 3  # correspondance directe avec l'intitulé du poste
        if score > 0:
            d = f.to_dict()
            d["score"] = score
            d["raison"] = ("Tronc commun nouvel arrivant" if f.code in _COMMON
                           else "Pertinent pour le poste" if score >= 3 else "Recommandé pour tous")
            scored.append(d)
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]
