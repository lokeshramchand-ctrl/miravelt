"""A numeric and name fact-checker for generated insight sentences
(PROJECT_AUDIT.md A5/F11).

"Grounded, never invented" used to be a line in a prompt. This makes it a
check: a generated sentence is admitted only if

* every number in it is a number in the context, or one derived from the
  context the way a reader would (a share of a total, a change between this
  period and the last), within rounding tolerance; and
* every capitalised name in it (a merchant, a category) appears in the
  context, or is an ordinary word.

A sentence that fails is dropped; insights/statement_insights.py falls back
to the computed insights. Pure functions over plain data - tests/test_fact_check.py.
"""
import re
from collections.abc import Iterable
from typing import Any

_NUMBER_RE = re.compile(r"(?<![\w.])[-+]?₹?\s?(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d+)?\s?(%|k\b|K\b|lakh)?")
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'&.-]*")

# Capitalised words that are not names: sentence openers, months, days, and
# the product's own vocabulary.
_ORDINARY = {
    "you", "your", "you're", "this", "that", "these", "those", "the", "a", "an", "in", "on", "at",
    "over", "across", "with", "most", "more", "less", "spending", "spend", "spent", "income",
    "net", "total", "top", "biggest", "largest", "smallest", "recurring", "payment", "payments",
    "period", "month", "monthly", "weekly", "yearly", "quarterly", "fortnightly", "daily",
    "compared", "previous", "last", "next", "new", "overall", "about", "around", "nearly", "almost",
    "only", "all", "no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "transactions", "transaction", "merchant", "merchants", "category", "categories",
    "upi", "inr", "rs", "statement", "money", "came", "went", "out", "outflow", "inflow",
    "january", "february", "march", "april", "may", "june", "july", "august", "september",
    "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep",
    "sept", "oct", "nov", "dec", "monday", "tuesday", "wednesday", "thursday", "friday",
    "saturday", "sunday", "weekend", "weekends", "weekday", "weekdays", "good", "great", "well",
    "consider", "keep", "watch", "note", "it", "its", "there", "here", "while", "though", "and",
    "but", "so", "if", "of", "for", "to", "from", "by", "as", "is", "was", "were", "are", "be",
    "uncategorized", "unknown", "food", "travel", "entertainment", "bills", "friends",
    "education", "healthcare", "subscription", "subscriptions", "shopping", "utility",
    "utilities", "savings", "saved", "average", "share", "percent", "up", "down", "higher",
    "lower", "increased", "decreased", "rose", "fell", "dropped", "grew", "each", "per", "every",
}


def _flatten(value: Any, numbers: list[float], words: set[str]) -> None:
    if isinstance(value, bool) or value is None:
        return
    if isinstance(value, int | float):
        numbers.append(float(value))
    elif isinstance(value, str):
        for w in _WORD_RE.findall(value):
            words.add(w.lower().strip(".'-"))
        try:
            numbers.append(float(value))
        except ValueError:
            pass
    elif isinstance(value, dict):
        for v in value.values():
            _flatten(v, numbers, words)
    elif isinstance(value, Iterable):
        for v in value:
            _flatten(v, numbers, words)


def _totals(context: dict[str, Any]) -> list[float]:
    out = []
    for key in ("current_statement", "previous_statement"):
        block = context.get(key) or {}
        for field in ("total_spend", "total_income", "average_monthly_spend"):
            if isinstance(block.get(field), int | float) and block[field]:
                out.append(float(block[field]))
    return out


class FactChecker:
    def __init__(self, context: dict[str, Any]):
        numbers: list[float] = []
        words: set[str] = set()
        _flatten(context, numbers, words)
        self.words = words
        base = {abs(n) for n in numbers}
        derived = set(base)
        totals = _totals(context)
        # Shares of a total ("34% of spending").
        # Only a part of a whole: a ratio above 100% is not a share anyone
        # would quote, and admitting it lets an invented figure through by
        # coincidence (evaluation/ caught "240 transactions" matching
        # previous spend / current income).
        for n in base:
            for t in totals:
                if n <= t:
                    derived.add(n / t * 100)
        # Changes between the current and previous period, absolute and relative.
        current = context.get("current_statement") or {}
        previous = context.get("previous_statement") or {}
        for field, cur in current.items():
            prev = previous.get(field)
            if isinstance(cur, int | float) and isinstance(prev, int | float) and not isinstance(cur, bool):
                derived.add(abs(cur - prev))
                if prev:
                    derived.add(abs(cur - prev) / abs(prev) * 100)
        # Counts of listed things ("3 recurring payments").
        for v in current.values():
            if isinstance(v, list):
                derived.add(float(len(v)))
        self.allowed = sorted(derived)

    def _number_ok(self, value: float) -> bool:
        if value <= 10 and value == int(value):
            # Small whole numbers are counts and ordinals ("2 payments", "top 3");
            # counts that matter are checked through the lists above anyway.
            return True
        tolerance = max(1.0, value * 0.01)
        return any(abs(value - a) <= tolerance for a in self.allowed)

    def numbers_in(self, sentence: str) -> list[float]:
        found = []
        for whole, frac, unit in _NUMBER_RE.findall(sentence):
            value = float(whole.replace(",", "") + (frac or ""))
            if unit in ("k", "K"):
                value *= 1000
            elif unit == "lakh":
                value *= 100000
            found.append(value)
        return found

    def unknown_names(self, sentence: str) -> list[str]:
        unknown = []
        for word in _WORD_RE.findall(sentence):
            if not word[0].isupper():
                continue
            key = word.lower().strip(".'-")
            if key in _ORDINARY or key in self.words:
                continue
            unknown.append(word)
        return unknown

    def check(self, sentence: str) -> tuple[bool, str | None]:
        """(admitted, reason it was not)."""
        for value in self.numbers_in(sentence):
            if not self._number_ok(value):
                return False, f"number {value:g} is not in the context"
        names = self.unknown_names(sentence)
        if names:
            return False, f"name(s) not in the context: {', '.join(names)}"
        return True, None
