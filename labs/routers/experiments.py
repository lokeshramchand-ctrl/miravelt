"""Experimental endpoints that used to sit in routers/v1.py and
routers/pipelines.py. Same paths, same gates; mounted only with
LABS_ENABLED (see labs/README.md)."""
from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, Field

from core.jwt_auth import get_current_user
from core.rate_limiter import limiter
from labs.confidence_engine import confidence_engine
from labs.graphs.graph_builder import graph_engine
from labs.memory.decay_engine import decay_engine
from labs.merchant_resolver import merchant_resolver
from models.schemas import ConfidenceEvaluation, ResolutionResult, User

# Client-key + JWT, like the rest of /v1.
router = APIRouter(prefix="/v1", tags=["Labs"])
# Admin-key gated in app.py, like routers/pipelines.py.
pipelines_router = APIRouter(prefix="/v1/pipelines", tags=["Labs: Batch Pipelines"])


class ResolveRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


@router.post("/resolve", response_model=ResolutionResult)
async def resolve_transaction_merchant(request: ResolveRequest, current_user: User = Depends(get_current_user)):
    """Takes a raw UPI/bank transaction string and resolves it to a canonical merchant."""
    return await merchant_resolver.resolve(request.text)


class MockModelPrediction(BaseModel):
    predicted_category: str = Field(..., min_length=1, max_length=100)
    raw_confidence: float = Field(..., ge=0.0, le=1.0)


@router.post("/confidence/evaluate", response_model=ConfidenceEvaluation)
async def evaluate_prediction_confidence(request: MockModelPrediction, current_user: User = Depends(get_current_user)):
    """Evaluates an upstream category prediction; forces 'Unknown' below the confidence wall."""
    return confidence_engine.evaluate(
        predicted_category=request.predicted_category,
        raw_confidence=request.raw_confidence,
    )


@pipelines_router.post("/decay/sweep")
@limiter.limit("10/minute")
async def run_decay_sweep(request: Request):
    """Archives global merchant profiles inactive for 180+ days."""
    archived_count = await decay_engine.run_archive_sweep()
    return {"archived_count": archived_count}


@pipelines_router.post("/graph/build")
@limiter.limit("10/minute")
async def build_knowledge_graph(request: Request):
    """Rebuilds the in-memory merchant knowledge graph from MongoDB."""
    return await graph_engine.build_graph()


@pipelines_router.get("/graph/neighborhood/{merchant_name}")
async def get_graph_neighborhood(
    merchant_name: str = Path(..., min_length=1, max_length=200),
    radius: int = 2,
):
    """Returns the local ego-graph around a merchant. Call /graph/build first in this process."""
    radius = max(0, min(radius, 5))
    return graph_engine.get_merchant_neighborhood(merchant_name, radius=radius)


@pipelines_router.post("/clustering/run")
@limiter.limit("5/minute")
async def run_clustering(request: Request):
    """Runs the UMAP + HDBSCAN discovery pipeline over stored Milvus vectors.
    Imported lazily so a missing scikit-learn or umap-learn install only
    breaks this one endpoint."""
    from labs.clustering.cluster_engine import cluster_engine
    return await cluster_engine.run_discovery_pipeline()
