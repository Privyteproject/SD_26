"""
Routeur API v1 — agrégateur.

Ce module rassemble TOUS les sous-routeurs de l'API sous un unique
`APIRouter` (`api_router`). C'est ce routeur que `app/main.py` monte
derrière le préfixe `/api/v1`, qui correspond exactement au `BASE`
attendu par le front (`frontend/src/lib/api.js` → `/api/v1`).

Pour ajouter un nouveau domaine fonctionnel :
  1. créer un module dans `app/api/v1/endpoints/` exposant un `router`;
  2. l'inclure ci-dessous avec son préfixe et son tag.

Carte des endpoints réellement consommés par le front intégré :

    GET    /employees/me                 -> profil de l'utilisateur connecté
    GET    /employees                    -> liste (filtrable, paginée)
    POST   /employees                    -> création
    GET    /employees/{id}               -> détail
    PUT    /employees/{id}               -> mise à jour
    DELETE /employees/{id}               -> suppression
    GET    /absences                     -> liste (filtrable)
    POST   /absences                     -> création
    PATCH  /absences/{id}/status         -> changement de statut
    GET    /absences/stats               -> agrégats
    GET    /demandes/types               -> référentiel des types
    GET    /demandes                     -> toutes les demandes (filtrable)
    POST   /demandes                     -> dépôt d'une demande (tout type)
    GET    /demandes/{id}                -> détail
    PATCH  /demandes/{id}/status         -> décision (statut + commentaire)
    GET    /parcours/modeles             -> gabarits de tâches (on/offboarding)
    POST   /parcours/{matricule}/init    -> instancie un parcours
    GET    /parcours/{matricule}         -> tâches d'un employé
    PATCH  /parcours/taches/{id}         -> mise à jour d'une tâche
    GET    /dashboard/kpis               -> indicateurs du tableau de bord
    POST   /ai/chat                      -> assistant conversationnel
"""

from fastapi import APIRouter

from app.api.v1.endpoints import employees, absences, demandes, parcours, documents, rag, dashboard, ai

# Routeur agrégateur de la v1 : monté sous /api/v1 dans main.py
api_router = APIRouter()

api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(absences.router, prefix="/absences", tags=["absences"])
api_router.include_router(demandes.router, prefix="/demandes", tags=["demandes"])
api_router.include_router(parcours.router, prefix="/parcours", tags=["parcours"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(rag.router, prefix="/rag", tags=["rag"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])

__all__ = ["api_router"]
