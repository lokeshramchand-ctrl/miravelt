import json
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

# Resolve the path to the JSON file dynamically
BASE_DIR = Path(__file__).resolve().parent.parent
ALIASES_FILE = BASE_DIR / "merchant_aliases.json"

# Business-type words that identify a category even when the merchant itself
# is unknown. Whole-word matches only, and deliberately generic nouns - never
# personal names - so a UPI payment to a person stays Uncategorized.
KEYWORD_CATEGORIES = [
    (re.compile(rf"\b(?:{words})\b", re.IGNORECASE), category)
    for words, category in [
        (r"canteen|cafe|restaurant|hotel|dhaba|bakery|bakers|sweets|tea\s*stall|tiffins?|biryani|juice\s*(?:centre|center|shop)|foods?|kitchen|pizza", "Food"),
        (r"fashions?|fancy|garments|textiles|clothing|footwear|mart|supermarket|kirana|general\s*stores?|retail|electronics", "Shopping"),
        (r"pharmacy|medicals?|chemists?|hospital|clinic|diagnostics|dental", "Healthcare"),
        (r"petrol|fuel|filling\s*station|travels|cabs|taxi|parking", "Travel"),
    ]
]

class RuleEngine:
    def __init__(self):
        self.rules = self._load_rules()
        self._compile_patterns()

    def _load_rules(self) -> dict:
        try:
            with open(ALIASES_FILE) as f:
                logger.info("Loaded merchant aliases.")
                return json.load(f)
        except FileNotFoundError:
            logger.warning(f"Aliases file not found at {ALIASES_FILE}. Starting with empty rules.")
            return {}

    def _compile_patterns(self):
        # Pre-compile regex patterns for performance on startup
        self.compiled_rules = {}
        for alias, data in self.rules.items():
            # \b ensures we only match whole words
            pattern = re.compile(rf"\b{re.escape(alias)}\b", re.IGNORECASE)
            self.compiled_rules[pattern] = data

    def categorize(self, text: str) -> dict:
        """
        Scans the transaction text against pre-compiled regex rules.
        """
        for pattern, data in self.compiled_rules.items():
            if pattern.search(text):
                return {
                    "merchant": data["merchant"],
                    "category": data["category"],
                    "confidence": 0.95  # High confidence for deterministic rules
                }

        # Fallback if no rule matches. Surface the statement's own printed
        # counterparty text instead of a generic placeholder - the category
        # genuinely is unknown, but the vendor name isn't, and we already
        # have it. Mirrors how the credit side ("Received from X") handles
        # this in statements/statement_service.py._build_transactions.
        fallback_merchant = text.strip() or "Unknown"

        # No known merchant, but the printed name itself often says what the
        # business is ("S.H.S CANTEEN 1", "KVR FASHION AND FANCY"). Only a
        # category guess, so the merchant stays the raw text and confidence
        # stays well below a curated alias match.
        for pattern, category in KEYWORD_CATEGORIES:
            if pattern.search(text):
                return {"merchant": fallback_merchant, "category": category, "confidence": 0.6}

        return {
            "merchant": fallback_merchant,
            "category": "Uncategorized",
            "confidence": 0.0
        }

# Instantiate a singleton to be used by the router
rule_engine = RuleEngine()
