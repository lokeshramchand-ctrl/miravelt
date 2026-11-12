"""User-wide views over the timeline: search across every period (D7),
notes and tags on a transaction (D8), the merchant page (D8), the people
ledger (B3), and the "Teach Miravelt" deck (B2).

Thin by design: parse, delegate to services/insight_queries.py or the
feedback service, return.
"""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.jwt_auth import get_current_user
from core.pagination import PaginationParams, total_pages
from core.timezone import end_of_local_day_exclusive, start_of_local_day
from engines.categorizer import payee_key
from feedback.feedback_service import feedback_service
from models.schemas import (
    TransactionCategory,
    TransactionListResponse,
    TransactionResponse,
    TransactionType,
    User,
)
from repositories.memory_repository import memory_repo
from repositories.transaction_repository import transaction_repo
from services.insight_queries import insight_queries
from statements.recompute import recompute_statements

router = APIRouter(prefix="/v1", tags=["Timeline"])


@router.get("/transactions", response_model=TransactionListResponse)
async def search_transactions(
    pagination: PaginationParams = Depends(),
    q: str | None = Query(None, max_length=100, description="Merchant, payee name, UPI reference, note, tag or amount"),
    category: str | None = Query(None, max_length=50),
    transaction_type: TransactionType | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None, description="Inclusive"),
    sort_by: Literal["timestamp", "amount"] = Query("timestamp"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
    current_user: User = Depends(get_current_user),
):
    """Every period at once - the whole timeline, not one statement."""
    items, total = await transaction_repo.list_for_user(
        current_user.id,
        pagination.page,
        pagination.page_size,
        category=category,
        transaction_type=transaction_type,
        q=q,
        start=start_of_local_day(start_date) if start_date else None,
        end_exclusive=end_of_local_day_exclusive(end_date) if end_date else None,
        sort_by=sort_by,
        sort_order=-1 if sort_order == "desc" else 1,
    )
    return TransactionListResponse(
        items=[TransactionResponse.from_transaction(t) for t in items],
        page=pagination.page,
        page_size=pagination.page_size,
        total=total,
        total_pages=total_pages(total, pagination.page_size),
    )


class AnnotationRequest(BaseModel):
    note: str | None = Field(None, max_length=500)
    tags: list[str] | None = Field(None, max_length=10)


@router.patch("/transactions/{transaction_id}", response_model=TransactionResponse)
async def annotate_transaction(
    transaction_id: str, payload: AnnotationRequest, current_user: User = Depends(get_current_user)
):
    if payload.tags is not None and any(len(t) > 30 for t in payload.tags):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Tags are at most 30 characters.")
    updated = await transaction_repo.update_annotations(transaction_id, current_user.id, payload.note, payload.tags)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return TransactionResponse.from_transaction(updated)


@router.get("/merchants/{merchant}")
async def merchant_page(merchant: str, current_user: User = Depends(get_current_user)):
    page = await insight_queries.merchant_page(current_user.id, merchant)
    if page is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Merchant not found")
    return page


@router.get("/people")
async def people(current_user: User = Depends(get_current_user)):
    rows = await insight_queries.people(current_user.id)
    return {"people": rows, "count": len(rows)}


@router.get("/people/{key}/transactions", response_model=list[TransactionResponse])
async def person_transactions(key: str, current_user: User = Depends(get_current_user)):
    from models.schemas import Transaction

    docs = await insight_queries.payee_transactions(current_user.id, key)
    out = []
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        out.append(TransactionResponse.from_transaction(Transaction(**doc)))
    return out


class KindRequest(BaseModel):
    payee_name: str = Field(..., min_length=1, max_length=200)
    kind: Literal["person", "business"]


@router.put("/payees/kind")
async def set_payee_kind(payload: KindRequest, current_user: User = Depends(get_current_user)):
    """The user says a payee is a person (or a business). Applies to every
    row with that printed name now and to future statements, and a person
    is withdrawn from community aliases."""
    key = payee_key(payload.payee_name)
    names = [
        n for n in await transaction_repo.distinct_payee_names(current_user.id) if payee_key(n) == key
    ]
    if not names:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Payee not found")
    await transaction_repo.set_kind_for_payee(current_user.id, names, payload.kind)
    await memory_repo.set_kind(current_user.id, key, payload.kind)
    affected = await transaction_repo.statement_ids_for_payees(current_user.id, names)
    recomputed = await recompute_statements(current_user.id, affected)
    return {"payee_key": key, "kind": payload.kind, "recomputed_statement_ids": recomputed}


@router.get("/teach")
async def teach_deck(
    statement_id: str | None = Query(None, max_length=64),
    limit: int = Query(8, ge=1, le=20),
    current_user: User = Depends(get_current_user),
):
    return await insight_queries.teach_deck(current_user.id, statement_id, limit)


class TeachAnswer(BaseModel):
    merchant: str = Field(..., min_length=1, max_length=200)
    category: TransactionCategory | None = None
    kind: Literal["person", "business"] | None = None


class TeachRequest(BaseModel):
    answers: list[TeachAnswer] = Field(..., min_length=1, max_length=20)


@router.post("/teach")
async def answer_teach_deck(payload: TeachRequest, current_user: User = Depends(get_current_user)):
    """Applies a batch of answers from the deck, then recomputes every
    affected period once - not once per card."""
    affected: set[str] = set()
    applied = 0
    for answer in payload.answers:
        if answer.category == TransactionCategory.INCOME:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="A payment cannot be filed as Income.")
        if answer.kind is not None:
            names = await transaction_repo.distinct_payees_for_merchant(current_user.id, answer.merchant)
            if names:
                await transaction_repo.set_kind_for_payee(current_user.id, names, answer.kind)
                for name in names:
                    await memory_repo.set_kind(current_user.id, payee_key(name), answer.kind)
                affected.update(await transaction_repo.statement_ids_for_payees(current_user.id, names))
        if answer.category is not None:
            affected.update(await feedback_service.apply_merchant_correction(
                current_user.id, answer.merchant, answer.category.value, answer.kind
            ))
            applied += 1
    recomputed = await recompute_statements(current_user.id, sorted(affected))
    return {"applied": applied, "recomputed_statement_ids": recomputed}
