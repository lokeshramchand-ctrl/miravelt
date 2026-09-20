"""
Executes feedback/retraining_queue.py's previously-unimplemented step
("Launch BaselineTrainer().run_benchmarks() via Celery asynchronously
here") now that a real broker exists (tasks/celery_app.py).

This only fixes the "nothing ever launches the trainer" half of
docs/16-known-issues-tech-debt.md §16.5. `training/train.py::load_data()`
still generates synthetic data - wiring a real executor and replacing the
training data with a real MongoDB-backed dataset are two separate pieces of
work, and this deliberately doesn't paper over the second one.
"""
import logging

from feedback.retraining_queue import retraining_manager
from tasks.celery_app import celery_app, run_async

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.retraining_tasks.check_and_trigger_retraining")
def check_and_trigger_retraining():
    """Runs on RETRAINING_CHECK_INTERVAL_MINUTES - the polling side of what
    feedback/api_router.py already triggers inline via BackgroundTasks on
    every correction. Having both means a slow trickle of corrections still
    gets checked periodically, not only right after someone submits one."""
    return run_async(retraining_manager.trigger_retraining_if_needed())


@celery_app.task(name="tasks.retraining_tasks.run_baseline_training", bind=True, max_retries=1)
def run_baseline_training(self):
    """
    The actual CPU-heavy, synchronous training run - always executed on a
    Celery worker, never in-process inside a request handler, which would
    block the event loop for every other concurrent request
    (feedback/retraining_queue.py's original comment on this).

    Imported lazily: the training stack (torch/transformers/peft, etc.) is
    requirements-training.txt, not requirements.txt - a worker that never
    runs this task doesn't need it installed, matching this app's existing
    "heavy/optional deps imported inside the function that needs them"
    pattern (routers/pipelines.py::run_clustering).
    """
    from training.train import BaselineTrainer
    try:
        return BaselineTrainer().run_benchmarks()
    except Exception:
        logger.exception("Baseline training run failed.")
        raise
