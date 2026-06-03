from app.ai.schemas import UserContext


ROLE_PERMISSIONS: dict[str, set[str]] = {
    "collaborateur": {
        "ask_general_rh",
        "ask_own_data",
        "generate_own_documents",
        "ask_general_knowledge",
    },
    "manager": {
        "ask_general_rh",
        "ask_team_data",
        "view_team_kpi",
        "ask_general_knowledge",
    },
    "rh": {
        "ask_general_rh",
        "ask_employee_data",
        "generate_documents",
        "manage_onboarding",
        "manage_offboarding",
        "view_sensitive_rh",
        "ask_general_knowledge",
    },
    "direction": {
        "ask_general_rh",
        "view_global_kpi",
        "view_predictive_analytics",
        "ask_general_knowledge",
    },
    "admin": {
        "view_audit_logs",
        "manage_security_alerts",
        "ask_general_knowledge",
    },
}

REQUEST_TYPE_RULES: dict[str, set[str]] = {
    "simple_rh_question": {"collaborateur", "manager", "rh", "direction"},
    "document_generation": {"collaborateur", "rh"},
    "onboarding": {"rh"},
    "offboarding": {"rh"},
    "predictive": {"rh", "direction"},
    "sensitive": {"rh", "direction"},
}

REQUEST_TYPE_PERMISSIONS: dict[str, set[str]] = {
    "simple_rh_question": {"ask_general_rh"},
    "document_generation": {"generate_own_documents", "generate_documents"},
    "onboarding": {"manage_onboarding"},
    "offboarding": {"manage_offboarding"},
    "predictive": {"view_predictive_analytics", "view_sensitive_rh"},
    "sensitive": {"view_sensitive_rh"},
}


def is_authorized(user_context: UserContext, request_type: str) -> bool:
    role = user_context.role.lower().strip()
    if role not in REQUEST_TYPE_RULES.get(request_type, set()):
        return False

    effective_permissions = ROLE_PERMISSIONS.get(role, set()).union(user_context.permissions)
    required_permissions = REQUEST_TYPE_PERMISSIONS.get(request_type, set())
    if request_type == "document_generation" and role == "collaborateur":
        return "generate_own_documents" in effective_permissions
    return bool(required_permissions.intersection(effective_permissions))
