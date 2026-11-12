"""Computed signals from this user's own transactions (PROJECT_AUDIT.md C1-C4).

Every figure here is arithmetic on stored rows - nothing is generated - so
these are always shown, LLM or not:

C1  unusual_amount      a payment far above this user's usual for that payee
                        (median and MAD, not mean and standard deviation, so
                        one past splurge does not hide the next)
    possible_duplicate  same payee, same amount, minutes apart
    first_time_large    a large first payment to a new payee
    largest_payment     the single biggest payment of the period
C2  category_change     "Food is up ₹4,200 a month. ₹3,100 of that is 3 new places."
C3  weekend_habit       weekend days cost noticeably more than weekdays
    late_night          a habit of late-night spending
C4  salary_detected     a regular monthly credit from one source
    savings_rate        share of income kept this period

Pure functions over plain rows - tests/test_signals.py. Rows are dicts with
merchant, amount, timestamp, transaction_type, category, counterparty_kind.
"""
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from statistics import median
from typing import Any

from analytics.recurring import DAYS_PER_MONTH, Payment, detect
from core.timezone import APP_TZ, local_date
from models.schemas import InsightItem, InsightSeverity

DEBIT, CREDIT = "DEBIT", "CREDIT"
_SKIP_CATEGORIES = {"Income", "Uncategorized", "Unknown", None}

ROBUST_Z = 3.5
MIN_HISTORY = 5
MIN_UNUSUAL_EXCESS = 200.0
DUPLICATE_WINDOW = timedelta(minutes=10)
FIRST_TIME_MIN = 1000.0
CATEGORY_CHANGE_MIN = 1000.0  # per month
WEEKEND_RATIO = 1.3
LATE_NIGHT_MIN = 4
SALARY_MIN = 5000.0


def _rupees(value: float) -> str:
    return f"₹{value:,.0f}"


def unusual_amounts(period: list[dict], history: list[dict]) -> list[InsightItem]:
    """C1: payments far above this user's usual for the payee."""
    by_merchant: dict[str, list[tuple[datetime, float]]] = defaultdict(list)
    for row in history:
        if row["transaction_type"] == DEBIT:
            by_merchant[row["merchant"]].append((row["timestamp"], row["amount"]))
    items = []
    for row in period:
        if row["transaction_type"] != DEBIT:
            continue
        prior = [a for ts, a in by_merchant.get(row["merchant"], []) if ts < row["timestamp"]]
        if len(prior) < MIN_HISTORY:
            continue
        med = median(prior)
        mad = median(abs(a - med) for a in prior) or max(med * 0.05, 1.0)
        z = 0.6745 * (row["amount"] - med) / mad
        if z > ROBUST_Z and row["amount"] - med >= MIN_UNUSUAL_EXCESS:
            items.append(InsightItem(
                type="unusual_amount",
                message=(
                    f"{_rupees(row['amount'])} to {row['merchant']} on {local_date(row['timestamp']):%d %b} "
                    f"is well above your usual {_rupees(med)} there."
                ),
                severity=InsightSeverity.WARNING,
            ))
    return items[:3]


def possible_duplicates(period: list[dict]) -> list[InsightItem]:
    debits = sorted((r for r in period if r["transaction_type"] == DEBIT), key=lambda r: r["timestamp"])
    items, seen = [], set()
    for i, row in enumerate(debits):
        for other in debits[i + 1:]:
            if other["timestamp"] - row["timestamp"] > DUPLICATE_WINDOW:
                break
            key = (row["merchant"], row["amount"], local_date(row["timestamp"]))
            if other["merchant"] == row["merchant"] and other["amount"] == row["amount"] and key not in seen:
                seen.add(key)
                items.append(InsightItem(
                    type="possible_duplicate",
                    message=(
                        f"Two payments of {_rupees(row['amount'])} to {row['merchant']} minutes apart on "
                        f"{local_date(row['timestamp']):%d %b}. Check it was not charged twice."
                    ),
                    severity=InsightSeverity.WARNING,
                ))
    return items[:3]


def first_time_large(period: list[dict], history: list[dict]) -> list[InsightItem]:
    first_seen: dict[str, datetime] = {}
    for row in history:
        if row["transaction_type"] == DEBIT:
            ts = row["timestamp"]
            if row["merchant"] not in first_seen or ts < first_seen[row["merchant"]]:
                first_seen[row["merchant"]] = ts
    debits = [r["amount"] for r in period if r["transaction_type"] == DEBIT]
    if not debits:
        return []
    threshold = max(FIRST_TIME_MIN, 2 * (sum(debits) / len(debits)))
    items = []
    for row in sorted(period, key=lambda r: -r["amount"]):
        if row["transaction_type"] != DEBIT or row["amount"] < threshold:
            continue
        if first_seen.get(row["merchant"]) == row["timestamp"] and row.get("counterparty_kind") != "person":
            items.append(InsightItem(
                type="first_time_large",
                message=f"First payment to {row['merchant']}: {_rupees(row['amount'])}.",
                severity=InsightSeverity.INFO,
            ))
    return items[:2]


def largest_payment(period: list[dict]) -> list[InsightItem]:
    debits = [r for r in period if r["transaction_type"] == DEBIT]
    if len(debits) < 2:
        return []
    top = max(debits, key=lambda r: r["amount"])
    return [InsightItem(
        type="largest_payment",
        message=(
            f"Your largest payment was {_rupees(top['amount'])} to {top['merchant']} "
            f"on {local_date(top['timestamp']):%d %b}."
        ),
        severity=InsightSeverity.INFO,
    )]


