from app.ai.providers.base import LLMProvider
from app.ai.providers.openrouter_provider import OpenRouterProvider


def get_llm_provider() -> LLMProvider:
    return OpenRouterProvider()
