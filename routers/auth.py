import hashlib
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, status
from pymongo.errors import DuplicateKeyError

from core.config import settings
from core.device_attestation import device_attestation_verifier
from core.jwt_auth import create_access_token, generate_refresh_token
from core.rate_limiter import limiter
from core.security import DUMMY_HASH, hash_password_async, verify_password_async
from models.schemas import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserPublic,
    UserRole,
)
from repositories.refresh_token_repository import refresh_token_repo
from repositories.user_repository import user_repo

logger = logging.getLogger(__name__)

# Purely about token lifecycle (register/login/refresh/logout) - "who is the
# currently authenticated user" lives at GET/PATCH /users/me
# (routers/users.py) instead, a more RESTful home for profile access than an
# auth/token router.
router = APIRouter(prefix="/auth", tags=["Authentication"])


def _hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _scopes_for(user) -> list[str]:
    """Every authenticated user gets "user"; role == admin (routers/admin.py's
    role-management endpoint, or scripts/create_admin.py for the first one)
    additionally gets "admin" - checked by core.jwt_auth.require_scope on
    every /admin/* route. Recomputed fresh on every login *and* refresh
    (not just login) so a role change takes effect the next time the
    client's access token is renewed, without needing to force a re-login."""
    scopes = ["user"]
    if user.role == UserRole.ADMIN:
        scopes.append("admin")
    return scopes


async def _issue_token_pair(
    user_id: str,
    device_id: str | None = None,
    device_name: str | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
    scopes: list[str] | None = None,
) -> TokenResponse:
    access_token, expires_in = create_access_token(user_id, scopes=scopes or [])
    refresh_token, refresh_expires_at = generate_refresh_token()
    await refresh_token_repo.store(
        user_id=user_id,
        token_hash=_hash_refresh_token(refresh_token),
        expires_at=refresh_expires_at,
        device_id=device_id,
        device_name=device_name or "Unknown Device",
        user_agent=user_agent,
        ip_address=ip_address,
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, expires_in=expires_in)


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterRequest):
    """Creates a new user account. Gated behind the same X-Miravelt-API-Key
    dependency as every other router (app.py) - the API key authenticates the
    calling application; a JWT for the new user doesn't exist yet at this
    point, since the account doesn't exist yet either."""
    existing = await user_repo.get_by_email(payload.email)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    hashed = await hash_password_async(payload.password)
    try:
        user = await user_repo.create_user(email=payload.email, hashed_password=hashed)
    except DuplicateKeyError as e:
        # The pre-check above is the fast common-case path; the unique index
        # on users.email is what actually closes the race between two
        # concurrent registrations for the same address.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered") from e

    logger.info("New user account registered.")
    return user.to_public()


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest):
    client_ip = request.client.host if request.client else None
    client_ua = (request.headers.get("user-agent") or "")[:300] or None
    user = await user_repo.get_by_email(payload.email)

    # Verify against a real hash even when no user was found, so response
    # timing doesn't reveal whether the email is registered (a hasher call
    # takes measurably longer than skipping straight to the 401).
    password_ok = await verify_password_async(payload.password, user.hashed_password if user else DUMMY_HASH)

    if user is None or not password_ok:
        logger.warning("Rejected login attempt with invalid credentials.")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # Verify device attestation if provided/required
    attestation_result = None
    if payload.attestation_token and payload.attestation_type:
        if payload.attestation_type == "play_integrity":
            attestation_result = await device_attestation_verifier.verify_play_integrity(
                payload.attestation_token,
                payload.attestation_nonce or ""
            )
        elif payload.attestation_type == "app_attest":
            attestation_result = await device_attestation_verifier.verify_app_attest(
                payload.attestation_token,
                payload.attestation_nonce or ""
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown attestation type: {payload.attestation_type}"
            )

        if not attestation_result.is_valid and settings.DEVICE_ATTESTATION_REQUIRED:
            logger.warning(f"Device attestation failed: {attestation_result.error}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Device attestation failed"
            )

    # Track device on login if provided
    from models.schemas import DeviceSession
    if payload.device_id:
        # Update or create device session
        device = next((d for d in user.devices if d.device_id == payload.device_id), None)
        if device:
            device.last_login = datetime.now(UTC)
            device.user_agent = client_ua or device.user_agent
            device.ip_address = client_ip or device.ip_address
        else:
            device = DeviceSession(
                device_id=payload.device_id,
                device_name=payload.device_name or "Unknown Device",
                user_agent=client_ua,
                ip_address=client_ip,
                last_login=datetime.now(UTC),
            )
            user.devices.append(device)

        # Store attestation result if verification completed
        if attestation_result:
            device.attestation_verified = attestation_result.is_valid
            device.attestation_type = attestation_result.attestation_type
            if attestation_result.is_valid:
                device.attestation_at = attestation_result.timestamp

        await user_repo.update_user(user.id, {"devices": [d.model_dump() for d in user.devices]})

    return await _issue_token_pair(
        user.id,
        device_id=payload.device_id,
        device_name=payload.device_name or "Unknown Device",
        user_agent=client_ua,
        ip_address=client_ip,
        scopes=_scopes_for(user),
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh(request: Request, payload: RefreshRequest):
    token_hash = _hash_refresh_token(payload.refresh_token)
    stored = await refresh_token_repo.get_by_hash(token_hash)

    if stored is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    expires_at = stored["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if stored.get("revoked_at") is None and expires_at < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has expired")

    # Atomic single-use redemption: exactly one concurrent caller wins.
    redeemed = await refresh_token_repo.redeem(token_hash)
    if redeemed is None:
        # A retry within the grace window, whose replacement was never used,
        # is a lost response on a flaky network, not theft (F19): swap the
        # unused replacement for a fresh pair instead of ending every session.
        retry = await refresh_token_repo.reissue_within_grace(stored, settings.REFRESH_TOKEN_REUSE_GRACE_SECONDS)
        if retry is not None:
            user = await user_repo.get_by_id(stored["user_id"])
            if user is None or not user.is_active:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
            pair = await _issue_token_pair(
                user.id,
                device_id=stored.get("device_id"),
                device_name=stored.get("device_name"),
                user_agent=stored.get("user_agent"),
                ip_address=stored.get("ip_address"),
                scopes=_scopes_for(user),
            )
            await refresh_token_repo.link_rotation(token_hash, _hash_refresh_token(pair.refresh_token))
            return pair
        # Reuse of an already-rotated (or logged-out) token: likely theft.
        logger.warning("Rejected reused/revoked refresh token; revoking all sessions for the associated user.")
        await refresh_token_repo.revoke_all_for_user(stored["user_id"])
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = await user_repo.get_by_id(redeemed["user_id"])
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Carry the device forward so device revocation keeps working after rotation.
    pair = await _issue_token_pair(
        user.id,
        device_id=redeemed.get("device_id"),
        device_name=redeemed.get("device_name"),
        user_agent=redeemed.get("user_agent"),
        ip_address=redeemed.get("ip_address"),
        scopes=_scopes_for(user),
    )
    await refresh_token_repo.link_rotation(token_hash, _hash_refresh_token(pair.refresh_token))
    return pair


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def logout(request: Request, payload: LogoutRequest):
    """Revokes the presented refresh token, ending that session. Idempotent
    (revoking an unknown or already-revoked token is a silent no-op) and
    deliberately doesn't require a still-valid access token - a client whose
    access token already expired must still be able to log out."""
    await refresh_token_repo.revoke(_hash_refresh_token(payload.refresh_token))
