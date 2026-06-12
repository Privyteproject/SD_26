import requests

from app.ai.providers.base import LLMProvider, LLMRequest, LLMResponse
from app.core.config import settings


class OpenRouterProvider(LLMProvider):
    def generate(self, request: LLMRequest) -> LLMResponse:
        if not settings.OPENROUTER_API_KEY:
            raise RuntimeError("OPENROUTER_API_KEY is missing. Configure it in your .env file.")

        if not request.messages:
            raise ValueError("LLMRequest.messages cannot be empty.")

        resolved_model = request.options.model or settings.OPENROUTER_MODEL_GENERAL
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
                    {"role": message.role, "content": message.content}
                    for message in request.messages
                ],
                "temperature": request.options.temperature,
                "max_tokens": request.options.max_tokens,
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
            content = payload["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError("OpenRouter returned an unexpected response payload.") from exc

        return LLMResponse(content=content, model=resolved_model, raw=payload)
