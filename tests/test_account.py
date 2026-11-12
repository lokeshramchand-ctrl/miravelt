"""Account lifecycle (PROJECT_AUDIT.md D3/F18), push tokens (D1) and client
events (F26) - against a live MongoDB.
"""
from datetime import date

import pytest

from statements.synthetic import SyntheticStatement
from tests.conftest import API_HEADERS

NEW_PASSWORD = "AnotherStrongPassword456!"  # noqa: S105 - test fixture


@pytest.fixture
def outbox(monkeypatch):
    """Captures one-time codes instead of sending mail."""
    from services.mailer import mailer

    sent = []

    async def _capture(to, *, subject, intro, code, ttl_minutes):
        sent.append({"to": to, "subject": subject, "code": code})
        return True

    monkeypatch.setattr(mailer, "send_code", _capture)
    return sent


def _login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password}, headers=API_HEADERS)


def test_change_password_ends_old_sessions_and_keeps_this_one(client, make_user):
    user = make_user()
    old = _login(client, user["email"], user["password"]).json()

    wrong = client.post("/auth/password/change", json={
        "current_password": "not-the-password", "new_password": NEW_PASSWORD,
    }, headers=user["headers"])
    assert wrong.status_code == 403
    assert wrong.json()["error"]["code"] == "wrong_password"

    res = client.post("/auth/password/change", json={
        "current_password": user["password"], "new_password": NEW_PASSWORD,
    }, headers=user["headers"])
    assert res.status_code == 200, res.text
    fresh = res.json()

    # The refresh token from before the change is dead; the returned pair works.
    assert client.post("/auth/refresh", json={"refresh_token": old["refresh_token"]},
                       headers=API_HEADERS).status_code == 401
    me = client.get("/users/me", headers={**API_HEADERS, "Authorization": f"Bearer {fresh['access_token']}"})
    assert me.status_code == 200
    assert _login(client, user["email"], user["password"]).status_code == 401
    assert _login(client, user["email"], NEW_PASSWORD).status_code == 200


def test_access_tokens_issued_before_a_password_change_stop_working(client, make_user):
    from datetime import UTC, datetime, timedelta

    from repositories.user_repository import user_repo

    user = make_user()
    assert client.get("/users/me", headers=user["headers"]).status_code == 200
    # As if the password changed a moment after this token was issued.
    client.portal.call(user_repo.update_user, user["id"],
                       {"password_changed_at": datetime.now(UTC) + timedelta(seconds=5)})
    assert client.get("/users/me", headers=user["headers"]).status_code == 401


def test_password_reset_by_emailed_code(client, make_user, outbox):
    user = make_user()
    res = client.post("/auth/password/forgot", json={"email": user["email"].upper()}, headers=API_HEADERS)
    assert res.status_code == 202
    assert len(outbox) == 1 and outbox[0]["to"] == user["email"]
    code = outbox[0]["code"]
    assert len(code) == 6 and code.isdigit()

    wrong = "000000" if code != "000000" else "111111"
    bad = client.post("/auth/password/reset", json={
        "email": user["email"], "code": wrong, "new_password": NEW_PASSWORD,
    }, headers=API_HEADERS)
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "invalid_code"

    ok = client.post("/auth/password/reset", json={
        "email": user["email"], "code": code, "new_password": NEW_PASSWORD,
    }, headers=API_HEADERS)
    assert ok.status_code == 204, ok.text
    assert _login(client, user["email"], NEW_PASSWORD).status_code == 200
    # Single use.
    again = client.post("/auth/password/reset", json={
        "email": user["email"], "code": code, "new_password": "YetAnotherPassword789!",
    }, headers=API_HEADERS)
    assert again.status_code == 400


def test_forgot_password_does_not_reveal_whether_an_account_exists(client, make_user, outbox):
    known = client.post("/auth/password/forgot", json={"email": make_user()["email"]}, headers=API_HEADERS)
    unknown = client.post("/auth/password/forgot", json={"email": "nobody-here@example.com"}, headers=API_HEADERS)
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(outbox) == 1


def test_reset_code_is_burned_after_too_many_wrong_guesses(client, make_user, outbox):
    from services.account_service import MAX_ATTEMPTS

    user = make_user()
    client.post("/auth/password/forgot", json={"email": user["email"]}, headers=API_HEADERS)
    code = outbox[0]["code"]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(MAX_ATTEMPTS):
        client.portal.call(_redeem, user["id"], wrong)
    res = client.post("/auth/password/reset", json={
        "email": user["email"], "code": code, "new_password": NEW_PASSWORD,
    }, headers=API_HEADERS)
    assert res.status_code == 400


