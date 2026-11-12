"""Synthetic Google Pay statements, in the exact text layout
statements/pdf_parser.py reads.

Used by the test suite (overlaps, re-uploads, corrections across
statements - none of which one real sample PDF can exercise), by the
evaluation harness (evaluation/), and as the shape the mobile demo mode
mirrors (frontend/src/demo/). Deterministic for a given seed.

    text = SyntheticStatement(date(2026, 1, 1), date(2026, 3, 31), seed=7).text()
"""
import random
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

# (printed name, typical amount, spread) - businesses the alias list or the
# keyword rules know, and some they do not.
SHOPS = [
    ("ZOMATO LIMITED", 380, 0.5), ("Swiggy", 420, 0.5), ("Blinkit", 260, 0.6), ("Decathlon", 1400, 0.6),
    ("S.H.S CANTEEN 1", 60, 0.3), ("KARACHI BAKERY", 340, 0.4), ("Apollo Pharmacy", 520, 0.6),
    ("Metro Rail Hyderabad", 60, 0.3), ("UBER INDIA SYSTEMS", 260, 0.5), ("VIJETHA SUPER MARKETS", 900, 0.5),
    ("SRI SAI TIFFINS", 90, 0.3), ("MAX RETAIL", 1600, 0.5), ("KVR FASHION AND FANCY", 700, 0.5),
    ("BHARAT PETROL BUNK", 500, 0.2), ("Toni and Guy", 650, 0.3), ("MAKE MY CHOICE", 120, 0.5),
]
# Subscriptions: (printed name, amount, day of month)
SUBSCRIPTIONS = [("Netflix", 649, 5), ("Spotify", 119, 12), ("YouTube Premium", 149, 20)]
PEOPLE = ["RAVI KUMAR", "PRIYA SHARMA", "ELURU PRASADA RAO", "DOSAPATI NAGA MUKESH", "ANJALI REDDY"]
SALARY_SOURCE = "ACME TECHNOLOGIES PVT LTD"


@dataclass
class Record:
    timestamp: datetime  # local (IST) wall-clock time, naive
    direction: str  # "Paid to" | "Received from"
    counterparty: str
    amount: float
    reference: str


def _fmt_amount(amount: float) -> str:
    whole = f"{amount:,.2f}"
    return whole[:-3] if whole.endswith(".00") else whole


@dataclass
class SyntheticStatement:
    start: date
    end: date
    seed: int = 1
    salary: float = 65000.0
    shop_visits_per_week: float = 9.0
    reference_offset: int = 0
    records: list[Record] = field(default_factory=list)

    def __post_init__(self):
        if not self.records:
            self.records = self._generate()

    def _ref(self, when: datetime) -> str:
        # Derived from the payment's own moment, so overlapping statements
        # built from the same seed print the same reference for the same payment.
        minutes = int((when - datetime(2020, 1, 1)).total_seconds() // 60)
        return str(110000000000 + minutes * 7 + self.reference_offset)

    def _generate(self) -> list[Record]:
        # One RNG per day keeps a day's payments identical across any two
        # statements whose ranges include it - what a real re-download does.
        records: list[Record] = []
        day = self.start
        while day <= self.end:
            rng = random.Random(f"{self.seed}:{day.isoformat()}")  # noqa: S311 - test data, not secrets
            visits = rng.random() * self.shop_visits_per_week / 3.5
            for _ in range(int(visits) + (1 if rng.random() < visits % 1 else 0)):
                name, typical, spread = rng.choice(SHOPS)
                amount = max(10.0, round(typical * (1 + rng.uniform(-spread, spread))))
                when = datetime.combine(day, datetime.min.time()) + timedelta(
                    hours=rng.randint(8, 23), minutes=rng.randint(0, 59)
                )
                records.append(Record(when, "Paid to", name, float(amount), ""))
            for name, amount, dom in SUBSCRIPTIONS:
                if day.day == dom:
                    when = datetime.combine(day, datetime.min.time()) + timedelta(hours=6, minutes=dom)
                    records.append(Record(when, "Paid to", name, float(amount), ""))
            if day.day == 1:
                when = datetime.combine(day, datetime.min.time()) + timedelta(hours=10)
                records.append(Record(when, "Received from", SALARY_SOURCE, self.salary, ""))
                when = datetime.combine(day, datetime.min.time()) + timedelta(hours=11)
                records.append(Record(when, "Paid to", "RAVI KUMAR", 12000.0, ""))  # rent
            if rng.random() < 0.08:
                person = rng.choice(PEOPLE)
                when = datetime.combine(day, datetime.min.time()) + timedelta(hours=rng.randint(9, 21))
                direction = rng.choice(["Paid to", "Received from"])
                records.append(Record(when, direction, person, float(rng.choice([50, 100, 200, 500, 1000])), ""))
            day += timedelta(days=1)

        records.sort(key=lambda r: r.timestamp)
        seen: set[str] = set()
        for r in records:
            ref = self._ref(r.timestamp)
            while ref in seen:
                ref = str(int(ref) + 1)
            seen.add(ref)
            r.reference = ref
        return records

    @property
    def sent(self) -> float:
        return round(sum(r.amount for r in self.records if r.direction == "Paid to"), 2)

    @property
    def received(self) -> float:
        return round(sum(r.amount for r in self.records if r.direction == "Received from"), 2)

    def text(self, *, drop_layout_of: int = 0) -> str:
        """The statement as pdfplumber would extract it. `drop_layout_of`
        prints that many records in a broken shape, to exercise the
        parser's accounting of unreadable records."""
        lines = [
            "Transaction statement",
            "9000000000, demo@example.com",
            "Transaction statement period Sent Received",
            f"{self.start:%d %B %Y} - {self.end:%d %B %Y} ₹{_fmt_amount(self.sent)} ₹{_fmt_amount(self.received)}",
            "Date & time Transaction details Amount",
        ]
        for i, r in enumerate(self.records):
            bank_line = "Paid by HDFC Bank 5488" if r.direction == "Paid to" else "Paid to HDFC Bank 5488"
            if i < drop_layout_of:
                lines += [
                    f"{r.timestamp:%d %b, %Y} {r.direction} {r.counterparty}",
                    f"₹{_fmt_amount(r.amount)} {r.timestamp:%I:%M %p} UPI Transaction ID: {r.reference}",
                    bank_line,
                ]
                continue
            lines += [
                f"{r.timestamp:%d %b, %Y} {r.direction} {r.counterparty} ₹{_fmt_amount(r.amount)}",
                f"{r.timestamp:%I:%M %p} UPI Transaction ID: {r.reference}",
                bank_line,
            ]
        lines.append(
            "Note: This statement reflects payments made by you on the Google Pay app. Self transfer payments "
            "are not included in the total money paid and received."
        )
        return "\n".join(lines)
