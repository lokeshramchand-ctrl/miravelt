"""Statement categorization with per-user memory (PROJECT_AUDIT.md B1/F2).

Order of precedence for one payee, first hit wins:

1. this user's own correction for the same payee      source="user_memory"  conf 1.0
2. curated alias (merchant_aliases.json)                source="alias"        conf 0.95
3. community alias (promoted from many users' fixes)    source="community"    conf 0.85
4. business keyword in the printed name                 source="keyword"      conf 0.6
5. nothing                                              source="none"         conf 0.0  -> Uncategorized

The DB-backed layers (1 and 3) are loaded once per statement into a
CategorizationContext; `categorize` itself is pure, so it runs on a worker
thread and is unit-tested without a database (tests/test_categorizer.py).
"""
import re
from dataclasses import dataclass, field

from engines.counterparty import BUSINESS, classify_counterparty
from engines.rule_engine import KEYWORD_CATEGORIES, rule_engine

UNCATEGORIZED = "Uncategorized"

_KEY_RE = re.compile(r"[^a-z0-9]+")


def payee_key(name: str | None) -> str:
    """Normalised identity of a printed counterparty name: case, spacing and
    punctuation do not matter ("Zomato Ltd." == "ZOMATO LTD")."""
    return _KEY_RE.sub(" ", (name or "").lower()).strip()


@dataclass(frozen=True)
class MemoryEntry:
    category: str
    merchant: str | None = None


@dataclass
class CategorizationContext:
    # payee_key -> this user's remembered category
    user_memory: dict[str, MemoryEntry] = field(default_factory=dict)
    # payee_key -> promoted community alias
    community: dict[str, MemoryEntry] = field(default_factory=dict)


@dataclass(frozen=True)
class CategorizationResult:
    merchant: str
    category: str
    confidence: float
    source: str
    counterparty_kind: str


def categorize(counterparty_raw: str, ctx: CategorizationContext | None = None) -> CategorizationResult:
    ctx = ctx or CategorizationContext()
    raw = " ".join((counterparty_raw or "").split())
    key = payee_key(raw)

    remembered = ctx.user_memory.get(key)
    alias = rule_engine.match_alias(raw)
    keyword_category = next((c for p, c in KEYWORD_CATEGORIES if p.search(raw)), None)
    kind = classify_counterparty(raw, known_business=bool(alias or keyword_category or key in ctx.community))

    if remembered is not None:
        merchant = remembered.merchant or (alias["merchant"] if alias else raw) or "Unknown"
        return CategorizationResult(merchant, remembered.category, 1.0, "user_memory", kind)
    if alias is not None:
        return CategorizationResult(alias["merchant"], alias["category"], 0.95, "alias", BUSINESS)
    community = ctx.community.get(key)
    if community is not None:
        return CategorizationResult(community.merchant or raw, community.category, 0.85, "community", BUSINESS)
    if keyword_category is not None:
        return CategorizationResult(raw or "Unknown", keyword_category, 0.6, "keyword", BUSINESS)
    return CategorizationResult(raw or "Unknown", UNCATEGORIZED, 0.0, "none", kind)
