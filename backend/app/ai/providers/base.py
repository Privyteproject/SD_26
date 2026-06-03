from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 1000,
    ) -> str:
        raise NotImplementedError
