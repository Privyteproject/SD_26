"""RAG documentaire — embeddings + vector store + filtrage par permissions.

Remplace l'ancienne similarité lexicale par de vrais embeddings (couche
`embeddings`) indexés dans un vector store (couche `vectorstore`,
ChromaDB ou mémoire). L'interface publique NE CHANGE PAS : `retrieve(query, role, k)`.

Filtrage d'accès : chaque chunk porte une `audience` (rôles autorisés ou ALL) ;
on récupère large puis on filtre par rôle -> « documents RH autorisés uniquement ».
"""

import threading

from app.core.config import settings
from app.services.embeddings import get_embedder
from app.services.vectorstore import get_store

ALL = "ALL"
_lock = threading.Lock()
_seeded = False

# Corpus RH de démonstration (politiques internes). audience = rôles autorisés.
KNOWLEDGE: list[dict] = [
    {"id": "pol-conges", "title": "Politique de congés payés", "audience": [ALL],
     "text": "Les congés payés s'acquièrent à raison de 1,5 jour par mois. La demande se fait "
             "via le module Demandes, validée par le manager puis les RH. Préavis recommandé de "
             "15 jours. Le solde est consultable dans l'espace personnel."},
    {"id": "pol-teletravail", "title": "Charte télétravail", "audience": [ALL],
     "text": "Le télétravail est possible jusqu'à 2 jours par semaine après accord du manager. "
             "La demande passe par le module Demandes (type Télétravail)."},
    {"id": "pol-onboarding", "title": "Procédure d'onboarding",
     "audience": ["RH", "MANAGER", "DIRECTION", "ADMIN"],
     "text": "L'onboarding comprend la signature du contrat, la configuration des accès et la "
             "remise du matériel. Les tâches sont suivies dans le module Parcours."},
    {"id": "pol-offboarding", "title": "Procédure d'offboarding",
     "audience": ["RH", "MANAGER", "DIRECTION", "ADMIN"],
     "text": "L'offboarding inclut la restitution du matériel, la clôture des accès et le solde "
             "de tout compte. Suivi dans le module Parcours (type OFFBOARDING)."},
    {"id": "pol-attestation", "title": "Attestation de travail", "audience": [ALL],
     "text": "Une attestation de travail peut être générée depuis le module Documents. Elle est "
             "validée par les RH avant mise à disposition."},
    {"id": "pol-remuneration", "title": "Rémunération et bulletins",
     "audience": ["RH", "DIRECTION", "ADMIN"],
     "text": "Les bulletins de paie sont édités mensuellement. Les questions de rémunération "
             "individuelle relèvent des RH et restent confidentielles."},
    {"id": "pol-rtt", "title": "RTT", "audience": [ALL],
     "text": "Les RTT compensent les heures au-delà de 35h/semaine. Ils se posent via le module "
             "Demandes (type RTT) avec validation du manager. Ils doivent être soldés avant la fin "
             "de la période de référence."},
    {"id": "pol-maladie", "title": "Arrêt maladie", "audience": [ALL],
     "text": "En cas d'arrêt maladie, transmettre le justificatif sous 48h aux RH. La demande est "
             "enregistrée via le module Demandes (type MALADIE). Le maintien de salaire suit la "
             "convention collective."},
    {"id": "pol-mobilite", "title": "Mobilité interne", "audience": [ALL],
     "text": "La mobilité interne (changement de poste ou de département) est encouragée. Les postes "
             "ouverts sont publiés en interne. Candidater auprès des RH ; un entretien et l'accord "
             "du manager actuel sont requis."},
    {"id": "pol-essai", "title": "Période d'essai", "audience": [ALL],
     "text": "La période d'essai d'un CDI est généralement de 2 à 4 mois selon le statut, "
             "renouvelable une fois. Elle permet à chaque partie d'évaluer l'adéquation au poste."},
    {"id": "pol-frais", "title": "Note de frais", "audience": [ALL],
     "text": "Les frais professionnels (déplacements, repas) sont remboursés sur justificatif via "
             "le module Documents (Note de frais), après validation RH."},
    {"id": "pol-formation", "title": "Formation professionnelle", "audience": [ALL],
     "text": "Le plan de développement des compétences propose des formations. Les demandes se font "
             "auprès du manager et des RH, qui priorisent selon les besoins métier et l'évolution."},
    {"id": "pol-entretien", "title": "Entretien annuel", "audience": [ALL],
     "text": "Chaque collaborateur bénéficie d'un entretien annuel d'évaluation : bilan de l'année, "
             "objectifs, besoins de formation et perspectives d'évolution."},
    {"id": "pol-code-conduite", "title": "Code de conduite et Éthique", "audience": [ALL],
     "text": "Notre entreprise s'engage à respecter les plus hauts standards d'éthique, d'intégrité et de respect. "
             "Tout comportement discriminatoire, harcèlement ou corruption est strictement interdit. Les employés "
             "doivent déclarer tout conflit d'intérêts potentiel. Pour toute question, contactez le référent éthique."},
    {"id": "pol-manuel", "title": "Manuel de l'employé", "audience": [ALL],
     "text": "Le manuel de l'employé regroupe les règles de vie au bureau : horaires (plages fixes 10h-16h), "
             "utilisation des salles de réunion, règles de courtoisie en open space, et accès aux locaux. "
             "Le port du badge est obligatoire en tout temps."},
    {"id": "pol-procedures", "title": "Procédures internes et achats", "audience": ["MANAGER", "RH", "DIRECTION", "ADMIN"],
     "text": "Toute dépense supérieure à 500€ doit faire l'objet d'un bon de commande validé par le N+1. "
             "Les achats IT doivent être pré-approuvés par le service informatique. La délégation de signature "
             "est définie dans la grille d'autorité financière disponible sur l'intranet."},
    {"id": "pol-securite-it", "title": "Sécurité informatique (IT)", "audience": [ALL],
     "text": "La politique de sécurité IT impose des mots de passe robustes (12 caractères, multi-facteurs). "
             "L'utilisation d'une clé USB personnelle est interdite. Le VPN de l'entreprise est obligatoire "
             "lors du travail à distance. Tout email suspect doit être signalé au support IT (Phishing)."},
    {"id": "pol-harcelement", "title": "Politique anti-harcèlement", "audience": [ALL],
     "text": "Le harcèlement moral ou sexuel n'a pas sa place chez nous. Tout collaborateur victime ou "
             "témoin doit alerter immédiatement les RH ou la ligne d'écoute anonyme externe au 0800-XXX-XXX. "
             "Des mesures conservatoires seront prises sans délai."},
    {"id": "pol-avantages", "title": "Avantages sociaux (Mutuelle, CSE)", "audience": [ALL],
     "text": "La mutuelle d'entreprise (couverture familiale en option) est prise en charge à 70% par l'employeur. "
             "Le CSE propose des chèques vacances, des réductions billetterie, et subventionne les abonnements "
             "sportifs à hauteur de 200€ par an."},
    {"id": "pol-diversite", "title": "Politique d'Inclusion et Diversité", "audience": [ALL],
     "text": "L'entreprise promeut l'égalité des chances à l'embauche et au quotidien. Nous visons la parité "
             "hommes-femmes et soutenons l'emploi des personnes en situation de handicap via des aménagements "
             "spécifiques de poste."},
    {"id": "comp-presentation", "title": "Présentation de l'entreprise Waminey Tech", "audience": [ALL],
     "text": "Waminey Tech est une startup d'ingénierie marocaine fondée en 2025 à Casablanca par une équipe "
             "d'étudiants et jeunes diplômés passionnés par l'IA et la transformation digitale. "
             "Notre mission : concevoir et déployer des solutions numériques accessibles, modernes et utiles, "
             "en plaçant l'innovation, la sécurité, l'inclusion et la proximité au cœur de chaque projet. "
             "Synapse Digital est notre produit phare. L'équipe réunit des compétences en développement web/mobile, "
             "UX design, data, gestion de projet et stratégie digitale. Nous croyons en la capacité de la jeunesse "
             "marocaine à inventer des solutions audacieuses, responsables et adaptées à la réalité du pays pour "
             "faire de chaque projet un levier d'impact positif pour la société et l'économie locale. "
             "Notre vision : 'Simplifier la vie au travail grâce à la technologie, tout en valorisant les entreprises.' "
             "Notre slogan : 'Vos talents, notre intelligence.'"}
]


