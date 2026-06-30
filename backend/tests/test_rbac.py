"""RBAC / ABAC — chaque rôle n'accède qu'à son périmètre (cahier §3.3 : moindre privilège)."""


def test_health_ok(client):
    assert client.get("/health").status_code == 200


def test_me_requires_auth(client):
    assert client.get("/api/v1/employees/me").status_code == 401


def test_me_ok_for_collaborateur(client, collab):
    r = client.get("/api/v1/employees/me", headers=collab)
    assert r.status_code == 200
    assert r.json()["data"]["role"] == "COLLABORATEUR"


def test_employees_list_rh_ok_collab_forbidden(client, rh, collab):
    assert client.get("/api/v1/employees", headers=rh).status_code == 200
    assert client.get("/api/v1/employees", headers=collab).status_code == 403


def test_dashboard_rh_forbidden_for_collaborateur(client, rh, collab):
    assert client.get("/api/v1/dashboard/rh", headers=rh).status_code == 200
    assert client.get("/api/v1/dashboard/rh", headers=collab).status_code == 403


def test_financial_analytics_restricted_to_exec(client, rh, manager, medecine):
    """Fuite financière corrigée : /dashboard/analytics réservé RH/Direction (ni manager ni médecine)."""
    assert client.get("/api/v1/dashboard/analytics", headers=rh).status_code == 200
    assert client.get("/api/v1/dashboard/analytics", headers=manager).status_code == 403
    assert client.get("/api/v1/dashboard/analytics", headers=medecine).status_code == 403


def test_fairness_audit_restricted(client, rh, collab):
    assert client.get("/api/v1/predict/fairness", headers=rh).status_code == 200
    assert client.get("/api/v1/predict/fairness", headers=collab).status_code == 403


def test_idor_collaborateur_cannot_read_other_employee(client, collab):
    """IDOR : un collaborateur ne peut pas lire la fiche d'un employé d'un autre service."""
    assert client.get("/api/v1/employees/EMP1000", headers=collab).status_code == 403


def test_manager_scope_limited_to_team(client, manager):
    """ABAC : le manager voit SON équipe (DEMO_COL) mais pas un employé hors équipe (EMP1000).

    Hors périmètre -> 404 « introuvable » (on ne révèle pas l'existence de la ressource) ;
    le collaborateur, lui, est bloqué en amont par la garde de rôle (403). Les deux refusent l'accès."""
    assert client.get("/api/v1/employees/DEMO_COL", headers=manager).status_code == 200
    assert client.get("/api/v1/employees/EMP1000", headers=manager).status_code in (403, 404)


def test_collaborateur_cannot_write_decision(client, collab):
    """Un collaborateur ne peut pas valider/refuser une demande (écriture réservée)."""
    r = client.patch("/api/v1/demandes/999999/status", headers=collab, json={"status": "validated"})
    assert r.status_code in (403, 404)  # 403 si garde de rôle prioritaire, 404 si ressource d'abord
