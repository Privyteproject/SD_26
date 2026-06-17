"""Détection de langue légère (sans dépendance externe).

Objectif : déterminer la langue du message de l'utilisateur pour demander au LLM
de répondre dans la MÊME langue (évolution « multilingue »). Volontairement simple
et robuste : script arabe par plage Unicode, puis heuristique FR/EN par mots-outils.
Renvoie un code court ('fr', 'en', 'ar') ou None si indéterminé.
"""

import re

_ARABIC = re.compile(r"[؀-ۿݐ-ݿ]")
_WORD = re.compile(r"[a-zàâäçéèêëîïôöûùüÿñæœ']+")

# Mots-outils fréquents et discriminants (minuscules, sans accents superflus).
_FR = {
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "est", "que", "qui",
    "quoi", "quel", "quelle", "comment", "pourquoi", "je", "tu", "il", "elle", "nous",
    "vous", "mon", "ma", "mes", "ce", "cette", "pas", "pour", "avec", "dans", "sur",
    "combien", "ou", "où", "mes", "mon", "congé", "congés", "bonjour", "merci",
}
_EN = {
    "the", "a", "an", "of", "and", "is", "are", "what", "which", "who", "how", "why",
    "i", "you", "he", "she", "we", "they", "my", "your", "this", "that", "not", "for",
    "with", "in", "on", "do", "does", "can", "could", "would", "please", "hello",
    "thanks", "leave", "how", "many",
}


def detect(text: str) -> str | None:
    """Renvoie 'fr' | 'en' | 'ar' | None (indéterminé)."""
    if not text or not text.strip():
        return None
    if _ARABIC.search(text):
        return "ar"
    words = set(_WORD.findall(text.lower()))
    if not words:
        return None
    fr = len(words & _FR)
    en = len(words & _EN)
    if fr == 0 and en == 0:
        return None
    return "fr" if fr >= en else "en"


# Langues écrites de droite à gauche (pour l'affichage RTL côté front).
_RTL = {"ar", "he", "fa", "ur"}


def is_rtl(lang: str | None) -> bool:
    return lang in _RTL
