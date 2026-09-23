import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from core.jwt_auth import get_current_user, require_scope
from core.pagination import PaginationParams, total_pages
from core.rate_limiter import limiter
from core.retention_manager import retention_manager
from core.security import validate_admin_key
from models.schemas import AppPlatform, JobStatus, StatementStatus, UserRole

logger = logging.getLogger(__name__)

# Admin API router - separate from public API, stricter rate limits, requires admin scope.
# Can be mounted on a separate port/host in production (see app.py for conditional mounting).
#
# Per-route limits below are sized for the admin dashboard (admin-dashboard/),
# a BFF that proxies every admin's traffic through one server - core/rate_limiter.py
# keys on source IP (slowapi's get_remote_address), so every admin using the
# dashboard shares one IP as seen by this API. A limit sized for one direct
# caller (the original 5/minute) starts 429ing a whole admin team almost
# immediately; these are wider accordingly, while still well under the
# global default (100/minute) and noticeably tighter on the two genuinely
# destructive routes (delete, retention cleanup).
router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(validate_admin_key)]  # Every admin endpoint requires ADMIN_API_KEY
)


@router.get("/health", status_code=status.HTTP_200_OK)
async def admin_health():
    """Admin health check - verifies ADMIN_API_KEY is valid."""
    return {"status": "ok", "service": "admin-api"}


@router.get("/users", status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
async def list_all_users(
    request: Request,
    payload = Depends(require_scope("admin")),
    current_user = Depends(get_current_user)
):
    """List all users in the system. Requires admin scope.

    CAUTION: Returns all users - implement pagination in production.
    """
    from repositories.user_repository import user_repo

    all_users = await user_repo.get_all()
    return [
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "role": user.role,
            "device_count": len(user.devices),
            "created_at": user.created_at,
        }
        for user in all_users
    ]


@router.get("/users/{user_id}", status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
async def get_user_details(
    request: Request,
    user_id: str,
    payload = Depends(require_scope("admin")),
    current_user = Depends(get_current_user)
):
    """Get detailed info for a specific user including all devices."""
    from repositories.user_repository import user_repo

    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "role": user.role,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "devices": [
            {
                "device_id": device.device_id,
                "device_name": device.device_name,
                "user_agent": device.user_agent,
                "ip_address": device.ip_address,
                "last_login": device.last_login,
                "is_trusted": device.is_trusted,
                "attestation_verified": getattr(device, "attestation_verified", False),
                "created_at": device.created_at,
            }
            for device in user.devices
        ],
    }


@router.patch("/users/{user_id}/active", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def toggle_user_active(
    request: Request,
    user_id: str,
    active: bool,
    payload = Depends(require_scope("admin")),
    current_user = Depends(get_current_user)
):
    """Enable or disable a user account. Requires admin scope."""
    from repositories.user_repository import user_repo

    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.is_active = active
    await user_repo.update_user(user.id, {"is_active": active})
    logger.info(f"Admin {current_user.id} toggled user {user_id} active={active}")

    return {
        "id": user.id,
        "email": user.email,
        "is_active": user.is_active,
    }


class UpdateRoleRequest(BaseModel):
    role: UserRole


@router.patch("/users/{user_id}/role", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def update_user_role(
    request: Request,
    user_id: str,
    payload: UpdateRoleRequest,
    admin_payload = Depends(require_scope("admin")),
    current_user = Depends(get_current_user),
):
    """Promote a user to admin, or demote an admin back to a regular user.
    Requires admin scope - this is how every admin after the first one
    (scripts/create_admin.py) gets created."""
    from repositories.user_repository import user_repo

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role - have another admin do it.",
        )

    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    updated = await user_repo.update_user(user_id, {"role": payload.role.value})
    logger.info(f"Admin {current_user.id} set role={payload.role.value} for user {user_id}")

    return {"id": updated.id, "email": updated.email, "role": updated.role}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_user(
    request: Request,
    user_id: str,
    payload = Depends(require_scope("admin")),
    current_user = Depends(get_current_user)
):
    """Soft-delete a user account (mark is_active=False). Requires admin scope.

    Data is retained for compliance/audit; set GDPR_HARD_DELETE for true removal.
    """
    from repositories.user_repository import user_repo

    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Soft delete: mark account inactive, revoke all sessions
    from repositories.refresh_token_repository import refresh_token_repo
    await refresh_token_repo.revoke_all_for_user(user_id)
    await user_repo.update_user(user_id, {"is_active": False})

    logger.info(f"Admin {current_user.id} deleted user {user_id}")


@router.post("/retention/cleanup", status_code=status.HTTP_200_OK)
@limiter.limit("2/minute")
async def trigger_retention_cleanup(
    request: Request,
    payload = Depends(require_scope("admin")),
    current_user = Depends(get_current_user)
):
    """Trigger immediate data retention and cleanup cycle. Requires admin scope.

    Cleans up:
    - PDFs older than PDF_RETENTION_DAYS (default: 90 days)
    - Audit logs older than 90 days
    - Expired request nonces
    - Revoked refresh tokens older than 7 days

    Note: MongoDB TTL indexes handle automatic cleanup automatically, but this
    endpoint is available for manual/immediate triggering if needed.
    """
    try:
        results = await retention_manager.run_full_retention_cleanup()
        logger.info(f"Admin {current_user.id} triggered retention cleanup. Results: {results}")
        return {
            "status": "success",
            "message": "Retention cleanup completed",
            "results": results
        }
    except Exception as e:
        # Full detail stays in the server log; the response never carries
        # internal exception text (same rule as core/error_handlers.py).
        logger.exception("Error during admin retention cleanup")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Retention cleanup failed. See server logs for details."
        ) from e


