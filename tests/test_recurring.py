"""analytics/recurring.py - the per-user recurring model (PROJECT_AUDIT.md A3,
F5, F6). Pure functions, no database."""
from datetime import UTC, datetime, timedelta

from hypothesis import given, settings
from hypothesis import strategies as st

from analytics.recurring import DAYS_PER_MONTH, Payment, detect, months_covered

START = datetime(2026, 1, 5, 6, 0, tzinfo=UTC)


def _every(days: float, count: int, amount: float = 649.0, start: datetime = START) -> list[Payment]:
    return [Payment(start + timedelta(days=days * i), amount) for i in range(count)]


def test_monthly_subscription():
    pattern = detect(_every(DAYS_PER_MONTH, 6))
    assert pattern is not None
    assert pattern.cadence == "monthly"
    assert pattern.typical_amount == 649
    assert pattern.monthly_equivalent == 649
    assert pattern.occurrences == 6
    assert pattern.next_expected_at > pattern.last_paid_at


def test_weekly_payment_is_not_reported_as_its_own_amount_per_month():
    """F6: a weekly ₹200 costs about ₹870 a month, not ₹200."""
    pattern = detect(_every(7, 8, amount=200.0))
    assert pattern.cadence == "weekly"
    assert pattern.typical_amount == 200
    assert round(pattern.monthly_equivalent) == round(200 * DAYS_PER_MONTH / 7)


def test_quarterly_and_yearly():
    assert detect(_every(91, 3, amount=1500.0)).cadence == "quarterly"
    assert detect(_every(365, 2, amount=1499.0)).cadence == "yearly"


def test_a_skipped_month_does_not_break_a_monthly_series():
    payments = _every(DAYS_PER_MONTH, 7)
    del payments[3]
    pattern = detect(payments)
    assert pattern is not None and pattern.cadence == "monthly"


def test_too_few_payments_is_not_recurring():
    assert detect(_every(DAYS_PER_MONTH, 2)) is None  # monthly needs three
    assert detect(_every(7, 3)) is None  # weekly needs four
    assert detect([Payment(START, 100.0)]) is None
    assert detect([]) is None


def test_irregular_visits_are_not_recurring():
    days = [0, 2, 3, 11, 12, 30, 31, 47, 80]
    payments = [Payment(START + timedelta(days=d), 300.0) for d in days]
    assert detect(payments) is None


def test_same_day_orders_count_once():
    payments = _every(DAYS_PER_MONTH, 4, amount=300.0)
    payments.append(Payment(payments[0].timestamp + timedelta(hours=2), 300.0))
    pattern = detect(payments)
    assert pattern is not None
    assert pattern.occurrences == 4


def test_price_rise_is_reported_against_earlier_payments():
    payments = _every(DAYS_PER_MONTH, 5, amount=199.0)
    payments.append(Payment(payments[-1].timestamp + timedelta(days=DAYS_PER_MONTH), 249.0))
    pattern = detect(payments)
    assert pattern.last_amount == 249
    assert round(pattern.amount_change, 3) == round((249 - 199) / 199, 3)


def test_wildly_different_amounts_to_one_payee_are_not_a_subscription():
    amounts = [120.0, 4000.0, 60.0, 2500.0, 15.0, 900.0]
    payments = [Payment(START + timedelta(days=DAYS_PER_MONTH * i), a) for i, a in enumerate(amounts)]
    assert detect(payments) is None


def test_other_users_payments_cannot_change_the_result():
    """F5, as a property of the interface: detect() sees one user's payments
    and nothing else. The old scorer pooled every user's timestamps for a
    merchant, so 40 monthly payers on different days looked like a daily burst."""
    mine = _every(DAYS_PER_MONTH, 6)
    alone = detect(mine)
    pooled = list(mine)
    for other in range(1, 40):
        pooled += _every(DAYS_PER_MONTH, 6, start=START + timedelta(days=other % 28, hours=other))
    assert alone.cadence == "monthly"
    # Pooled, the same data stops looking monthly - which is why it is never pooled.
    assert detect(pooled) is None or detect(pooled).cadence != "monthly"


@settings(max_examples=60, deadline=None)
@given(
    cadence_days=st.sampled_from([7.0, 14.0, DAYS_PER_MONTH, 91.0]),
    count=st.integers(min_value=4, max_value=14),
    amount=st.floats(min_value=10, max_value=50_000, allow_nan=False),
    # A payment landing a day late: every gap stays within a day of the cadence.
    jitter=st.lists(st.integers(min_value=0, max_value=1), min_size=14, max_size=14),
)
def test_a_regular_series_is_always_detected_with_a_sane_monthly_cost(cadence_days, count, amount, jitter):
    payments = [
        Payment(START + timedelta(days=cadence_days * i + jitter[i]), amount) for i in range(count)
    ]
    pattern = detect(payments)
    assert pattern is not None
    assert pattern.typical_amount == round(amount, 2)
    expected_monthly = amount * DAYS_PER_MONTH / pattern.cadence_days
    assert abs(pattern.monthly_equivalent - expected_monthly) <= max(0.05, expected_monthly * 0.001)
    assert pattern.next_expected_at > pattern.last_paid_at
    assert 0.7 <= pattern.regularity <= 1.0


def test_months_covered_is_at_least_one():
    assert months_covered(START, START + timedelta(days=3)) == 1.0
    assert round(months_covered(START, START + timedelta(days=183)), 1) == 6.0
