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
from app.services import (
    cache, classifier, lang_detect, pii, rate_limit, retrieval, rh_engines, security_filter,
)

# RBAC/ABAC : types RH nécessitant un rôle de l'espace RH
_ELEVATED = {"ADMIN", "RH", "DIRECTION", "MANAGER", "MEDECINE"}
_RESTRICTED_TYPES = {"sensible", "predictive"}

# Mode de génération : pilote le branchement RAG / culture générale / refus court.
Mode = Literal["rag", "general", "refusal"]

# Noms de langues pour la consigne dynamique (réponse dans la langue de l'utilisateur).
_LANG_NAMES = {"fr": "français", "en": "anglais", "ar": "arabe"}


def _lang_directive(message: str) -> tuple[str, str | None]:
    """Renvoie (consigne de langue à ajouter au system prompt, code langue détecté)."""
    lang = lang_detect.detect(message)
    if lang in _LANG_NAMES:
        return (f"\n\nIMPORTANT : réponds IMPÉRATIVEMENT en {_LANG_NAMES[lang]}, "
                "la langue du message de l'utilisateur.", lang)
    return ("\n\nIMPORTANT : réponds IMPÉRATIVEMENT dans la même langue que le message "
            "de l'utilisateur.", lang)


# ── Deux system prompts distincts (un par branche de routage) ──
SYSTEM_PROMPT_RH = (
    "Tu es l'assistant RH de « Synapse Digital ». Réponds de façon concise "
    "et professionnelle.\n"
    "1) Pour les informations PROPRES À L'ENTREPRISE (politiques internes, procédures, "
    "soldes de congés, dossiers individuels, montants), appuie-toi UNIQUEMENT sur les "
    "documents fournis ci-dessous. Si l'information n'y figure pas, dis-le clairement et "
    "invite à contacter un responsable RH. N'invente JAMAIS de donnée interne.\n"
    "2) Pour les questions GÉNÉRALES de connaissance RH ou de droit du travail (par ex. "
    "définitions : CDI, CDD, période d'essai, préavis, congés légaux…), tu PEUX répondre "
    "à partir de tes connaissances générales, de manière factuelle et concise, en "
    "précisant qu'il s'agit d'une information générale et non d'un conseil juridique.\n"
    "Ne donne pas de conseil médical. "
    "Si la question concerne une situation humaine sensible ou urgente (harcèlement, "
    "discrimination, détresse…), n'essaie pas d'y répondre seul : invite la personne à "
    "contacter un référent RH (la plateforme ouvre alors automatiquement un ticket)."
)
SYSTEM_PROMPT_GENERAL = (
    "Tu es un assistant polyvalent dans le cadre d'une plateforme RH. "
    "Tu peux répondre aux questions de culture générale, d'actualité non sensible et aux "
    "questions pratiques du quotidien. Tu ne mentionnes JAMAIS de données RH et tu ne fais "
    "aucune référence aux documents internes. Reste concis et factuel."
)

# Orientation « copilote RH/manager » (profil audience=rh, réservé aux rôles élevés).
RH_PILOT_NOTE = (
    "\n\nContexte : tu assistes un responsable RH ou un manager. Tu peux analyser les "
    "demandes, suivre les collaborateurs, proposer des réponses à valider et commenter les "
    "indicateurs RH. Tu PROPOSES ; la décision et la validation finales restent humaines."
)


# Situations RH sensibles -> escalade immédiate vers un référent humain (ouverture de ticket).
_ESCALADE_KEYWORDS = [
    "harcelement", "harcele", "harassment", "discrimination", "discrimine",
    "agression", "agresse", "violence", "menace", "souffrance au travail",
    "detresse", "depression", "suicide", "burn out", "epuisement professionnel",
]


def _needs_escalation(message: str) -> bool:
    from app.services.text_utils import normalize
    t = normalize(message)
    return any(k in t for k in _ESCALADE_KEYWORDS)


class RateLimited(Exception):
    pass


def _refusal(reply: str, meta: dict) -> dict:
    return {"reply": reply, "model": "policy", "degraded": False,
            "usage": {}, "judge": None, "meta": meta}


def _audit(db, user, message, result):
    try:
        meta = result.get("meta", {})
        repo.log_ia_interaction(
            db, user_email=user.email, prompt=message,
            reponse=result.get("reply"), tokens=(result.get("usage") or {}).get("output_tokens"),
            model=result.get("model"),
            sensible=(meta.get("type_rh") == "sensible"),
            conversation_id=meta.get("conversation_id"),
        )
    except Exception:
        db.rollback()


