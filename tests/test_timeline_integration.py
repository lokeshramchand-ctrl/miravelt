"""The per-user timeline (PROJECT_AUDIT.md A1), corrections that stick and
teach (A4, B1, F2-F4), and parser accounting (A6) - against a live MongoDB.
"""
from datetime import date

from statements.synthetic import SyntheticStatement


def _all(client, user, statement_id, **params):
    items, page = [], 1
    while True:
        res = client.get(
            f"/statements/{statement_id}/transactions",
            params={"page": page, "page_size": 100, **params},
            headers=user["headers"],
        )
        assert res.status_code == 200, res.text
        body = res.json()
        items += body["items"]
        if page >= body["total_pages"]:
            return items
        page += 1


def _statement(client, user, statement_id):
    res = client.get(f"/statements/{statement_id}", headers=user["headers"])
    assert res.status_code == 200, res.text
    return res.json()


def _analytics(client, user, statement_id):
    res = client.get(f"/statements/{statement_id}/analytics", headers=user["headers"])
    assert res.status_code == 200, res.text
    return res.json()


def test_overlapping_upload_does_not_steal_transactions(client, make_user, ingest):
    """F1: Jan-Jun then Apr-Sep. The first period keeps every row it had;
    deleting the second leaves the first whole."""
    user = make_user()
    first = SyntheticStatement(date(2026, 1, 1), date(2026, 6, 30), seed=11)
    second = SyntheticStatement(date(2026, 4, 1), date(2026, 9, 30), seed=11)
    a = ingest(user, first.text())
    a_before = {t["reference_number"] for t in _all(client, user, a)}
    assert len(a_before) == len(first.records)

    b = ingest(user, second.text())
    a_after = {t["reference_number"] for t in _all(client, user, a)}
    b_rows = {t["reference_number"] for t in _all(client, user, b)}
    assert a_after == a_before
    assert len(b_rows) == len(second.records)
    assert len(a_before & b_rows) > 0  # the overlap is shared, not moved

    assert client.delete(f"/statements/{b}", headers=user["headers"]).status_code == 204
    assert {t["reference_number"] for t in _all(client, user, a)} == a_before
    assert _analytics(client, user, a)["transaction_count"] == len(first.records)


def test_reupload_of_same_period_merges_instead_of_emptying(client, make_user, ingest):
    user = make_user()
    stmt = SyntheticStatement(date(2026, 2, 1), date(2026, 3, 31), seed=5)
    a = ingest(user, stmt.text())
    b = ingest(user, stmt.text())
    assert len(_all(client, user, a)) == len(stmt.records)
    assert len(_all(client, user, b)) == len(stmt.records)


def test_correction_sticks_across_reupload_and_teaches_next_statement(client, make_user, ingest):
    """F2: a correction survives an overlapping upload and categorises the
    same payee in a statement processed later."""
    user = make_user()
    jan_mar = SyntheticStatement(date(2026, 1, 1), date(2026, 3, 31), seed=21)
    a = ingest(user, jan_mar.text())

    target = next(
        t for t in _all(client, user, a, transaction_type="DEBIT") if t["counterparty_raw"] == "MAKE MY CHOICE"
    )
    assert target["category"] == "Uncategorized"
    res = client.post("/v1/feedback/", json={
        "transaction_id": target["id"], "original_prediction": "Uncategorized",
        "corrected_category": "Shopping", "confidence": 1.0,
    }, headers=user["headers"])
    assert res.status_code == 200, res.text
    assert a in res.json()["recomputed_statement_ids"]

    # Overlapping re-upload: the corrected rows stay corrected.
    b = ingest(user, SyntheticStatement(date(2026, 3, 1), date(2026, 5, 31), seed=21).text())
    for t in _all(client, user, a, merchant="MAKE MY CHOICE"):
        assert t["category"] == "Shopping"
    # New payments to the same payee in the later statement are categorised from memory.
    later = [t for t in _all(client, user, b, merchant="MAKE MY CHOICE")]
    assert later and all(t["category"] == "Shopping" for t in later)
    assert {t["categorization_source"] for t in later} <= {"user", "user_memory"}


def test_correction_recomputes_period_totals(client, make_user, ingest):
    """F3: Overview's breakdown follows a correction immediately."""
    user = make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 2, 28), seed=31).text())
    before = _analytics(client, user, a)
    revision = _statement(client, user, a)["analytics_revision"]
    uncategorized_before = next(
        (c["total_amount"] for c in before["category_breakdown"] if c["category"] == "Uncategorized"), 0
    )
    target = next(
        t for t in _all(client, user, a, transaction_type="DEBIT") if t["category"] == "Uncategorized"
    )
    moved = sum(t["amount"] for t in _all(client, user, a, merchant=target["merchant"], transaction_type="DEBIT")
                if t["merchant"] == target["merchant"])
    client.post("/v1/feedback/", json={
        "transaction_id": target["id"], "original_prediction": "Uncategorized",
        "corrected_category": "Education", "confidence": 1.0,
    }, headers=user["headers"])

    after = _analytics(client, user, a)
    by_cat = {c["category"]: c["total_amount"] for c in after["category_breakdown"]}
    assert round(by_cat.get("Education", 0), 2) == round(moved, 2)
    assert round(by_cat.get("Uncategorized", 0), 2) == round(uncategorized_before - moved, 2)
    assert _statement(client, user, a)["analytics_revision"] == revision + 1


