"""Données & ML — déterminisme du jeu, équité (biais), exclusion des attributs protégés, consentement.

Couvre le cahier §4.1 (prévention des biais) et §3.3/§4.4 (consentement, conformité)."""

import pytest
from sqlalchemy import func, select


def test_seed_deterministic_120_unique(db):
    """Jeu déterministe (seed=42) : 120 employés, noms complets UNIQUES, matricules contigus."""
    from app.db.models import Employe
    assert db.scalar(select(func.count()).select_from(Employe)) == 120
    dups = db.execute(select(Employe.prenom, Employe.nom)
                      .group_by(Employe.prenom, Employe.nom).having(func.count() > 1)).all()
    assert dups == []
    e = db.get(Employe, "EMP1005")             # ancrage déterministe
    assert (e.prenom, e.nom) == ("Nawal", "Bargach")
    nums = sorted(int(m[3:]) for (m,) in db.execute(select(Employe.matricule)).all() if m.startswith("EMP"))
    assert nums[0] == 1000 and nums == list(range(nums[0], nums[-1] + 1))


def test_all_emails_company_domain(db):
    """Aucune adresse hors @waminey.ma (pas de donnée résiduelle d'un ancien jeu)."""
    from app.db.models import Utilisateur
    assert db.scalar(select(func.count()).select_from(Utilisateur)
                     .where(~Utilisateur.email.like("%@waminey.ma"))) == 0


def test_protected_attributes_excluded_from_features():
    """Aucun attribut protégé (âge, genre, site, contrat) dans les variables du modèle (anti-biais)."""
    ml = pytest.importorskip("app.services.ml_predictions")
    protected = set(ml._PROTECTED)
    for feats in (ml.F_TURNOVER, ml.F_BURNOUT, ml.F_DESENGAGEMENT):
        assert not (set(feats) & protected), f"attribut protégé présent dans {feats}"


def test_fairness_audit_runs(db):
    """L'audit d'équité produit des ratios (règle des 4/5 — disparate impact)."""
    pytest.importorskip("sklearn")
    from app.services import ml_predictions as ml
    ml.batch_score(db)
    audit = ml.fairness_audit(db)
    assert isinstance(audit, dict) and audit


def test_consent_revocation_excludes_from_ml_scoring(db):
    """Consentement retiré -> le collaborateur est EXCLU du scoring de désengagement."""
    pytest.importorskip("sklearn")
    from app.db import repository as repo
    from app.db.models import ScoreRisque
    from app.services import ml_predictions as ml

    ml.batch_score(db)
    db.expire_all()
    mat = db.scalar(select(ScoreRisque.matricule).where(ScoreRisque.type == "desengagement"))
    assert mat is not None  # au moins un employé scoré

    def scored(m):
        return db.scalar(select(func.count()).select_from(ScoreRisque)
                         .where(ScoreRisque.matricule == m, ScoreRisque.type == "desengagement")) or 0

    assert scored(mat) >= 1
    repo.set_consentement(db, matricule=mat, finalite="detection_desengagement", accorde=False)
    ml.batch_score(db)
    db.expire_all()
    assert scored(mat) == 0
    repo.set_consentement(db, matricule=mat, finalite="detection_desengagement", accorde=True)
    ml.batch_score(db)
    db.expire_all()


def test_chat_messages_encrypted_at_rest(client, chat, collab, db):
    """Les messages de chat sont chiffrés au repos (lecture déchiffrée à la volée)."""
    chat(collab, "ma fiche de paie")  # crée des messages
    from app.db.models import ChatMessage
    raw = db.scalar(select(ChatMessage.content).order_by(ChatMessage.created_at.desc()).limit(1))
    assert raw is not None and raw.startswith("enc:v1:")  # chiffré en base


def test_anonymization_removes_direct_identifiers(db):
    """Droit à l'effacement : anonymisation retire les identifiants directs, garde la ligne pseudonymisée."""
    from app.db import repository as repo
    from app.db.models import Employe
    from app.services import crypto
    from app.db.models import DossierConfidentiel

    repo.delete_employee(db, "ZZ_T")  # idempotent
    db.add(Employe(matricule="ZZ_T", nom="Réel", prenom="Nom", statut="ACTIVE",
                   telephone="0600000000", bio="confidentiel"))
    db.add(DossierConfidentiel(matricule="ZZ_T", cin=crypto.encrypt("BK111111"),
                               adresse=crypto.encrypt("1 rue")))
    db.commit()
    assert repo.anonymize_employee(db, "ZZ_T") is True
    db.expire_all()
    e = db.get(Employe, "ZZ_T")
    assert e.anonymise is True and e.nom == "Anonymisé" and e.telephone is None
    assert repo.get_dossier_confidentiel(db, "ZZ_T") is None
    repo.delete_employee(db, "ZZ_T")  # nettoyage
