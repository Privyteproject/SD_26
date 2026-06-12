# Ouvrir le projet dans VS Code

1. Dezippe `synapse-backend-v1.zip` -> dossier `synapse-backend-pkg`.
2. Ouvre ce dossier dans VS Code (Fichier > Ouvrir le dossier, ou `code synapse-backend-pkg`).
3. Installe l'extension Python si VS Code la propose (recommandee automatiquement).
4. Installe les dependances :
   - **Facile** : Terminal > Run Task… > **Setup (venv + deps)**
   - ou manuellement : `bash setup.sh` (macOS/Linux) / `setup.bat` (Windows)
5. Colle ta cle OpenRouter dans le fichier `.env` (cree automatiquement) : `OPENROUTER_API_KEY=sk-or-v1-...`
6. Lance l'API :
   - **Run Task… > Run API**, ou la touche **F5** (config "Synapse API"),
   - ou : `uvicorn app.main:app --reload`
7. Ouvre http://localhost:8000/docs (Swagger).  Test : Run Task… > **Smoke test**.

> RAG en prod : `pip install -r requirements-rag.txt` (ChromaDB + sentence-transformers).
> Sans ça, le RAG tourne en mode memoire/hashing — l'app demarre quand meme.
