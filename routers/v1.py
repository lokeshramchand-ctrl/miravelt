import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request

from core.jwt_auth import get_current_user
from core.rate_limiter import limiter
from database.mongo import db
from engines.rule_engine import rule_engine
from models.schemas import CategorizeRequest, CategorizeResponse, User

router = APIRouter(prefix="/v1", tags=["Transaction Intelligence"])

@router.post("/categorize", response_model=CategorizeResponse)
@limiter.limit("50/minute")
async def categorize_transaction(
    request: Request, payload: CategorizeRequest, current_user: User = Depends(get_current_user)
):
    # Process text through the Rule Engine
    result = rule_engine.categorize(payload.text)

    # Per-request latency is already captured automatically for every route by
    # prometheus_fastapi_instrumentator (see app.py) - no need to hand-roll it here.
    amount = 0.0
    text_content = payload.text
    amount_match = re.search(r'₹\s*([0-9.,]+)', text_content)
    if amount_match:
        amount = float(amount_match.group(1).replace(',', ''))

    # 2. Save the fully enriched transaction to MongoDB
    insert_result = await db.transactions.insert_one({
        "user_id": current_user.id,
        "raw_text": text_content,
        "merchant": result["merchant"],
        "category": result["category"],
        "amount": amount,
        "confidence": result["confidence"],
        "timestamp": datetime.now(UTC)
    })

    return {**result, "transaction_id": str(insert_result.inserted_id)}
