"""Suite-wide test setup (applies to test_api.py and tests/).

Almost every collection is keyed by user, and every test creates its own
throwaway users, so runs do not see each other's data. The exception is the
shared knowledge that is *meant* to cross users: community alias votes
(repositories/memory_repository.py). Without a reset, a payee corrected by
one test user per run becomes a community alias after
COMMUNITY_ALIAS_MIN_USERS runs, and tests that expect "nobody has labelled
this yet" start failing on a database that has been used before.
"""
import os

# The experiments under labs/ keep their tests; they are off everywhere else.
# Must be set before core.config builds its Settings.
os.environ.setdefault("LABS_ENABLED", "true")

import pymongo  # noqa: E402
import pytest  # noqa: E402

from core.config import settings  # noqa: E402

# Cross-user collections only. Never per-user data: a developer pointing the
# suite at a database with real accounts must not lose them to a test run.
_SHARED_COLLECTIONS = ("community_alias_votes",)


@pytest.fixture(scope="session", autouse=True)
def _reset_shared_knowledge():
    # Only ever on a database that is plainly a test database (CI and
    # CLAUDE.md both use MONGODB_DB_NAME=miravelt_test).
    if "test" not in settings.MONGODB_DB_NAME.lower():
        yield
        return
    try:
        with pymongo.MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=3000) as mongo:
            for name in _SHARED_COLLECTIONS:
                mongo[settings.MONGODB_DB_NAME][name].delete_many({})
    except pymongo.errors.PyMongoError:
        # Unit tests in tests/ need no database; integration tests will fail
        # loudly on their own if it is really unreachable.
        pass
    yield
