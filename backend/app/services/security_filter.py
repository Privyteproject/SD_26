"""Pré-filtrage sécurité : détection heuristique d'injections de prompt / attaques.
Double couche : regex patterns + LLM Guard pour les variantes obfusquées."""

import re
from app.services.text_utils import normalize

_PATTERNS = [
    # Prompt injection classique
    r"ignore (les |the )?(precedent|previous|above|prior|toutes? les)? ?(instruction|consigne|prompt)",
    r"oublie (les |toutes? )?(instruction|consigne|regle)",
    r"system prompt|prompt systeme",
    r"(reveal|montre|affiche|donne).{0,20}(prompt|instruction|consigne|systeme)",
    r"jailbreak|dan mode|developer mode|mode developpeur",
    r"agis comme.{0,30}(sans|aucune).{0,15}(restriction|regle|limite)",
    r"act as.{0,30}(no|without).{0,15}(restriction|rule|limit)",
    r"prompt injection|exfiltr",
    r"rm -rf|drop table|;--|union select|<script",

    # Extraction massive de données sensibles
    r"(tous?|toutes?|all|liste|list).{0,30}(salaire|salary|remuneration|paie)",
    r"(tous?|toutes?|all|liste|list).{0,30}(employe|collaborateur|staff|personnel)",
    r"(export|extrai|extract|telecharge).{0,20}(data|donnee|base|database)",
    r"salaire.{0,20}(tous|all|chaque|each|employe|collaborateur)",
]


def detect_injection_patterns(text: str) -> tuple[bool, str | None]:
    """Couche 1 — Regex patterns."""
    t = normalize(text)
    for p in _PATTERNS:
        if re.search(p, t):
            return True, "motif suspect détecté (pattern)"
    return False, None


def detect_injection_llmguard(text: str) -> tuple[bool, str | None]:
    """Couche 2 — LLM Guard (détecte variantes obfusquées)."""
    try:
        from llm_guard.input_scanners import PromptInjection
        scanner = PromptInjection()
        _, is_valid, risk_score = scanner.scan(text)
        if not is_valid:
            return True, f"prompt injection détectée (LLM Guard, score: {risk_score:.2f})"
    except Exception:
        pass
    return False, None


def detect_injection(text: str) -> tuple[bool, str | None]:
    """Point d'entrée principal — double couche."""

    # Couche 1 — Patterns regex
    detected, reason = detect_injection_patterns(text)
    if detected:
        return True, reason

    # Couche 2 — LLM Guard
    detected, reason = detect_injection_llmguard(text)
    if detected:
        return True, reason

    return False, None