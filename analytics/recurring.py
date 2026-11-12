"""Per-user recurring payment detection (PROJECT_AUDIT.md A3, F5, F6).

Replaces the old approach - a periodicity score computed over *every user's*
payments to a merchant name, joined against one statement's rows, with the
last row's amount labelled "per month" whatever the cadence. Pooling made
detection collapse as users were added (three monthly payers on different
days score 0.88, forty score 0.0), and a weekly ₹200 counted as ₹200 a month.

Here, for one user and one merchant:

1. cadence  - the median gap between distinct payment days, snapped to the
              nearest known cadence (weekly ... yearly) if within tolerance
2. regular  - the share of gaps that sit on that cadence (tolerating a
              skipped cycle, e.g. a 60-day gap in a monthly series)
3. amount   - the median of the last three payments (robust to a one-off)
4. monthly  - amount x (30.44 / cadence days)
5. next     - last payment + cadence
6. change   - latest amount against the median of the payments before it

Pure functions over plain values: no database, unit-tested in
tests/test_recurring.py.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import median

from core.timezone import local_date

DAYS_PER_MONTH = 30.4375

# name, nominal days, tolerance in days
CADENCES: tuple[tuple[str, float, float], ...] = (
    ("weekly", 7.0, 1.5),
    ("fortnightly", 14.0, 2.5),
    ("monthly", DAYS_PER_MONTH, 4.5),
    ("quarterly", 91.3, 10.0),
    ("yearly", 365.25, 20.0),
)

MIN_OCCURRENCES = {"weekly": 4, "fortnightly": 3, "monthly": 3, "quarterly": 2, "yearly": 2}
MIN_REGULARITY = 0.7
# A payment of wildly different size is a different kind of payment to the
# same payee, not the subscription: the amount must stay within this factor
# of the median for at least MIN_AMOUNT_STABILITY of the payments.
AMOUNT_BAND = 0.5
MIN_AMOUNT_STABILITY = 0.6


@dataclass(frozen=True)
class Payment:
    timestamp: datetime
    amount: float


@dataclass(frozen=True)
class RecurringPattern:
    cadence: str
    cadence_days: float
    regularity: float
    occurrences: int
    typical_amount: float
    last_amount: float
    monthly_equivalent: float
    last_paid_at: datetime
    next_expected_at: datetime
    amount_change: float | None


def _match_cadence(gap_days: float) -> tuple[str, float, float] | None:
    for cadence in CADENCES:
        _, nominal, tolerance = cadence
        if abs(gap_days - nominal) <= tolerance:
            return cadence
    return None


def _on_cadence(gap: float, nominal: float, tolerance: float) -> bool:
    """A gap of k cycles (k = 1..3) counts: a skipped month is still monthly."""
    for k in (1, 2, 3):
        if abs(gap - k * nominal) <= tolerance * k:
            return True
    return False


def detect(payments: list[Payment]) -> RecurringPattern | None:
    """The recurring pattern in one payee's payments, or None."""
    if len(payments) < 2:
        return None
    ordered = sorted(payments, key=lambda p: p.timestamp)

    # One point per local day: two orders from the same shop on one evening
    # are one visit, not a 0-day cadence. The day's amounts are summed.
    by_day: dict = {}
    for p in ordered:
        day = local_date(p.timestamp)
        if day in by_day:
            first_ts, amount = by_day[day]
            by_day[day] = (first_ts, amount + p.amount)
        else:
            by_day[day] = (p.timestamp, p.amount)
    days = sorted(by_day)
    if len(days) < 2:
        return None

    gaps = [(days[i] - days[i - 1]).days for i in range(1, len(days))]
    cadence = _match_cadence(median(gaps))
    if cadence is None:
        return None
    name, nominal, tolerance = cadence
    if len(days) < MIN_OCCURRENCES[name]:
        return None

    on_cadence = sum(1 for g in gaps if _on_cadence(g, nominal, tolerance))
    regularity = on_cadence / len(gaps)
    if regularity < MIN_REGULARITY:
        return None

    amounts = [by_day[d][1] for d in days]
    overall = median(amounts)
    if overall <= 0:
        return None
    stable = sum(1 for a in amounts if abs(a - overall) <= AMOUNT_BAND * overall)
    if stable / len(amounts) < MIN_AMOUNT_STABILITY:
        return None

    typical = median(amounts[-3:])
    last_ts, last_amount = by_day[days[-1]]
    earlier = amounts[:-1]
    baseline = median(earlier[-3:]) if earlier else None
    change = (last_amount - baseline) / baseline if baseline else None

    return RecurringPattern(
        cadence=name,
        cadence_days=round(nominal, 2),
        regularity=round(regularity, 4),
        occurrences=len(days),
        typical_amount=round(typical, 2),
        last_amount=round(last_amount, 2),
        monthly_equivalent=round(typical * DAYS_PER_MONTH / nominal, 2),
        last_paid_at=last_ts,
        next_expected_at=last_ts + timedelta(days=nominal),
        amount_change=round(change, 4) if change is not None else None,
    )


def months_covered(start: datetime, end: datetime) -> float:
    """Length of a period in months, at least one."""
    return max((end - start).total_seconds() / 86400.0 / DAYS_PER_MONTH, 1.0)
