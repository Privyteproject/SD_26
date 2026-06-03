from app.ai.audit import write_audit_log, write_supervision_alert
from app.ai.classifier import classify_rh_request_type, classify_scope, is_general_knowledge_allowed
from app.ai.normalizer import normalize_user_message
from app.ai.prompts import GENERAL_SYSTEM_PROMPT, RH_SYSTEM_PROMPT, build_general_prompt, build_rh_prompt
from app.ai.providers.factory import get_llm_provider
from app.ai.rag.retriever import (
    build_documents_context,
    filter_documents_by_confidence,
    retrieve_authorized_documents,
)
from app.ai.rbac import ROLE_PERMISSIONS, is_authorized
from app.ai.response_filter import post_filter_answer
from app.ai.schemas import ChatRequest, ChatResponse, Source
from app.ai.security import security_prefilter
from app.core.config import settings


OFF_TOPIC_ANSWER = (
    "Je peux vous aider principalement sur les sujets RH ou les questions generales autorisees. "
    "Reformulez votre demande si besoin."
)
SECURITY_REFUSAL = "Je ne peux pas traiter cette demande pour des raisons de securite."
AUTHORIZATION_REFUSAL = (
    "Je ne peux pas repondre a cette demande avec votre niveau d'autorisation. "
    "Merci de vous rapprocher d'un referent RH."
)
INSUFFICIENT_CONTEXT_REFUSAL = (
    "Je ne dispose pas de suffisamment de documents RH fiables pour repondre correctement a cette demande. "
    "Merci de vous rapprocher d'un referent RH."
)


def _build_sources(documents: list[dict]) -> list[Source]:
    sources: list[Source] = []
    for document in documents:
        text = document.get("text", "")
        metadata = document.get("metadata", {})
        sources.append(
            Source(
                document_id=document["document_id"],
                title=metadata.get("title", document["document_id"]),
                excerpt=text[:280],
                score=document.get("score"),
                metadata=metadata,
            )
        )
    return sources


def _log_event(
    request: ChatRequest,
    decision: str,
    scope: str,
    request_type: str,
    reason: str | None = None,
    model: str | None = None,
    sources: list[Source] | None = None,
) -> None:
    write_audit_log(
        {
            "event_type": "chat_request",
            "user_id": request.user_context.user_id,
            "role": request.user_context.role,
            "message": request.message,
            "decision": decision,
            "request_type": request_type,
            "scope": scope,
            "reason": reason,
            "model": model,
            "sources": [source.document_id for source in (sources or [])],
        }
    )


def _emit_supervision_alert(
    request: ChatRequest,
    reason: str,
    request_type: str,
    scope: str,
) -> None:
    write_supervision_alert(
        user_id=request.user_context.user_id,
        role=request.user_context.role,
        reason=reason,
        request_type=request_type,
        scope=scope,
        message=request.message,
    )


def _append_source_references(answer: str, sources: list[Source]) -> str:
    if not sources or "Sources:" in answer:
        return answer
    references = ", ".join(f"{source.title} ({source.document_id})" for source in sources[:3])
    return f"{answer}\n\nSources: {references}"


