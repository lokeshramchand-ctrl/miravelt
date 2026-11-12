"""Account lifecycle endpoints (PROJECT_AUDIT.md D3/F18, D1):

    POST   /auth/password/change         signed in, knows the current password
    POST   /auth/password/forgot         not signed in - emails a one-time code
    POST   /auth/password/reset          not signed in - code + new password
    POST   /auth/email/verify/request    emails a one-time code to the account
    POST   /auth/email/verify            confirms the code
    GET    /users/me/export              everything held about the user
    DELETE /users/me                     deletes the account and all its data
    POST   /users/me/push-tokens         registers this device for push
    DELETE /users/me/push-tokens         unregisters it

Token issuance itself stays in routers/auth.py; this router is thin and
delegates to services/account_service.py.
"""
import logging
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator

from core.config import settings
from core.error_handlers import CodedHTTPException
from core.jwt_auth import get_current_user
from core.rate_limiter import limiter
from core.security import DUMMY_HASH, hash_password_async, verify_password_async
from models.schemas import TokenResponse, User, UserPublic
from repositories.refresh_token_repository import refresh_token_repo
from repositories.user_repository import user_repo
from routers.auth import _issue_token_pair, _scopes_for
from services.account_service import account_service
from services.mailer import mailer
from services.push import push_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Account"])

_PASSWORD = Field(..., min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = _PASSWORD


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return v.lower()


class ResetPasswordRequest(ForgotPasswordRequest):
    code: str = Field(..., pattern=r"^\d{6}$")
    new_password: str = _PASSWORD


class VerifyEmailRequest(BaseModel):
    code: str = Field(..., pattern=r"^\d{6}$")


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)


class PushTokenRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=255)
    platform: Literal["android", "ios"] | None = None


async def _set_password(user_id: str, new_password: str) -> None:
    await user_repo.update_user(user_id, {
        "hashed_password": await hash_password_async(new_password),
        "password_changed_at": datetime.now(UTC),
    })
    # Every session on every device ends; the caller signs in again (or, for
    # a change made while signed in, is handed a fresh pair below).
    await refresh_token_repo.revoke_all_for_user(user_id)


@router.post("/auth/password/change", response_model=TokenResponse)
@limiter.limit("5/minute")
async def change_password(
    request: Request, payload: ChangePasswordRequest, current_user: User = Depends(get_current_user)
):
    """Signs every other device out and returns a fresh token pair for this one."""
    if not await verify_password_async(payload.current_password, current_user.hashed_password):
        raise CodedHTTPException(status.HTTP_403_FORBIDDEN, "Current password is incorrect", "wrong_password")
    await _set_password(current_user.id, payload.new_password)
    return await _issue_token_pair(current_user.id, scopes=_scopes_for(current_user))


@router.post("/auth/password/forgot", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("3/minute")
async def forgot_password(request: Request, payload: ForgotPasswordRequest):
    """Always 202 with the same body, so the response never says whether the
    address has an account."""
    user = await user_repo.get_by_email(payload.email)
    if user is not None and user.is_active:
        code = await account_service.issue_code(user.id, "password_reset")
        await mailer.send_code(
            user.email,
            subject="Reset your Miravelt password",
            intro="Use this code to choose a new Miravelt password:",
            code=code,
            ttl_minutes=settings.PASSWORD_RESET_CODE_TTL_MINUTES,
        )
    return {"detail": "If that address has an account, a reset code is on its way."}


@router.post("/auth/password/reset", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def reset_password(request: Request, payload: ResetPasswordRequest):
    user = await user_repo.get_by_email(payload.email)
    if user is None or not user.is_active:
        # Same cost and same answer as a wrong code for a real account.
        await verify_password_async(payload.code, DUMMY_HASH)
        raise CodedHTTPException(status.HTTP_400_BAD_REQUEST, "That code is wrong or has expired", "invalid_code")
    if not await account_service.redeem_code(user.id, "password_reset", payload.code):
        raise CodedHTTPException(status.HTTP_400_BAD_REQUEST, "That code is wrong or has expired", "invalid_code")
    await _set_password(user.id, payload.new_password)
    # Receiving the code proves control of the mailbox.
    await user_repo.update_user(user.id, {"email_verified": True})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/auth/email/verify/request", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("3/minute")
async def request_email_verification(request: Request, current_user: User = Depends(get_current_user)):
    if current_user.email_verified:
        return {"detail": "This address is already verified.", "sent": False}
    code = await account_service.issue_code(current_user.id, "email_verification")
    sent = await mailer.send_code(
        current_user.email,
        subject="Confirm your Miravelt email address",
        intro="Use this code to confirm your email address in Miravelt:",
        code=code,
        ttl_minutes=settings.PASSWORD_RESET_CODE_TTL_MINUTES,
    )
    return {"detail": "A verification code is on its way.", "sent": sent}


@router.post("/auth/email/verify", response_model=UserPublic)
@limiter.limit("5/minute")
async def verify_email(request: Request, payload: VerifyEmailRequest, current_user: User = Depends(get_current_user)):
    if not await account_service.redeem_code(current_user.id, "email_verification", payload.code):
        raise CodedHTTPException(status.HTTP_400_BAD_REQUEST, "That code is wrong or has expired", "invalid_code")
    updated = await user_repo.update_user(current_user.id, {"email_verified": True})
    return (updated or current_user).to_public()


@router.get("/users/me/export")
@limiter.limit("3/minute")
async def export_my_data(request: Request, current_user: User = Depends(get_current_user)):
    """Everything Miravelt holds about the signed-in user, as one JSON document."""
    return await account_service.export(current_user.id)


@router.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def delete_my_account(
    request: Request, payload: DeleteAccountRequest, current_user: User = Depends(get_current_user)
):
    """Permanent. Asks for the password again so a borrowed, unlocked phone
    cannot erase an account."""
    if not await verify_password_async(payload.password, current_user.hashed_password):
        raise CodedHTTPException(status.HTTP_403_FORBIDDEN, "Password is incorrect", "wrong_password")
    await account_service.delete(current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/users/me/push-tokens", status_code=status.HTTP_204_NO_CONTENT)
async def register_push_token(payload: PushTokenRequest, current_user: User = Depends(get_current_user)):
    await push_service.register(current_user.id, payload.token, payload.platform)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/users/me/push-tokens", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_push_token(payload: PushTokenRequest, current_user: User = Depends(get_current_user)):
    await push_service.unregister(current_user.id, payload.token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
