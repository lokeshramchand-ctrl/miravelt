"""Evaluation harness (PROJECT_AUDIT.md E2). See evaluation/README.md.

No database, no model, no network: it runs the same pure functions the
statement pipeline runs (engines/categorizer.py, engines/counterparty.py,
insights/fact_check.py) over evaluation/payees.csv.
"""
import argparse
import csv
import json
import sys
from pathlib import Path

from engines.categorizer import UNCATEGORIZED, categorize
from insights.fact_check import FactChecker

HERE = Path(__file__).resolve().parent
BASELINE = HERE / "baseline.json"

_CONTEXT = {
    "current_statement": {
        "total_spend": 80634.04, "total_income": 28975.0, "transaction_count": 184,
        "top_merchants": [{"merchant": "Zomato", "total_amount": 12400.0, "transaction_count": 31}],
        "category_breakdown": [{"category": "Food", "total_amount": 27415.57, "percentage": 34.0}],
        "recurring_payments": [{"merchant": "Netflix", "typical_amount": 649.0, "cadence": "monthly"}],
    },
    "previous_statement": {"total_spend": 70000.0, "total_income": 30000.0, "transaction_count": 150},
}
# (sentence, is it supported by _CONTEXT?)
_SENTENCES = [
    ("You spent ₹80,634 across 184 transactions.", True),
    ("Zomato was your biggest merchant at ₹12,400.", True),
    ("Food was 34% of your spending.", True),
    ("Netflix costs ₹649 monthly.", True),
    ("Spending rose by ₹10,634 compared with the previous period.", True),
    ("Income fell from ₹30,000 to ₹28,975.", True),
    ("You spent ₹91,000 this period.", False),
    ("Most of it went to Starbucks.", False),
    ("Netflix costs ₹799 monthly.", False),
    ("Food was 52% of your spending.", False),
    ("You made 240 transactions.", False),
    ("Swiggy was your biggest merchant at ₹12,400.", False),
]


def load() -> list[dict]:
    with open(HERE / "payees.csv", newline="", encoding="utf-8") as f:
        return [row for row in csv.DictReader(f) if row["payee"]]


def evaluate() -> dict:
    rows = load()
    businesses = [r for r in rows if r["kind"] == "business" and r["category"]]
    people = [r for r in rows if r["kind"] == "person"]

    labelled = correct = 0
    misses: list[dict] = []
    for r in businesses:
        result = categorize(r["payee"])
        if result.category != UNCATEGORIZED:
            labelled += 1
            if result.category == r["category"]:
                correct += 1
            else:
                misses.append({"payee": r["payee"], "expected": r["category"], "got": result.category})
        else:
            misses.append({"payee": r["payee"], "expected": r["category"], "got": UNCATEGORIZED})

    kind_correct = sum(1 for r in rows if categorize(r["payee"]).counterparty_kind == r["kind"])
    # The rules must never file a person under a merchant category.
    people_private = sum(1 for r in people if categorize(r["payee"]).category == UNCATEGORIZED)

    checker = FactChecker(_CONTEXT)
    faithful = sum(1 for sentence, supported in _SENTENCES if checker.check(sentence)[0] == supported)

    return {
        "payees": len(rows),
        "coverage": round(labelled / len(businesses), 4),
        "accuracy_when_labelled": round(correct / labelled, 4) if labelled else 0.0,
        "end_to_end_accuracy": round(correct / len(businesses), 4),
        "kind_accuracy": round(kind_correct / len(rows), 4),
        "people_kept_private": round(people_private / len(people), 4),
        "insight_faithfulness": round(faithful / len(_SENTENCES), 4),
        "_misses": misses,
    }


METRICS = (
    "coverage", "accuracy_when_labelled", "end_to_end_accuracy", "kind_accuracy",
    "people_kept_private", "insight_faithfulness",
)


def regressions(result: dict, baseline: dict) -> list[str]:
    return [
        f"{name}: {result[name]:.4f} is below the baseline {baseline[name]:.4f}"
        for name in METRICS
        if name in baseline and result[name] + 1e-9 < baseline[name]
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="accept the current numbers as the baseline")
    parser.add_argument("--misses", action="store_true", help="list every payee that was wrong or unlabelled")
    args = parser.parse_args()

    result = evaluate()
    misses = result.pop("_misses")
    print(f"Payees evaluated: {result['payees']}")
    for name in METRICS:
        print(f"  {name:<24} {result[name] * 100:6.1f}%")
    if args.misses:
        for m in misses:
            print(f"  miss: {m['payee']!r} expected {m['expected']}, got {m['got']}")

    if args.write:
        BASELINE.write_text(json.dumps({k: result[k] for k in METRICS}, indent=2) + "\n")
        print(f"Baseline written to {BASELINE.name}.")
        return 0
    if not BASELINE.exists():
        print("No baseline yet - run with --write to create one.")
        return 0
    failed = regressions(result, json.loads(BASELINE.read_text()))
    for line in failed:
        print(f"REGRESSION {line}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
