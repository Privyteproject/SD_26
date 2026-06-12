from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal


LLMRole = Literal["system", "user", "assistant"]


@dataclass(frozen=True)
class LLMMessage:
    role: LLMRole
    content: str


@dataclass(frozen=True)
class LLMGenerationOptions:
    model: str | None = None
    temperature: float = 0.2
    max_tokens: int = 1000


@dataclass(frozen=True)
class LLMRequest:
    messages: list[LLMMessage]
    options: LLMGenerationOptions = field(default_factory=LLMGenerationOptions)


@dataclass(frozen=True)
class LLMResponse:
    content: str
    model: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class LLMProvider(ABC):
    @abstractmethod
    def generate(self, request: LLMRequest) -> LLMResponse:
        raise NotImplementedError

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 1000,
    ) -> str:
        request = LLMRequest(
            messages=[
                LLMMessage(role="system", content=system_prompt),
                LLMMessage(role="user", content=user_prompt),
            ],
            options=LLMGenerationOptions(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
            ),
        )
        return self.generate(request).content
