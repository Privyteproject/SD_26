"""Service Assistant IA — via OpenRouter (API compatible OpenAI).

Deux modèles :
- AGENT_MODEL (réponses de l'agent RH)  ex. google/gemma-4-31b-it
- JUDGE_MODEL (évaluation « LLM-as-judge ») ex. qwen/qwen3.6-27b

Sans `OPENROUTER_API_KEY` : repli déterministe (mode démo, sans réseau).
Appel HTTP via urllib (stdlib), aucune dépendance externe.
"""

import json
import re
import urllib.error
import urllib.request

from app.core.config import settings

SYSTEM_PROMPT = (
    "Tu es l'assistant RH de la plateforme « Synapse Digital ». "
    "Tu réponds en français, de façon concise, professionnelle et bienveillante. "
    "Tu aides les collaborateurs et les RH sur les démarches : congés et absences, "
    "documents administratifs, onboarding/offboarding, et questions RH générales. "
    "Tu n'inventes JAMAIS de données personnelles, de soldes de congés ni de décisions ; "
    "pour toute information précise sur un dossier, invite la personne à consulter le "
    "module correspondant de l'application ou son référent RH. "
    "Tu ne donnes pas de conseil juridique ou médical : tu orientes vers la personne compétente."
)

JUDGE_PROMPT = (
    "Tu es un évaluateur qualité d'un assistant RH. On te donne une QUESTION "
    "d'un utilisateur et la REPONSE de l'assistant. Évalue la réponse selon : "
    "pertinence, exactitude, sécurité (pas d'invention de données ni de conseil "
    "juridique/médical), et ton professionnel. "
    "Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, de la forme : "
    '{"note": <entier 1-5>, "verdict": "<excellent|correct|insuffisant>", '
    '"justification": "<1-2 phrases>", '
    '"criteres": {"pertinence": <1-5>, "exactitude": <1-5>, "securite": <1-5>, "ton": <1-5>}}'
)


# ───────────── Cœur HTTP ─────────────
def _chat(model: str, messages: list[dict], max_tokens: int) -> dict:
    body = json.dumps({"model": model, "max_tokens": max_tokens, "messages": messages}).encode("utf-8")
    req = urllib.request.Request(
        f"{settings.OPENROUTER_BASE_URL}/chat/completions",
        data=body, method="POST",
        headers={
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.OPENROUTER_SITE_URL,
            "X-Title": settings.OPENROUTER_APP_NAME,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:  # noqa: S310
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "ignore")
        raise RuntimeError(f"OpenRouter {exc.code} ({model}): {detail[:300]}") from exc
    choice = (data.get("choices") or [{}])[0]
    text = (choice.get("message") or {}).get("content", "") or ""
    usage = data.get("usage") or {}
    return {
        "text": text.strip(),
        "model": data.get("model", model),
        "usage": {"input_tokens": usage.get("prompt_tokens"),
                  "output_tokens": usage.get("completion_tokens")},
    }


def _extract_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*", "", t).strip().rstrip("`").strip()
    i, j = t.find("{"), t.rfind("}")
    if i != -1 and j != -1:
        t = t[i : j + 1]
    return json.loads(t)


# ───────────── Mode démo ─────────────
def _stub_reply(message: str, name: str) -> dict:
    prenom = (name.split(" ")[0] if name else "") or "collègue"
    return {
        "reply": (f"Bonjour {prenom}. L'assistant fonctionne en mode démo "
                  f"(clé OpenRouter non configurée). Votre message : « {message} ». "
                  f"Définissez OPENROUTER_API_KEY pour activer les réponses du modèle."),
        "model": "stub", "degraded": True,
    }


def _stub_judge() -> dict:
    return {
        "note": None, "verdict": "non-évalué",
        "justification": "Juge en mode démo (clé OpenRouter non configurée).",
        "criteres": {}, "model": "stub", "degraded": True,
    }


# ───────────── API publique ─────────────
def complete(system_prompt: str, message: str, history: list | None = None) -> dict:
    """Appel générique agent + repli sur FALLBACK_MODEL en cas d'erreur.
    Renvoie {reply, model, degraded, usage, fallback_used}."""
    if not settings.OPENROUTER_API_KEY:
        s = _stub_reply(message, "")
        return {"reply": s["reply"], "model": "stub", "degraded": True,
                "usage": {}, "fallback_used": False}
    messages = [{"role": "system", "content": system_prompt}]
    for t in (history or []):
        role = getattr(t, "role", None) or t.get("role")
        content = getattr(t, "content", None) or t.get("content")
        messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})
    try:
        out = _chat(settings.AGENT_MODEL, messages, settings.AI_MAX_TOKENS)
        return {"reply": out["text"], "model": out["model"], "degraded": False,
                "usage": out["usage"], "fallback_used": False}
    except RuntimeError:
        out = _chat(settings.FALLBACK_MODEL, messages, settings.AI_MAX_TOKENS)
        return {"reply": out["text"], "model": out["model"], "degraded": False,
                "usage": out["usage"], "fallback_used": True}


def refine(question: str, previous_answer: str, feedback: str, system_prompt: str) -> dict:
    """Reformule une réponse jugée non conforme, à partir du retour du juge."""
    msg = (f"Question initiale : {question}\n\nRéponse précédente : {previous_answer}\n\n"
           f"Retour qualité : {feedback}\n\nReformule une meilleure réponse, concise et conforme.")
    return complete(system_prompt, msg, [])


def generate_reply(message: str, history: list, name: str) -> dict:
    """Réponse de l'agent (AGENT_MODEL)."""
    if not settings.OPENROUTER_API_KEY:
        return _stub_reply(message, name)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": t.role, "content": t.content} for t in history]
    messages.append({"role": "user", "content": message})
    out = _chat(settings.AGENT_MODEL, messages, settings.AI_MAX_TOKENS)
    return {"reply": out["text"], "model": out["model"], "degraded": False, "usage": out["usage"]}


def judge_reply(question: str, answer: str) -> dict:
    """Évaluation de la réponse par le modèle juge (JUDGE_MODEL)."""
    if not settings.OPENROUTER_API_KEY:
        return _stub_judge()
    messages = [
        {"role": "system", "content": JUDGE_PROMPT},
        {"role": "user", "content": f"QUESTION:\n{question}\n\nREPONSE:\n{answer}"},
    ]
    out = _chat(settings.JUDGE_MODEL, messages, 400)
    try:
        verdict = _extract_json(out["text"])
    except Exception:
        verdict = {"note": None, "verdict": "indéterminé",
                   "justification": "Réponse du juge non parsable.", "criteres": {},
                   "raw": out["text"][:300]}
    verdict["model"] = out["model"]
    verdict["degraded"] = False
    return verdict