def run_chat(db, user: CurrentUser, message: str, history: list, want_judge: bool,
             conversation_id: int | None = None, audience: str = "collaborateur") -> dict:
    # L'assistant RH n'est « copilote » que pour un rôle réellement habilité (RBAC inchangé).
    audience = "rh" if (audience == "rh" and user.role in _ELEVATED) else "collaborateur"
    meta: dict = {"perimetre": None, "type_rh": None, "cache_hit": False, "audience": audience,
                  "blocked": None, "authorized": None, "sources": [], "pii_masked": False,
                  "escalade": False}

    # Historique : la persistance est gérée par l'endpoint /ai/chat via chat_sessions
    # (l'`history` est déjà reconstruit côté serveur et passé ici).
    meta["conversation_id"] = conversation_id

    # 1) Rate limiting
    if not rate_limit.allow(user.sub or user.email):
        raise RateLimited()

    # 2) Sécurité : injection / attaque
    attack, _ = security_filter.detect_injection(message)
    if attack:
        meta.update({"perimetre": classifier.PERIMETRE_DANGEREUX, "blocked": "injection"})
        res = _refusal("Votre requête a été bloquée pour des raisons de sécurité.", meta)
        _audit(db, user, message, res)
        try:  # alerte de sécurité diffusée aux RH/Admin
            repo.create_alerte(db, message=f"Tentative d'injection bloquée ({user.email}).",
                               categorie="securite", gravite="high", id_destinataire=None)
        except Exception:
            db.rollback()
        return res

    # 2bis) Escalade : situation RH sensible -> on n'appelle pas le LLM, on ouvre un ticket.
    if _needs_escalation(message):
        meta["escalade"] = True
        res = {"reply": "Votre demande a été transférée à un référent RH, qui vous "
               "recontactera rapidement et en toute confidentialité. En cas d'urgence, "
               "contactez directement votre RH ou la médecine du travail.",
               "model": "policy", "degraded": False, "usage": {}, "judge": None, "meta": meta}
        _audit(db, user, message, res)
        try:  # ouverture de ticket = notification RH (Mission 3)
            repo.create_alerte(db, message=f"Escalade RH : situation sensible signalée ({user.email}).",
                               categorie="escalade", gravite="high", id_destinataire=None)
        except Exception:
            db.rollback()
        return res

    # 3) Classification
    cls = classifier.classify(message)
    meta["perimetre"], meta["type_rh"] = cls["perimetre"], cls["type_rh"]

    # 4) Cache sémantique
    ck = cache.key(message, cls["perimetre"])
    cached = cache.get(ck)
    if cached:
        # On conserve le rattachement au fil courant et on journalise l'échange
        # (sinon un message servi par le cache n'apparaîtrait pas dans l'historique).
        out = {**cached, "meta": {**cached["meta"], "cache_hit": True,
                                  "conversation_id": conversation_id}}
        _audit(db, user, message, out)
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

    # Consigne de langue : l'IA répond dans la langue du message de l'utilisateur.
    lang_note, lang = _lang_directive(message)
    meta["lang"] = lang
    # Orientation copilote RH/manager (profil audience=rh, déjà validé par le RBAC en amont).
    pilot_note = RH_PILOT_NOTE if meta.get("audience") == "rh" else ""
    suffix = lang_note + pilot_note

    # ── Culture générale : on contourne entièrement le RAG ──
    if mode == "general":
        masked, mapping = (pii.mask(message) if settings.PII_MASKING else (message, {}))
        meta["pii_masked"] = bool(mapping)
        out = ai_service.complete(SYSTEM_PROMPT_GENERAL + suffix, masked, history)
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
        out = ai_service.complete(eng["system"] + suffix, masked, history)
        return _finalize(db, user, message, out, meta, want_judge, ck, eng["system"])

    # ── E1 · RAG documentaire : récupération filtrée par rôle + reranking (ChromaDB) ──
    meta["engine"] = "E1"
    docs = retrieval.retrieve(message, user.role) if settings.RAG_ENABLED else []
    meta["sources"] = [{"id": d["id"], "title": d["title"], "score": d["score"]} for d in docs]
    meta["no_doc"] = not docs
    # Plus de refus sec en l'absence de document : l'anti-invention est gérée par le
    # prompt RH (donnée interne -> uniquement si sourcée ; connaissance générale RH ->
    # réponse autorisée). On laisse donc le LLM répondre dans tous les cas.

    # Construction du prompt enrichi (contexte + sources)
    sources_txt = "\n".join(f"- {d['title']} : {d['text']}" for d in docs) or "(aucune)"
    enriched = (f"Contexte utilisateur : rôle={user.role}.\n"
                f"Sources internes autorisées :\n{sources_txt}\n\n"
                f"Question : {message}")

    # Masquage PII avant LLM externe
    masked, mapping = (pii.mask(enriched) if settings.PII_MASKING else (enriched, {}))
    meta["pii_masked"] = bool(mapping)

    out = ai_service.complete(SYSTEM_PROMPT_RH + suffix, masked, history)
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
