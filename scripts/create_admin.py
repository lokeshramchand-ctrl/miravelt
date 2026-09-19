# backend/scripts/create_admin.py
"""Promotes an existing, already-registered user to the "admin" role.

There is deliberately no self-serve "become an admin" API endpoint - an
attacker who compromises one account should never be able to grant
themselves admin scope over every other account. The first admin is
bootstrapped out-of-band with this script (run against the same MongoDB the
app itself uses); every admin after that is promoted by an existing one via
PATCH /admin/users/{user_id}/role in the admin dashboard.

Usage:
    python scripts/create_admin.py user@example.com
"""
import asyncio
import sys

from database.mongo import db
from models.schemas import UserRole
from repositories.user_repository import user_repo


async def promote(email: str) -> None:
    await db.connect()
    try:
        user = await user_repo.get_by_email(email.lower())
        if user is None:
            print(f"No user found with email {email!r}. They must register first via POST /auth/register.")
            sys.exit(1)

        if user.role == UserRole.ADMIN:
            print(f"{email} is already an admin.")
            return

        await user_repo.update_user(user.id, {"role": UserRole.ADMIN.value})
        print(f"Promoted {email} to admin. They'll receive the admin JWT scope on their next login or token refresh.")
    finally:
        await db.disconnect()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/create_admin.py <email>")
        sys.exit(1)
    asyncio.run(promote(sys.argv[1]))
