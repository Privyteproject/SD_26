import requests

from app.ai.providers.base import LLMProvider
from app.core.config import settings


class OpenRouterProvider(LLMProvider):
    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 1000,
    ) -> str:
        if not settings.OPENROUTER_API_KEY:
            raise RuntimeError("OPENROUTER_API_KEY is missing. Configure it in your .env file.")

        resolved_model = model or settings.OPENROUTER_MODEL_GENERAL
        response = requests.post(
            f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "HTTP-Referer": settings.OPENROUTER_SITE_URL,
                "X-Title": settings.OPENROUTER_APP_NAME,
                "Content-Type": "application/json",
            },
            json={
                "model": resolved_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
            timeout=60,
        )

        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            detail = response.text[:1000]
            raise RuntimeError(f"OpenRouter request failed: {detail}") from exc

        payload = response.json()
        try:
            return payload["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError("OpenRouter returned an unexpected response payload.") from exc
