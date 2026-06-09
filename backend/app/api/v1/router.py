"""API v1 router — aggregates all resource routers under /api/v1."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    absences,
    alerts,
    analytics,
    audit_logs,
    departments,
    disengagement,
    documents,
    employees,
    imports,
    notifications,
    offboarding,
    onboarding,
    supervision,
    users,
)

api_router = APIRouter()

api_router.include_router(
    departments.router,
    prefix="/departments",
    tags=["Departments"],
)
api_router.include_router(
    employees.router,
    prefix="/employees",
    tags=["Employees"],
)
api_router.include_router(
    absences.router,
    prefix="/absences",
    tags=["Absences"],
)
api_router.include_router(
    documents.router,
    prefix="/documents",
    tags=["Documents"],
)
api_router.include_router(
    imports.router,
    prefix="/imports",
    tags=["Imports"],
)
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"],
)
api_router.include_router(
    notifications.router,
    prefix="/notifications",
    tags=["Notifications"],
)
api_router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["Analytics"],
)
api_router.include_router(
    audit_logs.router,
    prefix="/audit-logs",
    tags=["Audit Logs"],
)
api_router.include_router(
    alerts.router,
    prefix="/alerts",
    tags=["Security Alerts"],
)
api_router.include_router(
    disengagement.router,
    prefix="/disengagement",
    tags=["Disengagement"],
)
api_router.include_router(
    supervision.router,
    prefix="/supervision",
    tags=["AI Supervision"],
)
api_router.include_router(
    onboarding.router,
    prefix="/onboarding",
    tags=["Onboarding"],
)
api_router.include_router(
    offboarding.router,
    prefix="/offboarding",
    tags=["Offboarding"],
)
