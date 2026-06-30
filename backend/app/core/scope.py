"""Périmètre d'accès (scope) par rôle — centralise la règle « manager = son équipe ».

- RH / Direction / Admin : périmètre ORGANISATION (pas de restriction de département).
- Manager : strictement SON département.
- Collaborateur : ses propres données (géré au cas par cas via _own_matricule).

Objectif : une seule source de vérité du scope, réutilisée par les endpoints qui agissent
sur des individus (demandes, absences, tickets, fiche employé, plan d'action…), au lieu des
helpers _dept_for/_mgr_dept dupliqués. Conforme §3.3 (moindre privilège).
"""

from app.core.security import ROLE_MANAGER
from app.db import repository as repo


def manager_dept_id(db, user):
    """id_departement du manager. Renvoie None si le rôle a une vue organisation
    (RH/Direction/Admin) — à ne PAS confondre avec un manager sans département."""
    if getattr(user, "role", None) != ROLE_MANAGER:
        return None
    emp = repo.find_employee_by_email(db, user.email)
    return emp.id_departement if emp else None


def is_org_view(user) -> bool:
    """True si le rôle voit toute l'organisation (RH/Direction/Admin)."""
    return getattr(user, "role", None) != ROLE_MANAGER


def is_in_scope(db, user, matricule) -> bool:
    """Le matricule est-il dans le périmètre du user ?
    Org (RH/Direction/Admin) → toujours True. Manager → uniquement son département
    (et périmètre vide si le manager n'a pas de département)."""
    if is_org_view(user):
        return True
    mgr = repo.find_employee_by_email(db, user.email)
    if mgr is None or mgr.id_departement is None:
        return False
    emp = repo.get_employee(db, matricule)
    return bool(emp and emp.id_departement == mgr.id_departement)
