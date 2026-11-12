"""Celery tasks for the experiments. tasks/celery_app.py includes this module
and schedules these tasks only when LABS_ENABLED."""
from labs.graphs.graph_builder import graph_engine
from labs.memory.decay_engine import decay_engine
from tasks.celery_app import celery_app, run_async


async def _run_decay_sweep() -> dict:
    return {"archived_count": await decay_engine.run_archive_sweep()}


@celery_app.task(name="labs.schedule.run_decay_sweep")
def run_decay_sweep():
    return run_async(_run_decay_sweep())


@celery_app.task(name="labs.schedule.build_knowledge_graph")
def build_knowledge_graph():
    return run_async(graph_engine.build_graph())


@celery_app.task(name="labs.schedule.run_clustering")
def run_clustering():
    from labs.clustering.cluster_engine import cluster_engine
    return run_async(cluster_engine.run_discovery_pipeline())