def _audience_csv(aud: list[str]) -> str:
    return ",".join(aud)


def _allowed(meta: dict, role: str) -> bool:
    aud = (meta.get("audience") or ALL).split(",")
    return ALL in aud or role in aud


def ingest(chunks: list[dict]) -> int:
    """Indexe des chunks {id?, title, text, audience?} dans le vector store."""
    store, embedder = get_store(), get_embedder()
    vectors = embedder.embed([f"{c.get('title','')} {c['text']}" for c in chunks])
    items = []
    for c, v in zip(chunks, vectors):
        cid = c.get("id") or f"doc-{abs(hash(c['text'])) % 10_000_000}"
        items.append({"id": cid, "text": c["text"], "vector": v,
                      "metadata": {"title": c.get("title", ""),
                                   "audience": _audience_csv(c.get("audience", [ALL]))}})
    store.upsert(items)
    return len(items)


def _load_docsforai() -> list[dict]:
    """Base documentaire RH ingérée depuis les PDF (générée par data/ingest_docsforai.py)."""
    import json
    import os
    path = os.getenv("KB_DOCSFORAI_PATH", "/app/data/kb_docsforai.json")
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return []


def ensure_seeded() -> None:
    global _seeded
    if _seeded:
        return
    with _lock:
        if _seeded:
            return
        if get_store().count() == 0:
            ingest(KNOWLEDGE)
            docs = _load_docsforai()
            if docs:
                ingest(docs)
        _seeded = True


def retrieve(query: str, role: str, k: int | None = None) -> list[dict]:
    """Passages autorisés les plus pertinents (cosine >= seuil). Interface stable."""
    if not settings.RAG_ENABLED:
        return []
    try:
        ensure_seeded()
        k = k or settings.RAG_TOP_K
        store, embedder = get_store(), get_embedder()
        qv = embedder.embed([query])[0]
        hits = store.query(qv, k * 4)  # large, puis filtrage permissions (= reranking final)
    except Exception as exc:
        # Embeddings/vector store indisponibles (ex. quota API/402 sur OpenRouter) :
        # on dégrade le RAG (aucun document) plutôt que de faire échouer la requête (502).
        print(f"[RAG] récupération indisponible, repli sans document : {exc}", flush=True)
        return []
    out = []
    for h in hits:
        if not _allowed(h["metadata"], role):
            continue
        if h["score"] < settings.RAG_MIN_SCORE:
            continue
        out.append({"id": h["id"], "title": h["metadata"].get("title", ""),
                    "text": h["text"], "score": round(float(h["score"]), 4)})
    return out[:k]


def stats() -> dict:
    return {"count": get_store().count(), "vector_backend": get_store().backend,
            "embed_backend": get_embedder().backend, "dim": getattr(get_embedder(), "dim", None),
            "min_score": settings.RAG_MIN_SCORE}
