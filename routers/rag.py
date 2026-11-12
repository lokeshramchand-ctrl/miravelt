import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, model_validator

from core.jwt_auth import get_current_user
from core.rate_limiter import limiter
from insights.fact_check import FactChecker
from models.schemas import User
from rag.context_builder import context_builder
from rag.generator import explanation_generator
from rag.retriever import context_retriever

router = APIRouter(prefix="/v1", tags=["Explainability"])

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


class ExplainRequest(BaseModel):
    # The row to explain. `transaction_text` alone is the older contract and
    # is resolved to one of the caller's own payees.
    transaction_id: str | None = Field(default=None, max_length=64)
    transaction_text: str | None = Field(default=None, min_length=1, max_length=2000)
    target_question: str = Field(
        default="Why was this transaction categorized this way?", max_length=500
    )

    @model_validator(mode="after")
    def _needs_a_subject(self):
        if not self.transaction_id and not self.transaction_text:
            raise ValueError("Provide transaction_id or transaction_text")
        return self


def _computed(facts: list[str]) -> dict:
    return {
        "explanation": " ".join(facts),
        "confidence_in_explanation": "HIGH",
        "primary_data_source": "Your own payment history",
        "generated": False,
    }


@router.post("/explain")
@limiter.limit("20/minute")
async def explain_transaction(request: Request, payload: ExplainRequest, current_user: User = Depends(get_current_user)):
    """
    Explains one of the caller's own transactions from the caller's own
    history (PROJECT_AUDIT.md F12).

    1. Retrieve - the transaction, the user's payments to the same payee,
       their cadence, and what the user taught Miravelt about it.
    2. Compute  - `facts`: sentences derived from that data alone.
    3. Generate - the model phrases the same data. Its answer is kept only
       if every number and name in it is in the context
       (insights/fact_check.py); otherwise the computed facts are the answer.

    No context, no model call. Rate-limited to 20/minute: a model call is
    expensive next to the rest of the API.
    """
    if payload.transaction_id:
        context = await context_retriever.for_transaction(current_user.id, payload.transaction_id)
        if context is None:
            # Missing or someone else's: the same 404 either way.
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    else:
        context = await context_retriever.for_text(current_user.id, payload.transaction_text or "")

    query = payload.transaction_text or (context or {}).get("transaction", {}).get("merchant") or ""
    if context is None:
        return {
            "query": query,
            "retrieved_documents": 0,
            "grounded": False,
            "facts": [],
            "result": {"error": "No history with this payee yet, so there is nothing to explain from."},
        }

    facts = context_builder.facts(context)
    generated = await explanation_generator.generate_explanation(
        query=payload.target_question,
        context_string=context_builder.build_prompt_string(context),
    )

    result = _computed(facts)
    if "error" not in generated:
        checker = FactChecker(context)
        sentences = [s for s in _SENTENCE_RE.split(generated["explanation"].strip()) if s]
        if sentences and all(checker.check(s)[0] for s in sentences):
            result = {**generated, "generated": True}

    return {
        "query": query,
        "retrieved_documents": context["history"]["payments"],
        "grounded": True,
        "facts": facts,
        "result": result,
    }
