"""insights/fact_check.py - "grounded, never invented" as a check, not a
prompt (PROJECT_AUDIT.md A5/F11)."""
from insights.fact_check import FactChecker

CONTEXT = {
    "current_statement": {
        "total_spend": 80634.04,
        "total_income": 28975.0,
        "transaction_count": 184,
        "top_merchants": [
            {"merchant": "Zomato", "total_amount": 12400.0, "transaction_count": 31},
            {"merchant": "Decathlon", "total_amount": 5200.0, "transaction_count": 2},
        ],
        "category_breakdown": [{"category": "Food", "total_amount": 27415.57, "percentage": 34.0}],
        "recurring_payments": [{"merchant": "Netflix", "typical_amount": 649.0, "cadence": "monthly"}],
    },
    "previous_statement": {"total_spend": 70000.0, "total_income": 30000.0, "transaction_count": 150},
}


def _ok(sentence: str) -> bool:
    return FactChecker(CONTEXT).check(sentence)[0]


def test_numbers_from_the_context_pass():
    assert _ok("You spent ₹80,634 across 184 transactions.")
    assert _ok("Zomato was your biggest merchant at ₹12,400.")
    assert _ok("Netflix costs ₹649 monthly.")


def test_an_invented_number_fails():
    ok, reason = FactChecker(CONTEXT).check("You spent ₹91,000 this period.")
    assert not ok and "91000" in reason


def test_an_invented_merchant_fails():
    ok, reason = FactChecker(CONTEXT).check("Most of it went to Starbucks.")
    assert not ok and "Starbucks" in reason


def test_shares_and_changes_a_reader_would_derive_pass():
    assert _ok("Food was 34% of your spending.")  # 27415.57 / 80634.04
    assert _ok("Spending rose by ₹10,634 compared with the previous period.")  # 80634.04 - 70000
    assert _ok("That is about 15% higher.")  # 10634 / 70000
    assert _ok("Zomato alone was 15% of your spending.")  # 12400 / 80634


def test_rounding_tolerance_is_about_one_percent():
    assert _ok("You spent about ₹80,600.")
    assert not _ok("You spent about ₹78,000.")


def test_small_counts_and_ordinary_capitalised_words_pass():
    assert _ok("Your top 3 merchants took most of it.")
    assert _ok("Spending was higher in March.")


def test_k_and_lakh_units_are_understood():
    checker = FactChecker(CONTEXT)
    assert checker.numbers_in("around ₹80.6k in all") == [80600.0]
    assert checker.numbers_in("1 lakh") == [100000.0]


def test_a_name_made_of_context_words_passes_and_case_does_not_matter():
    assert _ok("DECATHLON had only 2 payments.")
