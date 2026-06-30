"""Analyse de sentiment LÉGÈRE et DÉTERMINISTE (lexique FR/EN), 100% locale.

Conçue pour enrichir le climat social à partir des commentaires d'humeur, qui sont
fournis volontairement dans ce cadre. Aucun texte ne quitte le serveur (pas d'appel LLM
externe) ; les résultats ne sont exploités qu'AGRÉGÉS et au-dessus d'un seuil minimal de
commentaires (anti-réidentification — loi 09-08 / §4.1).

Approche : lexique de polarité (+/-), gestion de la négation (fenêtre de 3 tokens) et des
intensifieurs (très, trop, vraiment…). Volontairement simple et explicable, sans dépendance.
"""

import re

from app.services.text_utils import normalize

# Mots positifs / négatifs (forme normalisée : minuscules, sans accents).
_POSITIVE = {
    # FR
    "bien", "bon", "bonne", "super", "genial", "geniale", "excellent", "excellente", "parfait",
    "parfaite", "satisfait", "satisfaite", "satisfaisant", "content", "contente", "heureux",
    "heureuse", "motive", "motivee", "motivant", "agreable", "positif", "positive", "top",
    "merci", "bravo", "epanoui", "epanouie", "serein", "sereine", "confiant", "confiante",
    "apprecie", "appreciee", "reconnaissant", "reconnaissante", "fier", "fiere", "ravi", "ravie",
    "progres", "progresse", "amelioration", "ameliore", "soutien", "soutenu", "ecoute", "ecoutee",
    "cool", "fantastique", "formidable", "plaisir", "enthousiaste", "dynamique", "bienveillant",
    "bienveillante", "reussite", "reussi", "efficace", "clair", "claire", "calme",
    # EN
    "good", "great", "excellent", "perfect", "satisfied", "happy", "motivated", "nice", "positive",
    "thanks", "awesome", "amazing", "wonderful", "pleasure", "supported", "supportive", "proud",
    "improvement", "improved", "confident", "fair", "calm", "enjoy", "enjoyed", "love", "loved",
}
_NEGATIVE = {
    # FR
    "mauvais", "mauvaise", "mal", "nul", "nulle", "insatisfait", "insatisfaite", "mecontent",
    "mecontente", "demotive", "demotivee", "demotivant", "stresse", "stressee", "stress",
    "stressant", "epuise", "epuisee", "epuisant", "fatigue", "fatiguee", "fatigant", "burnout",
    "surcharge", "surcharges", "surmenage", "debordee", "deborde", "triste", "decu", "decue",
    "deception", "frustre", "frustree", "frustration", "colere", "enerve", "enervee", "penible",
    "difficile", "dur", "dure", "probleme", "problemes", "conflit", "conflits", "ignore",
    "ignoree", "injuste", "injustice", "pression", "anxieux", "anxieuse", "angoisse", "inquiet",
    "inquiete", "demission", "partir", "quitter", "lourd", "lourde", "toxique", "demoralise",
    "demoralisee", "pire", "echec", "echoue", "abandonne", "seul", "seule", "isole", "isolee",
    "manque", "insuffisant", "insuffisante", "lent", "lente", "bloque", "bloquee", "demotivation",
    # EN
    "bad", "poor", "terrible", "awful", "unsatisfied", "unhappy", "demotivated", "stress",
    "stressed", "stressful", "exhausted", "tired", "burnout", "overworked", "overload", "sad",
    "disappointed", "frustrated", "frustration", "anger", "angry", "unfair", "pressure", "anxious",
    "worried", "leave", "quit", "toxic", "worse", "worst", "failure", "alone", "isolated", "lack",
    "difficult", "hard", "problem", "problems", "conflict", "blocked", "slow",
}
_NEGATORS = {"ne", "n", "pas", "non", "plus", "jamais", "aucun", "aucune", "sans", "ni",
             "not", "no", "never", "without", "nor"}
_INTENSIFIERS = {"tres", "trop", "vraiment", "extremement", "totalement", "completement",
                 "super", "tellement", "beaucoup", "very", "really", "extremely", "so", "too"}

_NEG_WINDOW = 3   # portée de la négation (en tokens)


def analyze(text: str) -> float | None:
    """Polarité d'un texte dans [-1, 1] (None si aucun mot porteur de sentiment)."""
    toks = re.findall(r"[a-z0-9']+", normalize(text))
    if not toks:
        return None
    total, hits = 0.0, 0
    for i, tok in enumerate(toks):
        base = 1.0 if tok in _POSITIVE else (-1.0 if tok in _NEGATIVE else 0.0)
        if base == 0.0:
            continue
        # Intensifieur juste avant ?
        if i > 0 and toks[i - 1] in _INTENSIFIERS:
            base *= 1.5
        # Négation dans la fenêtre précédente ?
        window = toks[max(0, i - _NEG_WINDOW):i]
        if any(w in _NEGATORS for w in window):
            base = -base
        total += base
        hits += 1
    if hits == 0:
        return None
    # Moyenne par mot porteur, bornée à [-1, 1].
    return max(-1.0, min(1.0, total / hits))


def _label(polarity: float) -> str:
    if polarity >= 0.25:
        return "positif"
    if polarity <= -0.25:
        return "negatif"
    return "neutre"


def score_texts(texts: list[str]) -> dict:
    """Agrège la polarité d'une liste de commentaires.

    Retourne : n (commentaires porteurs de sentiment), polarity (-1..1 ou None),
    score (0..100 ou None), label (positif/neutre/negatif/None).
    """
    pols = [p for p in (analyze(t) for t in (texts or [])) if p is not None]
    if not pols:
        return {"n": 0, "polarity": None, "score": None, "label": None}
    avg = sum(pols) / len(pols)
    return {"n": len(pols), "polarity": round(avg, 3),
            "score": round((avg + 1) / 2 * 100),  # -1..1 -> 0..100
            "label": _label(avg)}