def category_change(
    period: list[dict], previous: list[dict], period_months: float, previous_months: float
) -> list[InsightItem]:
    """C2: the category that moved most against the previous period, per
    month, and how much of the move came from places new this period."""
    if not previous:
        return []

    def per_category(rows):
        totals: dict[str, float] = defaultdict(float)
        merchants: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for r in rows:
            if r["transaction_type"] == DEBIT and r.get("category") not in _SKIP_CATEGORIES:
                totals[r["category"]] += r["amount"]
                merchants[r["category"]][r["merchant"]] += r["amount"]
        return totals, merchants

    cur_totals, cur_merchants = per_category(period)
    prev_totals, prev_merchants = per_category(previous)
    best = None
    for cat in set(cur_totals) | set(prev_totals):
        delta = cur_totals.get(cat, 0) / period_months - prev_totals.get(cat, 0) / previous_months
        if abs(delta) >= CATEGORY_CHANGE_MIN and (best is None or abs(delta) > abs(best[1])):
            best = (cat, delta)
    if best is None:
        return []
    cat, delta = best
    direction = "up" if delta > 0 else "down"
    message = f"{cat} is {direction} {_rupees(abs(delta))} a month against the previous period."
    if delta > 0:
        known = set(prev_merchants.get(cat, {}))
        new = {m: a for m, a in cur_merchants.get(cat, {}).items() if m not in known}
        new_monthly = sum(new.values()) / period_months
        if new and new_monthly >= 0.25 * delta:
            places = "place" if len(new) == 1 else "places"
            message += f" {_rupees(min(new_monthly, delta))} of that is {len(new)} new {places}."
    return [InsightItem(
        type="category_change",
        message=message,
        severity=InsightSeverity.WARNING if delta > 0 else InsightSeverity.POSITIVE,
    )]


def habits(period: list[dict]) -> list[InsightItem]:
    """C3: weekend against weekday spend per day, and late-night spending."""
    debits = [r for r in period if r["transaction_type"] == DEBIT and r.get("counterparty_kind") != "person"]
    if len(debits) < 10:
        return []
    days = sorted({local_date(r["timestamp"]) for r in period})
    if not days:
        return []
    all_days = [days[0] + timedelta(days=i) for i in range((days[-1] - days[0]).days + 1)]
    weekend_days = sum(1 for d in all_days if d.weekday() >= 5)
    weekday_days = len(all_days) - weekend_days
    items = []
    if weekend_days and weekday_days:
        weekend = sum(r["amount"] for r in debits if local_date(r["timestamp"]).weekday() >= 5) / weekend_days
        weekday = sum(r["amount"] for r in debits if local_date(r["timestamp"]).weekday() < 5) / weekday_days
        if weekday > 0 and weekend / weekday >= WEEKEND_RATIO:
            items.append(InsightItem(
                type="weekend_habit",
                message=f"Weekends cost you {_rupees(weekend)} a day, against {_rupees(weekday)} on weekdays.",
                severity=InsightSeverity.INFO,
            ))
    late = [r for r in debits if _hour(r["timestamp"]) >= 23 or _hour(r["timestamp"]) < 4]
    if len(late) >= LATE_NIGHT_MIN:
        items.append(InsightItem(
            type="late_night",
            message=f"{len(late)} payments after 11 PM this period, {_rupees(sum(r['amount'] for r in late))} in all.",
            severity=InsightSeverity.INFO,
        ))
    return items


def _hour(ts: datetime) -> int:
    return (ts if ts.tzinfo else ts.replace(tzinfo=UTC)).astimezone(APP_TZ).hour


def income(period: list[dict], history: list[dict], total_income: float, total_spend: float) -> list[InsightItem]:
    """C4: salary-like credits and the period's savings rate."""
    items = []
    by_source: dict[str, list[Payment]] = defaultdict(list)
    for r in history:
        if r["transaction_type"] == CREDIT:
            by_source[r["merchant"]].append(Payment(r["timestamp"], r["amount"]))
    period_sources = {r["merchant"] for r in period if r["transaction_type"] == CREDIT}
    for source in period_sources:
        pattern = detect(by_source.get(source, []))
        if pattern and pattern.cadence == "monthly" and pattern.typical_amount >= SALARY_MIN:
            items.append(InsightItem(
                type="salary_detected",
                message=f"{source} pays you about {_rupees(pattern.typical_amount)} every month.",
                severity=InsightSeverity.POSITIVE,
            ))
    if total_income >= SALARY_MIN:
        rate = (total_income - total_spend) / total_income
        if rate > 0:
            items.append(InsightItem(
                type="savings_rate",
                message=f"You kept {rate * 100:.0f}% of what came in this period.",
                severity=InsightSeverity.POSITIVE,
            ))
    return items[:2]


def compute_signals(
    period: list[dict[str, Any]],
    history: list[dict[str, Any]],
    previous: list[dict[str, Any]],
    *,
    period_days: float,
    previous_days: float | None,
    total_income: float,
    total_spend: float,
) -> list[InsightItem]:
    period_months = max(period_days / DAYS_PER_MONTH, 1.0)
    previous_months = max((previous_days or period_days) / DAYS_PER_MONTH, 1.0)
    return (
        possible_duplicates(period)
        + unusual_amounts(period, history)
        + first_time_large(period, history)
        + category_change(period, previous, period_months, previous_months)
        + largest_payment(period)
        + habits(period)
        + income(period, history, total_income, total_spend)
    )
