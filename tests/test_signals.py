"""insights/signals.py - computed, per-user signals (PROJECT_AUDIT.md C1-C4).
Pure functions over plain rows, no database."""
from datetime import UTC, datetime, timedelta

from insights.signals import (
    compute_signals,
    first_time_large,
    largest_payment,
    possible_duplicates,
    unusual_amounts,
)
from models.schemas import InsightSeverity

T0 = datetime(2026, 3, 2, 7, 0, tzinfo=UTC)


def _row(merchant, amount, days=0.0, *, kind="business", type_="DEBIT", category="Food", minutes=0):
    return {
        "merchant": merchant, "amount": float(amount),
        "timestamp": T0 + timedelta(days=days, minutes=minutes),
        "transaction_type": type_, "category": category, "counterparty_kind": kind,
    }


def _text(items):
    return " | ".join(i.message for i in items)


def test_a_payment_far_above_this_users_usual_is_flagged():
    history = [_row("Zomato", a, days=-d) for d, a in enumerate([300, 320, 280, 310, 290, 305, 315], start=1)]
    period = [_row("Zomato", 2400, days=0)]
    found = unusual_amounts(period, history + period)
    assert len(found) == 1
    assert "Zomato" in _text(found)
    assert found[0].severity == InsightSeverity.WARNING


def test_an_ordinary_payment_is_not_flagged():
    history = [_row("Zomato", a, days=-d) for d, a in enumerate([300, 320, 280, 310, 290, 305, 315], start=1)]
    period = [_row("Zomato", 330, days=0)]
    assert unusual_amounts(period, history + period) == []


def test_same_amount_to_same_merchant_minutes_apart_is_a_possible_duplicate():
    period = [_row("Blinkit", 499, minutes=0), _row("Blinkit", 499, minutes=3), _row("Blinkit", 120, days=2)]
    found = possible_duplicates(period)
    assert len(found) == 1 and "Blinkit" in _text(found)


def test_same_amount_days_apart_is_not_a_duplicate():
    period = [_row("Netflix", 649, days=0), _row("Netflix", 649, days=30)]
    assert possible_duplicates(period) == []


def test_first_time_large_ignores_people_and_known_merchants():
    history = [_row("Zomato", 300, days=-10)]
    period = [_row("Swiggy", 200, days=d) for d in range(3, 15)] + [
        _row("Zomato", 5000, days=1),                       # seen before
        _row("RAVI KUMAR", 12000, days=1, kind="person"),   # a person, not a merchant
        _row("Decathlon", 6400, days=2),                    # new and large
    ]
    history.append(_row("Swiggy", 200, days=-20))
    text = _text(first_time_large(period, history + period))
    assert "Decathlon" in text and "RAVI" not in text and "Zomato" not in text


def test_largest_payment_names_the_biggest_debit():
    period = [_row("Zomato", 300), _row("Decathlon", 6400, days=1), _row("ACME", 65000, days=2, type_="CREDIT")]
    text = _text(largest_payment(period))
    assert "Decathlon" in text and "65,000" not in text


def test_compute_signals_on_an_empty_period_is_empty_and_does_not_raise():
    assert compute_signals([], [], [], period_days=30.0, previous_days=None, total_income=0.0, total_spend=0.0) == []


def test_every_signal_is_marked_computed():
    history = [_row("Zomato", a, days=-d) for d, a in enumerate([300, 320, 280, 310, 290, 305, 315], start=1)]
    period = [_row("Zomato", 2400), _row("Blinkit", 499, minutes=0), _row("Blinkit", 499, minutes=3)]
    signals = compute_signals(
        period, history + period, [], period_days=30.0, previous_days=None, total_income=65000.0, total_spend=3398.0
    )
    assert signals and all(s.origin == "computed" for s in signals)
