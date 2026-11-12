from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.error_handlers import CodedHTTPException
from core.jwt_auth import get_current_user
from feedback.feedback_service import feedback_service
from models.schemas import TransactionCategory, TransactionType, User
from repositories.transaction_repository import transaction_repo

router = APIRouter(prefix="/v1/feedback", tags=["Continuous Learning"])


class FeedbackRequest(BaseModel):
    transaction_id: str = Field(..., min_length=1, max_length=100)
    original_prediction: str = Field(..., min_length=1, max_length=100)
    corrected_category: TransactionCategory
    confidence: float = Field(..., ge=0.0, le=1.0)


@router.post("/")
async def submit_feedback(request: FeedbackRequest, current_user: User = Depends(get_current_user)):
    """
    Applies a category correction to every payment to that merchant,
    remembers it for the next statement, and recomputes the totals of every
    period it touches before returning - so the client can refetch and see
    the change everywhere (PROJECT_AUDIT.md A4).
    """
    # transaction_id is client-supplied - confirm it's this user's before
    # acting on it. 404 rather than 403: can't-distinguish-existence posture.
    transaction = await transaction_repo.get_by_id(request.transaction_id, current_user.id)
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    # Categories describe spending. Money received is Income by definition,
    # and filing a payment under Income would make it vanish from spending (F4).
    if transaction.transaction_type != TransactionType.DEBIT:
        raise CodedHTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Only payments you made can be recategorised.",
            "credit_not_correctable",
        )
    if request.corrected_category == TransactionCategory.INCOME:
        raise CodedHTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "A payment you made cannot be filed as Income.",
            "income_not_allowed",
        )

    result = await feedback_service.process_feedback(
        transaction=transaction,
        original_prediction=request.original_prediction,
        corrected_category=request.corrected_category.value,
        confidence=request.confidence,
        user_id=current_user.id,
    )
    return {
        "status": "success",
        "feedback_recorded": result["is_correction"],
        "recomputed_statement_ids": result["recomputed_statement_ids"],
    }
