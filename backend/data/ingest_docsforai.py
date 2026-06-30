"""Ingestion de la base documentaire RH (docsforai) dans le vector store (ChromaDB).

- Extrait le texte de chaque PDF (pypdf).
- Adapte le contenu à NOTRE entreprise (Waminey Tech / plateforme Synapse Digital) :
  remplace toute marque étrangère trouvée dans les documents.
- Découpe en chunks et indexe avec une `audience` par rôle (moindre privilège, §3.3 du cahier) :
  politiques générales -> tout le monde ; procédures internes / protocole burnout -> encadrants.

Exécution :  docker compose exec backend python /app/data/ingest_docsforai.py
"""

import json
import os
import re

from pypdf import PdfReader

DOCS_DIR = "/app/data/docsforai"
OUT_JSON = "/app/data/kb_docsforai.json"

# Marques étrangères éventuellement présentes dans les PDF -> notre identité.
REPLACEMENTS = [
    (re.compile(r"\bNEXCORE\s*RH\b", re.I), "Waminey Tech"),
    (re.compile(r"\bNexcoreRH\b", re.I), "Waminey Tech"),
    (re.compile(r"\bNexcore\b", re.I), "Waminey Tech"),
    (re.compile(r"\bSmartRH\b", re.I), "Synapse Digital"),
    (re.compile(r"\bYDAYS\s+SARL\b", re.I), "Waminey Tech"),
    (re.compile(r"\bYDAYS\b", re.I), "Waminey Tech"),
]

# Audience par fichier (clé = fragment du nom, minuscule). Défaut = ALL.
RESTRICTED = {
    "internal_procedures_guide": ["MANAGER", "RH", "DIRECTION", "ADMIN"],
    "onboarding_offboarding_process": ["MANAGER", "RH", "DIRECTION", "ADMIN"],
    "protocole_de_gestion_du_risque_de_burnout": ["MANAGER", "RH", "DIRECTION", "ADMIN", "MEDECINE"],
}
SKIP = {"test", "hr_assistant"}


def _title(fname: str) -> str:
    base = os.path.splitext(fname)[0]
    base = base.replace("__", " ").replace("_", " ").strip()
    return base[:1].upper() + base[1:]


def _audience(fname: str) -> list[str]:
    key = os.path.splitext(fname)[0].lower()
    for frag, aud in RESTRICTED.items():
        if frag in key:
            return aud
    return ["ALL"]


def _clean(text: str) -> str:
    for rx, repl in REPLACEMENTS:
        text = rx.sub(repl, text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _chunks(text: str, size: int = 900, overlap: int = 120) -> list[str]:
    """Découpe par paragraphes en respectant ~`size` caractères, avec léger chevauchement."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    out, buf = [], ""
    for p in paras:
        if len(buf) + len(p) + 1 <= size:
            buf = f"{buf}\n{p}".strip()
        else:
            if buf:
                out.append(buf)
            if len(p) <= size:
                buf = p
            else:  # paragraphe très long -> coupe dure avec chevauchement
                for i in range(0, len(p), size - overlap):
                    out.append(p[i:i + size])
                buf = ""
    if buf:
        out.append(buf)
    return out


def main():
    files = sorted(f for f in os.listdir(DOCS_DIR) if f.lower().endswith(".pdf"))
    all_chunks, per_file = [], {}
    for f in files:
        if os.path.splitext(f)[0].lower() in SKIP:
            continue
        try:
            reader = PdfReader(os.path.join(DOCS_DIR, f))
            raw = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as e:
            print(f"  ! {f}: lecture impossible ({e})")
            continue
        text = _clean(raw)
        if len(text) < 40:
            print(f"  ! {f}: texte vide/illisible (PDF image ?) — ignoré")
            continue
        aud = _audience(f)
        title = _title(f)
        slug = re.sub(r"[^a-z0-9]+", "-", os.path.splitext(f)[0].lower()).strip("-")
        chs = _chunks(text)
        for i, c in enumerate(chs):
            all_chunks.append({"id": f"df-{slug}-{i}", "title": title, "text": c, "audience": aud})
        per_file[f] = (len(chs), ",".join(aud))

    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(all_chunks, fh, ensure_ascii=False, indent=1)

    print(f"\n=== {len(all_chunks)} chunks depuis {len(per_file)} documents -> {OUT_JSON} ===")
    for f, (c, aud) in per_file.items():
        print(f"  {c:>2} chunks  [{aud:<28}] {f}")


if __name__ == "__main__":
    main()
