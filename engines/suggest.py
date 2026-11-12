"""A category suggestion for a payee nobody has labelled yet
(PROJECT_AUDIT.md B4): "looks like Food - 3 similar names".

Nearest labelled neighbours by the *name itself*: shared words count most
("SRI SAI TIFFINS" next to "SAI TIFFIN CENTRE"), shared character trigrams
catch spelling variants ("KARACHI BACKERY"). The neighbours are payees this
user already has a category for, plus the curated alias list - never
another user's payees.

A suggestion is only ever shown as a suggestion. It does not categorise
anything until the user accepts it, so being wrong costs a tap, not a
wrong total. Pure functions, no database, no model call.
"""
from collections import defaultdict
from dataclasses import dataclass

from engines.categorizer import payee_key

MIN_SIMILARITY = 0.3
NEIGHBOURS = 5
# Words that say nothing about what a business sells.
_STOP = {
    "the", "and", "of", "sri", "shree", "shri", "new", "pvt", "ltd", "limited", "private", "india",
    "enterprises", "enterprise", "traders", "trading", "co", "company", "store", "stores", "shop",
}


@dataclass(frozen=True)
class Suggestion:
    category: str
    similar_names: list[str]
    score: float


def _tokens(key: str) -> set[str]:
    return {w for w in key.split() if len(w) > 2 and w not in _STOP and not w.isdigit()}


def _trigrams(key: str) -> set[str]:
    padded = f"  {key} "
    return {padded[i:i + 3] for i in range(len(padded) - 2)}


def similarity(a: str, b: str) -> float:
    """0..1 between two payee names."""
    ka, kb = payee_key(a), payee_key(b)
    if not ka or not kb:
        return 0.0
    if ka == kb:
        return 1.0
    ta, tb = _tokens(ka), _tokens(kb)
    token = len(ta & tb) / len(ta | tb) if ta and tb else 0.0
    ga, gb = _trigrams(ka), _trigrams(kb)
    gram = len(ga & gb) / len(ga | gb)
    return round(max(token, gram, 0.6 * token + 0.4 * gram), 4)


def suggest_category(name: str, labelled: list[tuple[str, str]]) -> Suggestion | None:
    """`labelled` is (payee name, category). Returns the category most of the
    nearest names share, or None when nothing is close enough."""
    scored = sorted(
        ((similarity(name, other), other, category) for other, category in labelled),
        key=lambda t: -t[0],
    )
    near = [t for t in scored if t[0] >= MIN_SIMILARITY][:NEIGHBOURS]
    if not near:
        return None
    weight: dict[str, float] = defaultdict(float)
    for score, _, category in near:
        weight[category] += score
    category = max(weight, key=lambda c: weight[c])
    names = [other for _, other, c in near if c == category][:3]
    best = max(score for score, _, c in near if c == category)
    # A split vote is not a suggestion.
    if weight[category] < 0.6 * sum(weight.values()):
        return None
    return Suggestion(category=category, similar_names=names, score=round(best, 2))
