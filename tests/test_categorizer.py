"""engines/categorizer.py and engines/counterparty.py - per-user memory first
(PROJECT_AUDIT.md B1/F2) and person vs business (B3). Pure, no database."""
import pytest

from engines.categorizer import CategorizationContext, MemoryEntry, categorize, payee_key
from engines.counterparty import BUSINESS, PERSON, classify_counterparty


def test_payee_key_ignores_case_spacing_and_punctuation():
    assert payee_key("Zomato Ltd.") == payee_key("  ZOMATO   LTD ") == "zomato ltd"
    assert payee_key(None) == ""


def test_curated_alias_wins_over_keyword():
    result = categorize("ZOMATO LIMITED")
    assert (result.merchant, result.category, result.source, result.confidence) == ("Zomato", "Food", "alias", 0.95)
    assert result.counterparty_kind == BUSINESS


def test_keyword_is_a_lower_confidence_guess_that_keeps_the_printed_name():
    result = categorize("S.H.S CANTEEN 1")
    assert (result.merchant, result.category, result.source, result.confidence) == (
        "S.H.S CANTEEN 1", "Food", "keyword", 0.6,
    )


def test_unknown_payee_is_uncategorized_with_zero_confidence():
    result = categorize("MAKE MY CHOICE")
    assert (result.category, result.source, result.confidence) == ("Uncategorized", "none", 0.0)


def test_the_users_own_correction_beats_everything():
    ctx = CategorizationContext(
        user_memory={payee_key("ZOMATO LIMITED"): MemoryEntry("Entertainment", "Zomato")},
        community={payee_key("ZOMATO LIMITED"): MemoryEntry("Shopping", "Zomato")},
    )
    result = categorize("Zomato Limited", ctx)
    assert (result.category, result.source, result.confidence) == ("Entertainment", "user_memory", 1.0)


def test_community_alias_sits_between_curated_alias_and_keyword():
    ctx = CategorizationContext(community={payee_key("SRI SAI TIFFINS"): MemoryEntry("Shopping", "Sri Sai Tiffins")})
    result = categorize("SRI SAI TIFFINS", ctx)  # the keyword rule alone would say Food
    assert (result.category, result.source, result.confidence) == ("Shopping", "community", 0.85)
    # ...but never over a curated alias.
    ctx = CategorizationContext(community={payee_key("Netflix"): MemoryEntry("Shopping", "Netflix")})
    assert categorize("Netflix", ctx).source == "alias"


def test_memory_is_per_payee_not_per_substring():
    ctx = CategorizationContext(user_memory={payee_key("RAVI KUMAR"): MemoryEntry("Friends")})
    assert categorize("RAVI KUMAR", ctx).category == "Friends"
    assert categorize("RAVI KUMAR STORES", ctx).source != "user_memory"


@pytest.mark.parametrize("name", [
    "RAVI KUMAR", "PRIYA SHARMA", "ELURU PRASADA RAO", "DOSAPATI NAGA MUKESH", "A RAVI KUMAR",
])
def test_people(name):
    assert classify_counterparty(name) == PERSON


@pytest.mark.parametrize("name", [
    "ZOMATO LIMITED", "S.H.S CANTEEN 1", "KVR FASHION AND FANCY", "Toni and Guy", "MAKE MY CHOICE",
    "Decathlon", "abc@okhdfc", "K V R", "ACME TECHNOLOGIES PVT LTD", "", None,
])
def test_businesses(name):
    assert classify_counterparty(name) == BUSINESS


def test_known_business_short_circuits():
    assert classify_counterparty("RAVI KUMAR", known_business=True) == BUSINESS
