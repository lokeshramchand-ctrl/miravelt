"""Scheduled housekeeping (PROJECT_AUDIT.md F20).

`core/retention_manager.py` already knew how to delete original PDFs older
than PDF_RETENTION_DAYS, old audit logs, expired nonces and revoked
sessions - but only when an admin pressed the button
(POST /admin/retention/cleanup). The privacy page promises the deletion, so
it runs on the beat schedule; the button stays for an immediate run.
"""
import logging

from core.retention_manager import retention_manager
from tasks.celery_app import celery_app, run_async

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.maintenance_tasks.run_retention_cleanup")
def run_retention_cleanup():
    return run_async(retention_manager.run_full_retention_cleanup())
