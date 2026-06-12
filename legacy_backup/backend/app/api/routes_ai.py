from fastapi import APIRouter, HTTPException

from app.ai.pipeline import run_chat_pipeline
from app.ai.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "ai"}


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        return run_chat_pipeline(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
