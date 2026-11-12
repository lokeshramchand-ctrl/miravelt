"""engines/suggest.py - category suggestions from similar names
(PROJECT_AUDIT.md B4). Pure, no database."""
from engines.suggest import similarity, suggest_category

LABELLED = [
    ("SAI TIFFIN CENTRE", "Food"), ("SRI LAKSHMI TIFFINS", "Food"), ("KARACHI BAKERY", "Food"),
    ("APOLLO PHARMACY", "Healthcare"), ("MEDPLUS PHARMACY", "Healthcare"),
    ("KVR FASHION AND FANCY", "Shopping"), ("MAX RETAIL", "Shopping"),
]


def test_identical_and_unrelated_names():
    assert similarity("Karachi Bakery", "KARACHI  BAKERY.") == 1.0
    assert similarity("KARACHI BAKERY", "BHARAT PETROL BUNK") < 0.2
    assert similarity("", "anything") == 0.0


def test_spelling_variants_are_close():
    assert similarity("KARACHI BACKERY", "KARACHI BAKERY") > 0.5


def test_suggests_the_category_of_similar_names():
    s = suggest_category("SRI SAI TIFFINS", LABELLED)
    assert s is not None and s.category == "Food"
    assert "SAI TIFFIN CENTRE" in s.similar_names or "SRI LAKSHMI TIFFINS" in s.similar_names

    s = suggest_category("WELLNESS PHARMACY", LABELLED)
    assert s is not None and s.category == "Healthcare" and len(s.similar_names) == 2


def test_no_suggestion_for_a_name_like_nothing_known():
    assert suggest_category("RAVI KUMAR", LABELLED) is None
    assert suggest_category("XQZ", LABELLED) is None
    assert suggest_category("ANYTHING", []) is None


def test_a_split_vote_is_not_a_suggestion():
    labelled = [("GREEN LEAF CAFE", "Food"), ("GREEN LEAF SALON", "Shopping")]
    assert suggest_category("GREEN LEAF", labelled) is None
