"""Pré-filtrage sécurité : détection heuristique d'injections de prompt / attaques.

>>> PROVISOIRE/léger : couvre les motifs courants. À renforcer (modèle dédié,
listes à jour) selon les besoins. Aucune dépendance, exécution locale."""

import re

from app.services.text_utils import normalize

_PATTERNS = [
    r"ignore (les |the )?(precedent|previous|above|prior|toutes? les)? ?(instruction|consigne|prompt)",
    r"oublie (les |toutes? )?(instruction|consigne|regle)",
    r"system prompt|prompt systeme",
    r"(reveal|montre|affiche|donne).{0,20}(prompt|instruction|consigne|systeme)",
    r"jailbreak|dan mode|developer mode|mode developpeur",
    r"agis comme.{0,30}(sans|aucune).{0,15}(restriction|regle|limite)",
    r"act as.{0,30}(no|without).{0,15}(restriction|rule|limit)",
    r"prompt injection|exfiltr",
    r"rm -rf|drop table|;--|union select|<script",
]


def detect_injection(text: str) -> tuple[bool, str | None]:
    t = normalize(text)
    for p in _PATTERNS:
        if re.search(p, t):
            return True, "motif suspect détecté"
    return False, None
