"""Person or business? (PROJECT_AUDIT.md B3)

A UPI statement mixes shops and people: "ZOMATO LIMITED", "S.H.S CANTEEN 1",
"ELURU PRASADA RAO". Treating a friend as a merchant produces nonsense
("your top merchant is Ravi") and, worse, would let a private name leak into
a shared alias table. This classifier decides from the printed name alone;
statements/statement_service.py upgrades a payee to "person" when money
flows both ways (you paid them and they paid you), which shops almost never do.

Deliberately conservative toward "business" for anything with a business
word, digits or a joining word ("Toni and Guy", "MAKE MY CHOICE") - a
mislabelled shop shows up in the people view, which is visible and easy to
spot; a mislabelled person promoted to a community alias would not be.
"""
import re

PERSON = "person"
BUSINESS = "business"

_NON_ALPHA = re.compile(r"[^A-Za-z\s.]")
_BUSINESS_WORDS = {
    # legal forms and trade words
    "limited", "ltd", "pvt", "private", "llp", "inc", "co", "company", "corp", "corporation",
    "enterprise", "enterprises", "traders", "trading", "industries", "agency", "agencies",
    "services", "service", "solutions", "technologies", "tech", "systems", "india", "global",
    "international", "group", "associates", "brothers", "bros", "sons", "and", "&",
    # places and shop words
    "store", "stores", "shop", "shoppe", "mart", "market", "markets", "supermarket", "bazaar",
    "centre", "center", "point", "hub", "world", "house", "palace", "plaza", "mall", "outlet",
    "hotel", "restaurant", "cafe", "canteen", "bakery", "bakers", "sweets", "kitchen", "foods",
    "food", "dhaba", "tiffins", "juice", "tea", "medical", "medicals", "pharmacy", "chemist",
    "hospital", "clinic", "diagnostics", "dental", "salon", "spa", "fitness", "gym", "academy",
    "school", "college", "institute", "university", "travels", "tours", "cabs", "petrol",
    "fuel", "filling", "station", "parking", "fashion", "fashions", "fancy", "garments",
    "textiles", "electronics", "mobiles", "communications", "telecom", "recharge", "bank",
    "finance", "insurance", "pay", "wallet", "rewards", "cashback", "bill", "bills",
    "electricity", "water", "gas", "broadband", "internet", "fiber", "fibre", "metro", "rail",
    "railway", "bus", "airlines", "airways", "the", "of", "my", "your", "new", "sri", "shree",
    "shri", "general", "kirana", "provisions", "retail", "online", "digital", "studio",
    "studios", "works", "labs",
}


def _words(name: str) -> list[str]:
    return [w for w in re.split(r"[\s.]+", name.strip().lower()) if w]


def classify_counterparty(name: str | None, *, known_business: bool = False) -> str:
    """"person" or "business" from the printed counterparty name.

    `known_business` short-circuits for names a curated or community alias,
    or a business keyword, already matched.
    """
    if known_business or not name:
        return BUSINESS
    if _NON_ALPHA.search(name):  # digits, @, &, /, ... - "CANTEEN 1", "abc@okhdfc"
        return BUSINESS
    words = _words(name)
    if not 1 <= len(words) <= 4:
        return BUSINESS
    if any(w in _BUSINESS_WORDS for w in words):
        return BUSINESS
    # Initials ("S.H.S", "K V R") read like a shop sign; a person has at least
    # one word of two or more letters ("A RAVI KUMAR").
    if not any(len(w) >= 3 for w in words):
        return BUSINESS
    # A single word is usually a brand ("Decathlon", "Blinkit"); people on
    # UPI almost always show at least a first and last name.
    if len(words) == 1:
        return BUSINESS
    return PERSON
