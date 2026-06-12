@echo off
REM Installation locale (Windows). A lancer une seule fois.
echo >> Creation de l'environnement virtuel (.venv)
python -m venv .venv
call .venv\Scripts\activate
echo >> Installation des dependances
python -m pip install --upgrade pip
pip install -r requirements.txt
REM RAG optionnel : pip install -r requirements-rag.txt
if not exist .env copy .env.example .env
echo >> OK. Lancer l'API :  .venv\Scripts\activate ^&^& uvicorn app.main:app --reload
