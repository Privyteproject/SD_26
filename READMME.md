# SD_26

Projet YDAYS 2026 - Solution RH augmentee par IA.

## Etat du travail documente

La documentation technique actuelle du travail realise se trouve dans :

- [backend/README.md](./backend/README.md)

Elle couvre :

- l'interface `LLMProvider`
- l'integration OpenRouter
- la conception des prompts systeme
- le pipeline IA RH
- l'ingestion des documents RH
- les embeddings locaux
- ChromaDB
- les procedures de test et verification

## Livrable backend actuellement valide

Le MVP backend permet deja :

- de lancer une API FastAPI
- d'indexer des documents RH dans ChromaDB
- d'utiliser un pipeline RAG avec filtrage par role
- d'interroger un LLM via OpenRouter
- de retourner des reponses RH sourcees
