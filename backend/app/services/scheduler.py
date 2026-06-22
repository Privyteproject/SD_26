"""Ordonnanceur de tâches périodiques (APScheduler).


Rend RÉELLEMENT automatiques deux traitements jusqu'ici déclenchés à la main :
- détection des étapes d'onboarding en retard -> alertes RH (§3.1) ;
- scoring ML des risques + recalcul des alertes préventives / KPI (§3.2).

Chaque job ouvre sa propre session SQLAlchemy et l'isole (try/except + close).
Désactivable via la variable d'environnement SCHEDULER_ENABLED=false.
"""

import logging
import os

log = logging.getLogger("scheduler")
_scheduler = None


def _job_check_overdue():
    from app.db.base import SessionLocal
    from app.db import repository as repo
    db = SessionLocal()
    try:
        res = repo.check_overdue_onboarding(db)
        log.info("Job onboarding en retard : %s", res)
    except Exception as exc:  # un job ne doit jamais tuer l'ordonnanceur
        log.exception("Job check_overdue échoué : %s", exc)
    finally:
        db.close()


def _job_batch_score():
    from app.db.base import SessionLocal
    from app.services import ml_predictions
    db = SessionLocal()
    try:
        res = ml_predictions.batch_score(db)
        log.info("Job scoring ML : %s", res)
    except Exception as exc:
        log.exception("Job batch_score échoué : %s", exc)
    finally:
        db.close()


def start() -> None:
    """Démarre l'ordonnanceur (idempotent). À appeler au démarrage de l'app."""
    global _scheduler
    if _scheduler is not None:
        return
    if os.getenv("SCHEDULER_ENABLED", "true").lower() in ("0", "false", "no"):
        log.info("Ordonnanceur désactivé (SCHEDULER_ENABLED=false).")
        return
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        from apscheduler.triggers.interval import IntervalTrigger
    except Exception as exc:
        log.warning("APScheduler indisponible (%s) — ordonnanceur non démarré.", exc)
        return

    sch = BackgroundScheduler(timezone="UTC")
    # Étapes d'onboarding en retard : tous les jours à 07:00 + un passage 30 s après le boot.
    from datetime import datetime, timedelta, timezone as _tz
    soon = datetime.now(_tz.utc) + timedelta(seconds=30)
    sch.add_job(_job_check_overdue, CronTrigger(hour=7, minute=0),
                id="check_overdue", replace_existing=True, max_instances=1)
    sch.add_job(_job_check_overdue, "date", run_date=soon,
                id="check_overdue_boot", replace_existing=True)
    # Scoring ML : toutes les 24 h (job nocturne) — décalé pour ne pas surcharger le boot.
    sch.add_job(_job_batch_score, IntervalTrigger(hours=24),
                id="batch_score", replace_existing=True, max_instances=1,
                next_run_time=datetime.now(_tz.utc) + timedelta(minutes=2))
    sch.start()
    _scheduler = sch
    log.info("Ordonnanceur démarré. Jobs : %s", [j.id for j in sch.get_jobs()])


def status() -> dict:
    """État de l'ordonnanceur : actif + jobs planifiés avec leur prochaine exécution."""
    if _scheduler is None:
        return {"running": False, "jobs": []}
    jobs = [{"id": j.id, "next_run": j.next_run_time.isoformat() if j.next_run_time else None}
            for j in _scheduler.get_jobs()]
    return {"running": _scheduler.running, "jobs": jobs}


def shutdown() -> None:
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass
        _scheduler = None
