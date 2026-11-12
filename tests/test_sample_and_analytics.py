"""The sample period (PROJECT_AUDIT.md E1), the teach deck (B2/B4), the people
ledger (B3), the merchant page (D8) and the arithmetic the Overview shows
(F6-F8) - against a live MongoDB."""
from datetime import date

from statements.synthetic import SyntheticStatement


def _process(client, body):
    from statements.statement_service import statement_service

    client.portal.call(statement_service.process_statement, body["statement_id"], body["job_id"])


def test_sample_statement_goes_through_the_real_pipeline_once(client, make_user):
    user = make_user()
    res = client.post("/statements/sample", headers=user["headers"])
    assert res.status_code == 202, res.text
    _process(client, res.json())

    detail = client.get(f"/statements/{res.json()['statement_id']}", headers=user["headers"]).json()
    assert detail["processing_status"] == "COMPLETED"
    assert detail["is_sample"] is True
    assert detail["reconciliation_ok"] is True
    assert detail["unparsed_count"] == 0
    assert detail["transaction_count"] > 50

    again = client.post("/statements/sample", headers=user["headers"])
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "duplicate_statement"
    assert again.json()["error"]["statement_id"] == res.json()["statement_id"]


def test_overview_arithmetic_holds(client, make_user, ingest):
    """Categories add up to what was sent, income never counts as spending,
    and a recurring payment is costed per month, not per period."""
    user = make_user()
    stmt = SyntheticStatement(date(2026, 1, 1), date(2026, 6, 30), seed=401)
    a = ingest(user, stmt.text())
    analytics = client.get(f"/statements/{a}/analytics", headers=user["headers"]).json()

    assert round(analytics["total_spend"], 2) == stmt.sent
    assert round(analytics["total_income"], 2) == stmt.received
    # The breakdown covers every row; Income is its own line, and the app
    # leaves it out of "where it went" (frontend spendingBreakdown()).
    breakdown = {c["category"]: c["total_amount"] for c in analytics["category_breakdown"]}
    assert round(breakdown.pop("Income"), 2) == stmt.received
    assert round(sum(breakdown.values()), 2) == stmt.sent
    assert sum(c["count"] for c in analytics["category_breakdown"]) == analytics["transaction_count"]
    assert round(sum(d["total_amount"] for d in analytics["daily_trend"]), 2) == stmt.sent

    months = 6
    assert abs(analytics["average_monthly_spend"] - stmt.sent / months) < stmt.sent / months * 0.03
    netflix = next(r for r in analytics["recurring_payments"] if r["merchant"] == "Netflix")
    assert netflix["estimated_monthly_cost"] == 649
    assert netflix["estimated_monthly_cost"] < analytics["average_monthly_spend"]


def test_teach_deck_covers_the_unknown_spend_and_answers_update_totals(client, make_user, ingest):
    user = make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 3, 31), seed=411).text())
    deck = client.get("/v1/teach", params={"statement_id": a}, headers=user["headers"]).json()
    assert deck["cards"], "the synthetic statement has payees the rules do not know"
    assert deck["cards"] == sorted(deck["cards"], key=lambda c: -c["total_amount"])
    assert abs(sum(c["share_of_unknown"] for c in deck["cards"]) - deck["covered_share"]) < 0.001
    assert all("suggested_category" in c and "similar_names" in c for c in deck["cards"])

    business = next(c for c in deck["cards"] if c["counterparty_kind"] == "business")
    before = client.get(f"/statements/{a}/analytics", headers=user["headers"]).json()
    uncategorized_before = next(c["total_amount"] for c in before["category_breakdown"] if c["category"] == "Uncategorized")

    res = client.post("/v1/teach", json={"answers": [{"merchant": business["merchant"], "category": "Shopping"}]},
                      headers=user["headers"])
    assert res.status_code == 200, res.text
    assert res.json()["applied"] == 1 and a in res.json()["recomputed_statement_ids"]

    after = client.get(f"/statements/{a}/analytics", headers=user["headers"]).json()
    uncategorized_after = next(
        (c["total_amount"] for c in after["category_breakdown"] if c["category"] == "Uncategorized"), 0.0
    )
    assert round(uncategorized_before - uncategorized_after, 2) == business["total_amount"]
    remaining = client.get("/v1/teach", params={"statement_id": a}, headers=user["headers"]).json()
    assert business["merchant"] not in {c["merchant"] for c in remaining["cards"]}

    assert client.post("/v1/teach", json={"answers": [{"merchant": "x", "category": "Income"}]},
                       headers=user["headers"]).status_code == 422


def test_people_ledger_nets_sent_against_received(client, make_user, ingest):
    user = make_user()
    stmt = SyntheticStatement(date(2026, 1, 1), date(2026, 6, 30), seed=421)
    ingest(user, stmt.text())
    people = {p["name"]: p for p in client.get("/v1/people", headers=user["headers"]).json()["people"]}
    assert "RAVI KUMAR" in people and "ZOMATO LIMITED" not in people

    for name, row in people.items():
        sent = round(sum(r.amount for r in stmt.records if r.counterparty == name and r.direction == "Paid to"), 2)
        received = round(
            sum(r.amount for r in stmt.records if r.counterparty == name and r.direction == "Received from"), 2
        )
        assert (row["sent"], row["received"], row["net"]) == (sent, received, round(received - sent, 2))

    history = client.get(f"/v1/people/{people['RAVI KUMAR']['payee_key']}/transactions", headers=user["headers"])
    assert history.status_code == 200
    assert len(history.json()) == people["RAVI KUMAR"]["count"]


def test_merchant_page_and_cross_period_search(client, make_user, ingest):
    user = make_user()
    ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 3, 31), seed=431).text())
    ingest(user, SyntheticStatement(date(2026, 4, 1), date(2026, 6, 30), seed=431).text())

    page = client.get("/v1/merchants/Netflix", headers=user["headers"]).json()
    assert page["payment_count"] == 6 and page["total_spent"] == 6 * 649
    assert page["cadence"] == "monthly" and page["typical_amount"] == 649
    assert [m["month"] for m in page["monthly"]] == [f"2026-0{m}" for m in range(1, 7)]
    assert client.get("/v1/merchants/Nobody Here", headers=user["headers"]).status_code == 404

    # One search across both periods (D7).
    found = client.get("/v1/transactions", params={"q": "netflix", "page_size": 50}, headers=user["headers"]).json()
    assert found["total"] == 6


def test_notes_and_tags_on_a_transaction(client, make_user, ingest):
    user, stranger = make_user(), make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 1, 31), seed=441).text())
    txn = client.get(f"/statements/{a}/transactions", params={"page_size": 1}, headers=user["headers"]).json()["items"][0]

    res = client.patch(f"/v1/transactions/{txn['id']}", json={"note": "Team lunch", "tags": ["work", "reimburse"]},
                       headers=user["headers"])
    assert res.status_code == 200, res.text
    assert res.json()["note"] == "Team lunch" and sorted(res.json()["tags"]) == ["reimburse", "work"]
    found = client.get("/v1/transactions", params={"q": "reimburse"}, headers=user["headers"]).json()
    assert [t["id"] for t in found["items"]] == [txn["id"]]

    assert client.patch(f"/v1/transactions/{txn['id']}", json={"note": "mine now"},
                        headers=stranger["headers"]).status_code == 404
