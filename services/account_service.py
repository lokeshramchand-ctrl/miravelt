"""Account lifecycle (PROJECT_AUDIT.md D3/F18): one-time codes for password
reset and email verification, a full export of one user's data, and
self-serve deletion that cascades through every store.

One-time codes
    Six digits, single use, PASSWORD_RESET_CODE_TTL_MINUTES to live, at most
    MAX_ATTEMPTS wrong guesses before the code is burned. Stored as an HMAC
    keyed with JWT_SECRET_KEY, so a copy of the database alone cannot be
    brute-forced through the million possible codes.

Deletion
    Hard delete. Everything keyed by the user goes: statements and their
    PDFs, transactions, jobs, behaviour profiles, merchant memory, community
    votes, corrections, push tokens, sessions, one-time codes, events, and
    finally the account. Shared knowledge keeps nothing that names the user:
    a community alias survives only as long as enough *other* users vote for it.
"""
import hashlib
import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from bson import ObjectId

from core.config import settings
from database.mongo import db
from repositories.memory_repository import memory_repo
from repositories.statement_repository import statement_repo
from repositories.transaction_repository import transaction_repo
from services.push import push_service

logger = logging.getLogger(__name__)

Purpose = Literal["password_reset", "email_verification"]
MAX_ATTEMPTS = 5


def _code_hash(user_id: str, purpose: str, code: str) -> str:
    return hmac.new(
        settings.JWT_SECRET_KEY.encode(), f"{user_id}:{purpose}:{code}".encode(), hashlib.sha256
    ).hexdigest()


class AccountService:
    async def issue_code(self, user_id: str, purpose: Purpose) -> str:
        """Replaces any earlier code for the same purpose and returns the new one."""
        code = f"{secrets.randbelow(1_000_000):06d}"
        now = datetime.now(UTC)
        await db.password_resets.delete_many({"user_id": user_id, "purpose": purpose})
        await db.password_resets.insert_one({
            "user_id": user_id,
            "purpose": purpose,
            "code_hash": _code_hash(user_id, purpose, code),
            "attempts": 0,
            "created_at": now,
            "expires_at": now + timedelta(minutes=settings.PASSWORD_RESET_CODE_TTL_MINUTES),
        })
        return code

    async def redeem_code(self, user_id: str, purpose: Purpose, code: str) -> bool:
        """True exactly once for the right code. A wrong guess counts against
        MAX_ATTEMPTS; the code is deleted when the limit is reached."""
        now = datetime.now(UTC)
        redeemed = await db.password_resets.find_one_and_delete({
            "user_id": user_id,
            "purpose": purpose,
            "code_hash": _code_hash(user_id, purpose, code),
            "expires_at": {"$gt": now},
            "attempts": {"$lt": MAX_ATTEMPTS},
        })
        if redeemed is not None:
            return True
        await db.password_resets.update_many({"user_id": user_id, "purpose": purpose}, {"$inc": {"attempts": 1}})
        await db.password_resets.delete_many(
            {"user_id": user_id, "purpose": purpose, "attempts": {"$gte": MAX_ATTEMPTS}}
        )
        return False

    async def export(self, user_id: str) -> dict[str, Any]:
        """Everything Miravelt holds about one user, as plain JSON-ready data.
        Secrets (password hash, session tokens) are not personal data the
        user can use and are left out."""
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"hashed_password": 0})
        statements = [
            doc async for doc in db.statements.find({"user_id": user_id}, {"gridfs_file_id": 0}).sort("period_start", 1)
        ]
        transactions = [
            doc async for doc in db.transactions.find({"user_id": user_id}).sort("timestamp", 1)
        ]
        memory = [doc async for doc in db.user_merchant_memory.find({"user_id": user_id})]
        corrections = [doc async for doc in db.feedback.find({"user_id": user_id}).sort("timestamp", 1)]
        return _plain({
            "exported_at": datetime.now(UTC),
            "account": user,
            "statements": statements,
            "transactions": transactions,
            "merchant_memory": memory,
            "corrections": corrections,
        })

    async def delete(self, user_id: str) -> dict[str, int]:
        """Removes the account and everything keyed by it. Order matters only
        in that the user document goes last: a failure part-way leaves an
        account that can sign in and try again, never orphaned data nobody
        can reach."""
        statement_ids = [str(doc["_id"]) async for doc in db.statements.find({"user_id": user_id}, {"_id": 1})]
        counts = {
            "statements": await statement_repo.delete_for_user(user_id),
            "transactions": await transaction_repo.delete_for_user(user_id),
        }
        if statement_ids:
            await db.statement_texts.delete_many({"statement_id": {"$in": statement_ids}})
        await db.jobs.delete_many({"user_id": user_id})
        await db.behavior_patterns.delete_many({"user_id": user_id})
        await memory_repo.delete_for_user(user_id)
        await db.feedback.delete_many({"user_id": user_id})
        await db.retraining_queue.delete_many({"user_id": user_id})
        await push_service.delete_for_user(user_id)
        await db.refresh_tokens.delete_many({"user_id": user_id})
        await db.password_resets.delete_many({"user_id": user_id})
        await db.events.delete_many({"user_id": user_id})
        await db.users.delete_one({"_id": ObjectId(user_id)})
        logger.info("Account deleted at the user's request (%d statements, %d transactions).",
                    counts["statements"], counts["transactions"])
        return counts


def _plain(value: Any) -> Any:
    """ObjectIds to strings, datetimes to ISO 8601, recursively."""
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


account_service = AccountService()
