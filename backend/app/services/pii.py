"""Masquage PII / anonymisation AVANT envoi au LLM externe (RGPD / loi 09-08).

Masque emails, téléphones, CIN marocaine, IBAN, longues séquences de chiffres,
et toute liste de noms fournie (issus du contexte employé). Réversible via la map.
>>> Renforcer (NER) si besoin ; ici regex, local, sans dépendance."""

import re

_RULES = [
    ("EMAIL", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
    ("IBAN", re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b")),
    ("CIN", re.compile(r"\b[A-Za-z]{1,2}\d{5,7}\b")),
    ("TEL", re.compile(r"\b(?:\+?212|0)\s?[5-7](?:[\s.-]?\d{2}){4}\b")),
    ("NUM", re.compile(r"\b\d{6,}\b")),
]


def mask(text: str, names: list[str] | None = None) -> tuple[str, dict]:
    if not text:
        return text, {}
    mapping: dict[str, str] = {}
    counters: dict[str, int] = {}
    out = text
    # Noms connus (du contexte) d'abord
    for n in sorted(names or [], key=len, reverse=True):
        if n and n in out:
            counters["NOM"] = counters.get("NOM", 0) + 1
            token = f"[NOM_{counters['NOM']}]"
            mapping[token] = n
            out = out.replace(n, token)
    # Motifs regex
    for label, rx in _RULES:
        def _sub(m, label=label):
            counters[label] = counters.get(label, 0) + 1
            token = f"[{label}_{counters[label]}]"
            mapping[token] = m.group(0)
            return token
        out = rx.sub(_sub, out)
    return out, mapping


def unmask(text: str, mapping: dict) -> str:
    for token, original in mapping.items():
        text = text.replace(token, original)
    return text