def test_corrections_never_touch_money_received(client, make_user, ingest):
    """F4: credits cannot be recategorised, and a payment cannot become Income."""
    user = make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 1, 31), seed=41).text())
    credit = _all(client, user, a, transaction_type="CREDIT")[0]
    res = client.post("/v1/feedback/", json={
        "transaction_id": credit["id"], "original_prediction": "Income",
        "corrected_category": "Food", "confidence": 1.0,
    }, headers=user["headers"])
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "credit_not_correctable"

    debit = _all(client, user, a, transaction_type="DEBIT")[0]
    res = client.post("/v1/feedback/", json={
        "transaction_id": debit["id"], "original_prediction": debit["category"],
        "corrected_category": "Income", "confidence": 1.0,
    }, headers=user["headers"])
    assert res.status_code == 422


def test_recurring_payments_are_per_user_with_cadence_and_monthly_cost(client, make_user, ingest):
    user = make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 6, 30), seed=51).text())
    recurring = {r["merchant"]: r for r in _analytics(client, user, a)["recurring_payments"]}
    assert "Netflix" in recurring
    netflix = recurring["Netflix"]
    assert netflix["cadence"] == "monthly"
    assert netflix["typical_amount"] == 649
    assert netflix["estimated_monthly_cost"] == 649
    assert netflix["next_expected_at"] is not None
    # Many other users paying Netflix on other days must not change this user's result (F5).
    for seed in range(60, 66):
        ingest(make_user(), SyntheticStatement(date(2026, 1, 1), date(2026, 6, 30), seed=seed).text())
    from statements.recompute import recompute_statements
    client.portal.call(recompute_statements, user["id"], [a])
    again = {r["merchant"]: r for r in _analytics(client, user, a)["recurring_payments"]}
    assert again["Netflix"]["periodicity_score"] == netflix["periodicity_score"]


def test_unreadable_records_are_counted(client, make_user, ingest):
    user = make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 1, 31), seed=71).text(drop_layout_of=3))
    detail = _statement(client, user, a)
    assert detail["processing_status"] == "COMPLETED"
    assert detail["unparsed_count"] == 3
    assert detail["reconciliation_ok"] is False


def test_statement_with_no_transactions_fails_with_a_reason(client, make_user, ingest):
    user = make_user()
    text = SyntheticStatement(date(2026, 1, 1), date(2026, 1, 31), seed=81).text(drop_layout_of=10_000)
    a = ingest(user, text)
    detail = _statement(client, user, a)
    assert detail["processing_status"] == "FAILED"
    assert "could not read any transactions" in detail["error_message"]


def test_previous_period_is_by_date_not_upload_order(client, make_user, ingest):
    """F10: backfilling an earlier period after a later one."""
    from repositories.statement_repository import statement_repo

    user = make_user()
    later = ingest(user, SyntheticStatement(date(2026, 7, 1), date(2026, 9, 30), seed=91).text())
    earlier = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 3, 31), seed=91).text())

    async def previous_of(sid):
        statement = await statement_repo.get_by_id(sid)
        prev = await statement_repo.get_previous_completed(user["id"], statement)
        return prev.id if prev else None

    assert client.portal.call(previous_of, later) == earlier
    assert client.portal.call(previous_of, earlier) is None


def test_search_matches_reference_amount_and_payee(client, make_user, ingest):
    """F14/D7: the box searches what its placeholder promises."""
    user = make_user()
    stmt = SyntheticStatement(date(2026, 1, 1), date(2026, 1, 31), seed=101)
    a = ingest(user, stmt.text())
    record = next(r for r in stmt.records if r.direction == "Paid to")
    by_ref = _all(client, user, a, q=record.reference)
    assert [t["reference_number"] for t in by_ref] == [record.reference]
    by_amount = _all(client, user, a, q=f"₹{record.amount:,.0f}")
    assert any(t["reference_number"] == record.reference for t in by_amount)
    by_name = _all(client, user, a, q=record.counterparty.lower()[:5])
    assert any(t["reference_number"] == record.reference for t in by_name)


def test_people_are_told_apart_from_businesses(client, make_user, ingest):
    user = make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 3, 31), seed=111).text())
    kinds = {t["counterparty_raw"]: t["counterparty_kind"] for t in _all(client, user, a)}
    assert kinds["RAVI KUMAR"] == "person"
    assert kinds["ZOMATO LIMITED"] == "business"
    assert kinds["Netflix"] == "business"


def test_bad_dates_are_a_422_not_a_500(client, make_user, ingest):
    user = make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 1, 31), seed=121).text())
    res = client.get(f"/statements/{a}/transactions", params={"start_date": "yesterday"}, headers=user["headers"])
    assert res.status_code == 422
    whole_day = _all(client, user, a, start_date="2026-01-31", end_date="2026-01-31")
    assert all(t["timestamp"] >= "2026-01-30T18:30" for t in whole_day)