def run_chat_pipeline(request: ChatRequest) -> ChatResponse:
    normalized_message = normalize_user_message(request.message)
    if not normalized_message:
        raise ValueError("The message cannot be empty.")

    security_result = {"is_blocked": False, "reason": None, "risk_type": None, "severity": None}
    if settings.ENABLE_SECURITY_FILTER:
        security_result = security_prefilter(normalized_message)
        if security_result["is_blocked"]:
            _emit_supervision_alert(
                request,
                reason=str(security_result["reason"]),
                request_type="security_block",
                scope="dangerous",
            )
            _log_event(
                request,
                decision="blocked",
                scope="dangerous",
                request_type="security_block",
                reason=str(security_result["reason"]),
            )
            return ChatResponse(
                answer=SECURITY_REFUSAL,
                scope="dangerous",
                request_type="security_block",
                decision="blocked",
                warnings=[str(security_result["reason"])],
                routed_to_human=False,
            )

    scope = classify_scope(normalized_message)
    if scope == "dangerous":
        _emit_supervision_alert(
            request,
            reason="Dangerous scope detected.",
            request_type="dangerous",
            scope=scope,
        )
        _log_event(
            request,
            decision="blocked",
            scope=scope,
            request_type="dangerous",
            reason="Dangerous scope detected.",
        )
        return ChatResponse(
            answer=SECURITY_REFUSAL,
            scope=scope,
            request_type="dangerous",
            decision="blocked",
            warnings=["Dangerous request detected."],
            routed_to_human=False,
        )

    if scope == "off_topic":
        _log_event(
            request,
            decision="redirected",
            scope=scope,
            request_type="off_topic",
        )
        return ChatResponse(
            answer=OFF_TOPIC_ANSWER,
            scope=scope,
            request_type="off_topic",
            decision="redirected",
            warnings=[],
            routed_to_human=False,
        )

    provider = get_llm_provider()

    if scope == "general_knowledge":
        effective_permissions = ROLE_PERMISSIONS.get(
            request.user_context.role.lower().strip(), set()
        ).union(request.user_context.permissions)
        if "ask_general_knowledge" not in effective_permissions:
            _log_event(
                request,
                decision="denied",
                scope=scope,
                request_type="general_knowledge",
                reason="Missing ask_general_knowledge permission.",
            )
            return ChatResponse(
                answer=AUTHORIZATION_REFUSAL,
                scope=scope,
                request_type="general_knowledge",
                decision="denied",
                warnings=["Missing permission: ask_general_knowledge."],
                routed_to_human=False,
            )
        if not is_general_knowledge_allowed(normalized_message):
            _emit_supervision_alert(
                request,
                reason="General knowledge request rejected after classification.",
                request_type="general_knowledge",
                scope=scope,
            )
            _log_event(
                request,
                decision="denied",
                scope=scope,
                request_type="general_knowledge",
                reason="General knowledge request not allowed.",
            )
            return ChatResponse(
                answer=SECURITY_REFUSAL,
                scope=scope,
                request_type="general_knowledge",
                decision="denied",
                warnings=["General knowledge request rejected."],
                routed_to_human=False,
            )

        answer = provider.generate(
            system_prompt=GENERAL_SYSTEM_PROMPT,
            user_prompt=build_general_prompt(normalized_message),
            model=settings.OPENROUTER_MODEL_GENERAL,
        )
        filtered = post_filter_answer(answer, scope=scope, request_type="general_knowledge")
        if not filtered["is_valid"]:
            _emit_supervision_alert(
                request,
                reason="Post-filter blocked general answer.",
                request_type="general_knowledge",
                scope=scope,
            )
        _log_event(
            request,
            decision="allowed" if filtered["is_valid"] else "blocked",
            scope=scope,
            request_type="general_knowledge",
            model=settings.OPENROUTER_MODEL_GENERAL,
        )
        return ChatResponse(
            answer=str(filtered["answer"]),
            scope=scope,
            request_type="general_knowledge",
            decision="allowed" if filtered["is_valid"] else "blocked",
            warnings=list(filtered["warnings"]),
            routed_to_human=False,
        )

    request_type = classify_rh_request_type(normalized_message)
    if settings.ENABLE_RBAC and not is_authorized(request.user_context, request_type):
        _emit_supervision_alert(
            request,
            reason="RBAC denied request.",
            request_type=request_type,
            scope=scope,
        )
        _log_event(
            request,
            decision="denied",
            scope=scope,
            request_type=request_type,
            reason="RBAC denied request.",
        )
        return ChatResponse(
            answer=AUTHORIZATION_REFUSAL,
            scope=scope,
            request_type=request_type,
            decision="denied",
            warnings=["RBAC denied this HR request."],
            routed_to_human=True,
        )

    documents = retrieve_authorized_documents(normalized_message, request.user_context, settings.RAG_TOP_K)
    trusted_documents = filter_documents_by_confidence(documents, settings.RAG_MIN_CONFIDENCE)
    if not trusted_documents:
        _emit_supervision_alert(
            request,
            reason="No trusted HR documents matched the request.",
            request_type=request_type,
            scope=scope,
        )
        _log_event(
            request,
            decision="redirected",
            scope=scope,
            request_type=request_type,
            reason="No trusted HR documents matched the request.",
        )
        return ChatResponse(
            answer=INSUFFICIENT_CONTEXT_REFUSAL,
            scope=scope,
            request_type=request_type,
            decision="redirected",
            warnings=["No trusted HR source matched the request."],
            routed_to_human=True,
        )

    documents_context = build_documents_context(trusted_documents)
    answer = provider.generate(
        system_prompt=RH_SYSTEM_PROMPT,
        user_prompt=build_rh_prompt(normalized_message, request.user_context, documents_context),
        model=settings.OPENROUTER_MODEL_RH,
    )
    filtered = post_filter_answer(answer, scope=scope, request_type=request_type)
    sources = _build_sources(trusted_documents)
    warnings = list(filtered["warnings"])

    if security_result.get("risk_type") == "sensitive_data_extraction":
        warnings.append("Sensitive request detected: response constrained by permissions.")
        _emit_supervision_alert(
            request,
            reason="Sensitive HR request detected.",
            request_type=request_type,
            scope=scope,
        )

    final_answer = _append_source_references(str(filtered["answer"]), sources)
    if not filtered["is_valid"]:
        _emit_supervision_alert(
            request,
            reason="Post-filter blocked HR answer.",
            request_type=request_type,
            scope=scope,
        )

    _log_event(
        request,
        decision="allowed" if filtered["is_valid"] else "blocked",
        scope=scope,
        request_type=request_type,
        model=settings.OPENROUTER_MODEL_RH,
        sources=sources,
    )
    return ChatResponse(
        answer=final_answer,
        scope=scope,
        request_type=request_type,
        decision="allowed" if filtered["is_valid"] else "blocked",
        sources=sources,
        warnings=warnings,
        routed_to_human=request_type in {"sensitive"} or not sources,
    )
