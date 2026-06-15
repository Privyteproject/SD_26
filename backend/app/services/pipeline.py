"""Orchestrateur de la pipeline conversationnelle (schéma RAG v2).

Enchaîne, dans l'ordre du schéma :
  rate-limit → sécurité (anti-injection) → classification → cache →
  routage périmètre (RH / culture / hors-sujet / dangereux) →
  [RH] RBAC/ABAC → RAG (retrieve+rerank+garde anti-hallucination) → prompt enrichi →
  masquage PII → LLM (agent + fallback) → post-filtrage → validation →
  juge (Qwen) → conformité (reformulation/refus) → cache → audit.

Chaque brique lourde (embeddings/ChromaDB, NER PII, classifieur LLM) est isolée
dans son module `app/services/*` et remplaçable sans toucher à cet orchestrateur.
"""

from app.core.config import settings
from app.core.security import CurrentUser
from app.db import repository as repo
from app.services import ai as ai_service
from app.services import cache, classifier, pii, rate_limit, retrieval, security_filter

# RBAC/ABAC : types RH nécessitant un rôle de l'espace RH
_ELEVATED = {"ADMIN", "RH", "DIRECTION", "MANAGER", "MEDECINE"}
_RESTRICTED_TYPES = {"sensible", "predictive"}

GENERAL_SYSTEM = (
    "Tu es un assistant de culture générale, sobre et factuel, en français. "
    "Tu n'as accès à AUCUNE donnée RH interne. Reste neutre et prudent."
)
RH_SYSTEM = (
    "Tu es l'assistant RH de « Synapse Digital ». Réponds en français, de façon "
    "concise et professionnelle, en t'appuyant UNIQUEMENT sur les sources fournies. "
    "Si l'information n'est pas dans les sources, dis-le sans inventer. Pas de conseil "
    "juridique ou médical. Cite les titres des sources utilisées."
)


class RateLimited(Exception):
    pass


def _refusal(reply: str, meta: dict) -> dict:
    return {"reply": reply, "model": "policy", "degraded": False,
            "usage": {}, "judge": None, "meta": meta}


def _audit(db, user, message, result):
    try:
        repo.log_ia_interaction(
            db, user_email=user.email, prompt=message,
            reponse=result.get("reply"), tokens=(result.get("usage") or {}).get("output_tokens"),
            model=result.get("model"),
            sensible=(result.get("meta", {}).get("type_rh") == "sensible"),
        )
    except Exception:
        db.rollback()


def run_chat(db, user: CurrentUser, message: str, history: list, want_judge: bool) -> dict:
    meta: dict = {"perimetre": None, "type_rh": None, "cache_hit": False,
                  "blocked": None, "authorized": None, "sources": [], "pii_masked": False}

    # 1) Rate limiting
    if not rate_limit.allow(user.sub or user.email):
        raise RateLimited()

    # 2) Sécurité : injection / attaque
    attack, _ = security_filter.detect_injection(message)
    if attack:
        meta.update({"perimetre": classifier.PERIMETRE_DANGEREUX, "blocked": "injection"})
        res = _refusal("Votre requête a été bloquée pour des raisons de sécurité.", meta)
        _audit(db, user, message, res)
        return res

    # 3) Classification
    cls = classifier.classify(message)
    meta["perimetre"], meta["type_rh"] = cls["perimetre"], cls["type_rh"]

    # 4) Cache sémantique
    ck = cache.key(message, cls["perimetre"])
    cached = cache.get(ck)
    if cached:
        out = {**cached, "meta": {**cached["meta"], "cache_hit": True}}
        return out

    # 5) Routage périmètre
    P = classifier
    if cls["perimetre"] == P.PERIMETRE_DANGEREUX:
        res = _refusal("Désolé, je ne peux pas traiter ce sujet (refus de sécurité).", meta)
        _audit(db, user, message, res); return res

    if cls["perimetre"] == P.PERIMETRE_HORS_SUJET:
        res = {"reply": "Je suis l'assistant RH de Synapse. Posez-moi une question RH "
               "(congés, documents, onboarding…).", "model": "policy", "degraded": False,
               "usage": {}, "judge": None, "meta": meta}
        _audit(db, user, message, res); return res

    if cls["perimetre"] == P.PERIMETRE_CULTURE:
        # Branche culture générale : pas d'accès RH, prompt encadré
        masked, mapping = (pii.mask(message) if settings.PII_MASKING else (message, {}))
        meta["pii_masked"] = bool(mapping)
        out = ai_service.complete(GENERAL_SYSTEM, masked, history)
        return _finalize(db, user, message, out, meta, want_judge, ck, GENERAL_SYSTEM)

    # ── Branche RH sécurisée ──
    # RBAC/ABAC
    authorized = not (cls["type_rh"] in _RESTRICTED_TYPES and user.role not in _ELEVATED)
    meta["authorized"] = authorized
    if not authorized:
        res = _refusal("Cette demande relève des RH. Je vous oriente vers votre "
                       "référent RH (accès non autorisé pour ce type d'information).", meta)
        _audit(db, user, message, res); return res

    # RAG : récupération filtrée par rôle + reranking
    docs = retrieval.retrieve(message, user.role) if settings.RAG_ENABLED else []
    meta["sources"] = [{"id": d["id"], "title": d["title"], "score": d["score"]} for d in docs]

    # Garde anti-hallucination : seulement pour les questions informationnelles
    # (les actions génération/parcours/prédictif/sensible ne dépendent pas du RAG).
    if settings.RAG_ENABLED and not docs and cls["type_rh"] == "simple":
        res = _refusal("Je n'ai pas trouvé d'information autorisée pour répondre "
                       "précisément. Contactez votre référent RH.", {**meta, "no_doc": True})
        _audit(db, user, message, res); return res

    # Construction du prompt enrichi (contexte + sources)
    sources_txt = "\n".join(f"- {d['title']} : {d['text']}" for d in docs) or "(aucune)"
    enriched = (f"Contexte utilisateur : rôle={user.role}.\n"
                f"Sources internes autorisées :\n{sources_txt}\n\n"
                f"Question : {message}")

    # Masquage PII avant LLM externe
    masked, mapping = (pii.mask(enriched) if settings.PII_MASKING else (enriched, {}))
    meta["pii_masked"] = bool(mapping)

    out = ai_service.complete(RH_SYSTEM, masked, history)
    return _finalize(db, user, message, out, meta, want_judge, ck, RH_SYSTEM)


def _finalize(db, user, message, out, meta, want_judge, ck, system_prompt) -> dict:
    """Post-filtrage → juge → conformité (reformulation) → cache → audit."""
    reply = (out.get("reply") or "").strip()
    meta["fallback_used"] = out.get("fallback_used", False)

    judge = None
    if (want_judge or settings.AUTO_JUDGE):
        judge = ai_service.judge_reply(message, reply)
        note = judge.get("note")
        # Conformité : si noté sous le seuil, on reformule une fois
        if isinstance(note, int) and note < settings.JUDGE_MIN_NOTE:
            meta["reformulated"] = True
            refined = ai_service.refine(message, reply, judge.get("justification", ""), system_prompt)
            reply = (refined.get("reply") or reply).strip()
            out["model"] = refined.get("model", out["model"])

    result = {"reply": reply, "model": out["model"], "degraded": out.get("degraded", False),
              "usage": out.get("usage", {}), "judge": judge, "meta": meta}

    if not meta.get("cache_hit"):
        cache.set(ck, result)
    _audit(db, user, message, result)
    return result
