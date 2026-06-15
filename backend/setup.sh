#!/usr/bin/env bash
# Installation locale (macOS / Linux). A lancer une seule fois.
set -e
echo ">> Creation de l'environnement virtuel (.venv)"
python3 -m venv .venv
source .venv/bin/activate
echo ">> Installation des dependances"
python -m pip install --upgrade pip
pip install -r requirements.txt
# RAG optionnel (ChromaDB + sentence-transformers). Decommenter si besoin :
# pip install -r requirements-rag.txt
if [ ! -f .env ]; then cp .env.example .env; echo ">> .env cree depuis .env.example (colle ta cle OpenRouter dedans)"; fi
echo ">> OK. Lancer l'API :  source .venv/bin/activate && uvicorn app.main:app --reload"