async def _redeem(user_id, code):
    from services.account_service import account_service

    return await account_service.redeem_code(user_id, "password_reset", code)


def test_email_verification(client, make_user, outbox):
    user = make_user()
    assert client.get("/users/me", headers=user["headers"]).json()["email_verified"] is False
    assert client.post("/auth/email/verify/request", headers=user["headers"]).status_code == 202
    res = client.post("/auth/email/verify", json={"code": outbox[0]["code"]}, headers=user["headers"])
    assert res.status_code == 200, res.text
    assert res.json()["email_verified"] is True
    assert client.get("/users/me", headers=user["headers"]).json()["email_verified"] is True


def test_export_contains_the_users_data_and_no_secrets(client, make_user, ingest):
    user = make_user()
    stmt = SyntheticStatement(date(2026, 1, 1), date(2026, 1, 31), seed=201)
    ingest(user, stmt.text())
    res = client.get("/users/me/export", headers=user["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["account"]["email"] == user["email"]
    assert "hashed_password" not in body["account"]
    assert len(body["statements"]) == 1
    assert len(body["transactions"]) == len(stmt.records)
    assert all(t["user_id"] == user["id"] for t in body["transactions"])


def test_delete_account_removes_everything_and_only_this_users(client, make_user, ingest):
    from database.mongo import db

    user, other = make_user(), make_user()
    ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 2, 28), seed=211).text())
    ingest(other, SyntheticStatement(date(2026, 1, 1), date(2026, 2, 28), seed=212).text())
    client.post("/users/me/push-tokens", json={"token": "ExponentPushToken[delete-me-123]", "platform": "android"},
                headers=user["headers"])

    refused = client.request("DELETE", "/users/me", json={"password": "wrong-password"}, headers=user["headers"])
    assert refused.status_code == 403

    res = client.request("DELETE", "/users/me", json={"password": user["password"]}, headers=user["headers"])
    assert res.status_code == 204, res.text

    async def remaining(user_id):
        return {
            name: await getattr(db, name).count_documents({"user_id": user_id})
            for name in ("transactions", "statements", "jobs", "behavior_patterns", "user_merchant_memory",
                         "community_alias_votes", "push_tokens", "refresh_tokens", "feedback", "events")
        }

    assert set(client.portal.call(remaining, user["id"]).values()) == {0}
    assert client.get("/users/me", headers=user["headers"]).status_code == 401
    assert _login(client, user["email"], user["password"]).status_code == 401
    # The other account is untouched.
    assert client.portal.call(remaining, other["id"])["transactions"] > 0
    assert client.get("/users/me", headers=other["headers"]).status_code == 200


def test_push_token_moves_with_the_device(client, make_user):
    from database.mongo import db

    first, second = make_user(), make_user()
    token = "ExponentPushToken[shared-phone-456]"  # noqa: S105 - test fixture
    assert client.post("/users/me/push-tokens", json={"token": token}, headers=first["headers"]).status_code == 204
    assert client.post("/users/me/push-tokens", json={"token": token}, headers=second["headers"]).status_code == 204

    async def owners():
        return [doc["user_id"] async for doc in db.push_tokens.find({"token": token})]

    assert client.portal.call(owners) == [second["id"]]
    assert client.request("DELETE", "/users/me/push-tokens", json={"token": token},
                          headers=second["headers"]).status_code == 204
    assert client.portal.call(owners) == []


def test_client_events_are_recorded_and_bounded(client, make_user):
    from database.mongo import db

    user = make_user()
    res = client.post("/v1/events", json={
        "app_version": "1.0.0", "platform": "android",
        "events": [
            {"name": "overview_viewed", "properties": {"period_days": 181}},
            {"name": "client_error", "properties": {"message": "boom", "stack": "x" * 10_000, "fatal": True}},
        ],
    }, headers=user["headers"])
    assert res.status_code == 204, res.text

    async def stored():
        return [doc async for doc in db.events.find({"user_id": user["id"]}).sort("name", 1)]

    docs = client.portal.call(stored)
    assert [d["name"] for d in docs] == ["client_error", "overview_viewed"]
    assert len(docs[0]["properties"]["stack"]) == 4000

    bad = client.post("/v1/events", json={"events": [{"name": "Not A Name"}]}, headers=user["headers"])
    assert bad.status_code == 422
