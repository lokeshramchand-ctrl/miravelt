"""POST /v1/explain grounded in the caller's own transaction and history
(PROJECT_AUDIT.md F12) - against a live MongoDB. The model is unreachable in
the test environment, which is exactly the case the computed fallback is for.
"""
from datetime import date

from rag.context_builder import context_builder
from statements.synthetic import SyntheticStatement


def _debits(client, user, statement_id, **params):
    res = client.get(f"/statements/{statement_id}/transactions",
                     params={"page_size": 100, "transaction_type": "DEBIT", **params}, headers=user["headers"])
    assert res.status_code == 200, res.text
    return res.json()["items"]


def test_explain_uses_this_users_history(client, make_user, ingest):
    user = make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 6, 30), seed=301).text())
    netflix = next(t for t in _debits(client, user, a, merchant="Netflix") if t["merchant"] == "Netflix")

    res = client.post("/v1/explain", json={"transaction_id": netflix["id"]}, headers=user["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["grounded"] is True
    assert body["retrieved_documents"] >= 5  # six monthly payments in the period
    assert "error" not in body["result"]
    assert body["result"]["generated"] is False  # no model here; computed facts answer
    text = body["result"]["explanation"]
    assert "Netflix" in text and "monthly" in text and "₹649" in text
    assert body["facts"] and " ".join(body["facts"]) == text


def test_explain_reflects_a_correction(client, make_user, ingest):
    user = make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 3, 31), seed=311).text())
    target = next(t for t in _debits(client, user, a) if t["category"] == "Uncategorized")
    before = client.post("/v1/explain", json={"transaction_id": target["id"]}, headers=user["headers"]).json()
    assert "does not recognise" in before["facts"][0]

    client.post("/v1/feedback/", json={
        "transaction_id": target["id"], "original_prediction": "Uncategorized",
        "corrected_category": "Shopping", "confidence": 1.0,
    }, headers=user["headers"])
    after = client.post("/v1/explain", json={"transaction_id": target["id"]}, headers=user["headers"]).json()
    assert after["facts"][0].startswith("You filed") and "Shopping" in after["facts"][0]


def test_explain_never_reads_another_users_transaction(client, make_user, ingest):
    owner, stranger = make_user(), make_user()
    a = ingest(owner, SyntheticStatement(date(2026, 1, 1), date(2026, 1, 31), seed=321).text())
    target = _debits(client, owner, a)[0]
    res = client.post("/v1/explain", json={"transaction_id": target["id"]}, headers=stranger["headers"])
    assert res.status_code == 404


def test_explain_by_text_without_history_calls_nothing(client, make_user, monkeypatch):
    from rag.generator import explanation_generator

    async def _must_not_run(**_):
        raise AssertionError("the model must not be called without grounded context")

    monkeypatch.setattr(explanation_generator, "generate_explanation", _must_not_run)
    user = make_user()
    res = client.post("/v1/explain", json={"transaction_text": "Paid to Somebody Unknown"}, headers=user["headers"])
    assert res.status_code == 200
    body = res.json()
    assert body["grounded"] is False and body["retrieved_documents"] == 0
    assert "error" in body["result"]


def test_a_generated_answer_with_an_invented_number_is_replaced(client, make_user, ingest, monkeypatch):
    from rag.generator import explanation_generator

    async def _invents(**_):
        return {"explanation": "You paid Netflix ₹98,765 last week.", "confidence_in_explanation": "HIGH",
                "primary_data_source": "Netflix"}

    monkeypatch.setattr(explanation_generator, "generate_explanation", _invents)
    user = make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 6, 30), seed=331).text())
    netflix = next(t for t in _debits(client, user, a, merchant="Netflix") if t["merchant"] == "Netflix")
    body = client.post("/v1/explain", json={"transaction_id": netflix["id"]}, headers=user["headers"]).json()
    assert body["result"]["generated"] is False
    assert "98,765" not in body["result"]["explanation"]


def test_a_generated_answer_that_holds_up_is_kept(client, make_user, ingest, monkeypatch):
    from rag.generator import explanation_generator

    async def _faithful(**_):
        return {"explanation": "Netflix is a known merchant. You usually pay ₹649 monthly.",
                "confidence_in_explanation": "HIGH", "primary_data_source": "Netflix"}

    monkeypatch.setattr(explanation_generator, "generate_explanation", _faithful)
    user = make_user()
    a = ingest(user, SyntheticStatement(date(2026, 1, 1), date(2026, 6, 30), seed=341).text())
    netflix = next(t for t in _debits(client, user, a, merchant="Netflix") if t["merchant"] == "Netflix")
    body = client.post("/v1/explain", json={"transaction_id": netflix["id"]}, headers=user["headers"]).json()
    assert body["result"]["generated"] is True
    assert body["result"]["explanation"].startswith("Netflix is a known merchant")


def test_facts_for_money_received():
    facts = context_builder.facts({
        "transaction": {"merchant": "RAVI KUMAR", "payee_name": "RAVI KUMAR", "amount": 500.0,
                        "paid_on": "2026-01-05", "direction": "received", "category": "Income",
                        "categorized_by": "income", "counterparty_kind": "person"},
        "history": {"payments": 1},
        "pattern": None,
        "memory": {},
    })
    assert "income" in facts[0].lower()
    assert "only time" in facts[1]


def test_prompt_block_is_the_no_context_sentinel_when_empty():
    assert context_builder.build_prompt_string(None) == "NO_CONTEXT_AVAILABLE"
