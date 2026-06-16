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

from typing import Literal

from app.core.config import settings
from app.core.security import CurrentUser
from app.db import repository as repo
from app.services import ai as ai_service
from app.services import cache, classifier, pii, rate_limit, retrieval, rh_engines, security_filter

# RBAC/ABAC : types RH nécessitant un rôle de l'espace RH
_ELEVATED = {"ADMIN", "RH", "DIRECTION", "MANAGER", "MEDECINE"}
_RESTRICTED_TYPES = {"sensible", "predictive"}

# Mode de génération : pilote le branchement RAG / culture générale / refus court.
Mode = Literal["rag", "general", "refusal"]

# ── Deux system prompts distincts (un par branche de routage) ──
SYSTEM_PROMPT_RH = (
    "Tu es l'assistant RH de « Synapse Digital ». Réponds en français, de façon "
    "concise et professionnelle, UNIQUEMENT à partir des documents fournis ci-dessous. "
    "Si l'information n'est pas dans les documents, dis-le explicitement et propose de "
    "contacter un responsable RH. Ne génère jamais d'information non sourcée. "
    "Pas de conseil juridique ou médical. Cite les titres des sources utilisées."
)
SYSTEM_PROMPT_GENERAL = (
    "Tu es un assistant polyvalent dans le cadre d'une plateforme RH. Réponds en français. "
    "Tu peux répondre aux questions de culture générale, d'actualité non sensible et aux "
    "questions pratiques du quotidien. Tu ne mentionnes JAMAIS de données RH et tu ne fais "
    "aucune référence aux documents internes. Reste concis et factuel."
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

    # 5) Routage périmètre -> mode de génération
    P = classifier
    if cls["perimetre"] == P.PERIMETRE_DANGEREUX:
        return generate(db, user, message, history, mode="refusal", meta=meta,
                        want_judge=want_judge, ck=ck,
                        refusal_text="Désolé, je ne peux pas traiter ce sujet (refus de sécurité).")

    if cls["perimetre"] == P.PERIMETRE_HORS_SUJET:
        return generate(db, user, message, history, mode="refusal", meta=meta,
                        want_judge=want_judge, ck=ck,
                        refusal_text="Je suis l'assistant de Synapse. Posez-moi une question RH "
                        "(congés, documents, onboarding…) ou une question d'ordre général.")

    if cls["perimetre"] == P.PERIMETRE_CULTURE:
        return generate(db, user, message, history, mode="general", meta=meta,
                        want_judge=want_judge, ck=ck)

    # ── Branche RH : RBAC/ABAC avant le RAG ──
    authorized = not (cls["type_rh"] in _RESTRICTED_TYPES and user.role not in _ELEVATED)
    meta["authorized"] = authorized
    if not authorized:
        return generate(db, user, message, history, mode="refusal", meta=meta,
                        want_judge=want_judge, ck=ck,
                        refusal_text="Cette demande relève des RH. Je vous oriente vers votre "
                        "référent RH (accès non autorisé pour ce type d'information).")

    return generate(db, user, message, history, mode="rag", meta=meta,
                    want_judge=want_judge, ck=ck, type_rh=cls["type_rh"])


def generate(db, user: CurrentUser, message: str, history: list, *, mode: Mode,
             meta: dict, want_judge: bool, ck: str,
             refusal_text: str | None = None, type_rh: str | None = None) -> dict:
    """Fonction de génération unique, pilotée par `mode`.

    - mode == "refusal" : réponse courte SANS appel LLM (refus / hors-sujet).
    - mode == "general" : saute RET → EMB → VDB → DOCS → RERANK ; prompt direct
      (contexte utilisateur + historique), sans aucun document RH.
    - mode == "rag"     : pipeline complet (récupération ChromaDB + reranking + sources).
    """
    meta["mode"] = mode

    # ── Refus court : aucun appel au modèle ──
    if mode == "refusal":
        res = _refusal(refusal_text or "Désolé, je ne peux pas répondre à cette demande.", meta)
        _audit(db, user, message, res)
        return res

    # ── Culture générale : on contourne entièrement le RAG ──
    if mode == "general":
        masked, mapping = (pii.mask(message) if settings.PII_MASKING else (message, {}))
        meta["pii_masked"] = bool(mapping)
        out = ai_service.complete(SYSTEM_PROMPT_GENERAL, masked, history)
        return _finalize(db, user, message, out, meta, want_judge, ck, SYSTEM_PROMPT_GENERAL)

    # ── Branche 4A : routage vers le bon moteur RH selon le type de demande ──
    # E2 génération documentaire / E3 onboarding-offboarding / E4 prédictif analytics
    # s'appuient sur les VRAIES données applicatives (pas de recherche vectorielle).
    engine_id = rh_engines.select(type_rh)
    if engine_id:
        eng = rh_engines.build(db, user, message, type_rh)
        meta["engine"] = eng["engine"]
        meta["sources"] = eng["sources"]
        enriched = (f"Contexte utilisateur : rôle={user.role}.\n"
                    f"Données internes autorisées :\n{eng['context']}\n\n"
                    f"Question : {message}")
        masked, mapping = (pii.mask(enriched) if settings.PII_MASKING else (enriched, {}))
        meta["pii_masked"] = bool(mapping)
        out = ai_service.complete(eng["system"], masked, history)
        return _finalize(db, user, message, out, meta, want_judge, ck, eng["system"])

    # ── E1 · RAG documentaire : récupération filtrée par rôle + reranking (ChromaDB) ──
    meta["engine"] = "E1"
    docs = retrieval.retrieve(message, user.role) if settings.RAG_ENABLED else []
    meta["sources"] = [{"id": d["id"], "title": d["title"], "score": d["score"]} for d in docs]

    # Garde anti-hallucination : seulement pour les questions RH informationnelles simples.
    if settings.RAG_ENABLED and not docs and type_rh == "simple":
        res = _refusal("Je n'ai pas trouvé d'information autorisée pour répondre "
                       "précisément. Contactez votre référent RH.", {**meta, "no_doc": True})
        _audit(db, user, message, res)
        return res

    # Construction du prompt enrichi (contexte + sources)
    sources_txt = "\n".join(f"- {d['title']} : {d['text']}" for d in docs) or "(aucune)"
    enriched = (f"Contexte utilisateur : rôle={user.role}.\n"
                f"Sources internes autorisées :\n{sources_txt}\n\n"
                f"Question : {message}")

    # Masquage PII avant LLM externe
    masked, mapping = (pii.mask(enriched) if settings.PII_MASKING else (enriched, {}))
    meta["pii_masked"] = bool(mapping)

    out = ai_service.complete(SYSTEM_PROMPT_RH, masked, history)
    return _finalize(db, user, message, out, meta, want_judge, ck, SYSTEM_PROMPT_RH)


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