@router.get("/overview", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def get_overview(
    request: Request,
    payload = Depends(require_scope("admin")),
    current_user = Depends(get_current_user),
):
    """Dashboard landing-page KPIs: counted/aggregated server-side rather
    than shipping full collections to the client just to count them."""
    from repositories.app_release_repository import app_release_repo
    from repositories.job_repository import job_repo
    from repositories.statement_repository import statement_repo
    from repositories.user_repository import user_repo

    total_users, active_users, admin_count, jobs_by_status, statements_by_status = await asyncio.gather(
        user_repo.count_all(),
        user_repo.count_active(),
        user_repo.count_admins(),
        job_repo.count_by_status(),
        statement_repo.count_by_status(),
    )

    latest_releases = await app_release_repo.list_all()
    latest_by_platform = {}
    for release in latest_releases:
        if release.is_latest:
            latest_by_platform[release.platform.value] = {
                "version_name": release.version_name,
                "version_code": release.version_code,
                "uploaded_at": release.uploaded_at,
            }

    return {
        "users": {"total": total_users, "active": active_users, "admins": admin_count},
        "jobs_by_status": jobs_by_status,
        "statements_by_status": statements_by_status,
        "latest_releases": latest_by_platform,
    }


@router.get("/jobs", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def list_all_jobs(
    request: Request,
    pagination: PaginationParams = Depends(),
    job_status: JobStatus | None = Query(None, alias="status"),
    payload = Depends(require_scope("admin")),
    current_user = Depends(get_current_user),
):
    """Cross-user job listing - routers/jobs.py's GET /jobs/{id} is
    intentionally scoped to the caller instead."""
    from repositories.job_repository import job_repo

    items, total = await job_repo.list_all(pagination.page, pagination.page_size, status_filter=job_status)
    return {
        "items": [
            {
                "id": job.id,
                "user_id": job.user_id,
                "job_type": job.job_type,
                "resource_type": job.resource_type,
                "resource_id": job.resource_id,
                "status": job.status,
                "stage": job.stage,
                "progress_percent": job.progress_percent,
                "error_message": job.error_message,
                "created_at": job.created_at,
                "started_at": job.started_at,
                "completed_at": job.completed_at,
            }
            for job in items
        ],
        "page": pagination.page,
        "page_size": pagination.page_size,
        "total": total,
        "total_pages": total_pages(total, pagination.page_size),
    }


@router.get("/statements", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def list_all_statements(
    request: Request,
    pagination: PaginationParams = Depends(),
    processing_status: StatementStatus | None = Query(None),
    user_id: str | None = Query(None, description="Filter to one user's statements"),
    payload = Depends(require_scope("admin")),
    current_user = Depends(get_current_user),
):
    """Cross-user statement listing - routers/statements.py's list_statements()
    is intentionally scoped to the caller instead."""
    from repositories.statement_repository import statement_repo

    items, total = await statement_repo.list_all(
        pagination.page,
        pagination.page_size,
        status_filter=processing_status,
        user_id_filter=user_id,
    )
    return {
        "items": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "original_filename": s.original_filename,
                "file_size_bytes": s.file_size_bytes,
                "period_start": s.period_start,
                "period_end": s.period_end,
                "transaction_count": s.transaction_count,
                "processing_status": s.processing_status,
                "reconciliation_ok": s.reconciliation_ok,
                "error_message": s.error_message,
                "uploaded_at": s.uploaded_at,
                "processing_completed_at": s.processing_completed_at,
            }
            for s in items
        ],
        "page": pagination.page,
        "page_size": pagination.page_size,
        "total": total,
        "total_pages": total_pages(total, pagination.page_size),
    }


@router.get("/releases", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def list_all_releases(
    request: Request,
    platform: AppPlatform | None = Query(None),
    payload = Depends(require_scope("admin")),
    current_user = Depends(get_current_user),
):
    """Every uploaded build, not just the latest (compare GET
    /app/latest-version) - publishing itself still goes through the existing
    POST /app/releases (routers/app_updates.py), which this router doesn't
    duplicate."""
    from repositories.app_release_repository import app_release_repo

    releases = await app_release_repo.list_all(platform=platform)
    return [
        {
            "id": r.id,
            "platform": r.platform,
            "version_code": r.version_code,
            "version_name": r.version_name,
            "release_notes": r.release_notes,
            "min_supported_version_code": r.min_supported_version_code,
            "sha256": r.sha256,
            "size_bytes": r.size_bytes,
            "is_latest": r.is_latest,
            "uploaded_at": r.uploaded_at,
        }
        for r in releases
    ]
