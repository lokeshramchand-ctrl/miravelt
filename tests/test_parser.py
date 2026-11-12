"""statements/pdf_parser.py - the parser and its accounting (PROJECT_AUDIT.md
A6/F9), against generated statements and the one real sample."""
import os
from datetime import UTC, date, datetime, timedelta

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from core.timezone import APP_TZ
from statements.pdf_parser import UnsupportedStatementError, statement_parser
from statements.synthetic import Record, SyntheticStatement

SAMPLE_PDF = os.path.join(os.path.dirname(__file__), "..", "mock", "gpay_statement_20260101_20260630.pdf")


def test_round_trip_of_a_generated_statement():
    stmt = SyntheticStatement(date(2026, 1, 1), date(2026, 3, 31), seed=7)
    text = stmt.text()
    parsed = statement_parser.parse_transactions(text)
    assert len(parsed) == len(stmt.records) == statement_parser.count_record_lines(text)
    assert statement_parser.parse_period(text) == (date(2026, 1, 1), date(2026, 3, 31))
    assert statement_parser.parse_declared_totals(text) == (stmt.sent, stmt.received)
    for record, got in zip(stmt.records, parsed, strict=True):
        assert got.direction == record.direction
        assert got.counterparty_raw == record.counterparty
        assert got.amount == record.amount
        assert got.reference_number == record.reference
        assert got.timestamp == record.timestamp.replace(tzinfo=APP_TZ).astimezone(UTC)
        assert (got.bank, got.account_last4) == ("HDFC Bank", "5488")


def test_sums_reconcile_with_the_printed_totals():
    stmt = SyntheticStatement(date(2026, 2, 1), date(2026, 2, 28), seed=3)
    parsed = statement_parser.parse_transactions(stmt.text())
    sent = round(sum(p.amount for p in parsed if p.direction == "Paid to"), 2)
    received = round(sum(p.amount for p in parsed if p.direction == "Received from"), 2)
    assert (sent, received) == statement_parser.parse_declared_totals(stmt.text())


def test_records_in_an_unknown_shape_are_counted_not_lost_silently():
    stmt = SyntheticStatement(date(2026, 1, 1), date(2026, 1, 31), seed=5)
    text = stmt.text(drop_layout_of=4)
    assert statement_parser.count_record_lines(text) == len(stmt.records)
    assert len(statement_parser.parse_transactions(text)) == len(stmt.records) - 4


def test_totals_are_read_from_the_period_line_only():
    """F9: the first two rupee amounts in the document are not the totals
    unless they follow the period."""
    stmt = SyntheticStatement(date(2026, 1, 1), date(2026, 1, 31), seed=9)
    lines = stmt.text().split("\n")
    header = lines.pop(3)  # "01 January 2026 - 31 January 2026 ₹sent ₹received"
    without_totals = "\n".join(lines[:3] + [header.split(" ₹")[0]] + lines[3:])
    assert statement_parser.parse_declared_totals(without_totals) == (None, None)


def test_a_late_night_payment_keeps_its_local_day():
    """F7: 01:30 IST on the 15th is still the 14th in UTC; the stored instant
    must convert back to the 15th."""
    stmt = SyntheticStatement(
        date(2026, 3, 1), date(2026, 3, 31),
        records=[Record(datetime(2026, 3, 15, 1, 30), "Paid to", "Swiggy", 250.0, "110000000001")],
    )
    (got,) = statement_parser.parse_transactions(stmt.text())
    assert got.timestamp == datetime(2026, 3, 14, 20, 0, tzinfo=UTC)
    assert got.timestamp.astimezone(APP_TZ).date() == date(2026, 3, 15)


def test_a_document_without_a_period_is_unsupported():
    with pytest.raises(UnsupportedStatementError):
        statement_parser.parse_period("Transaction statement\nnothing else here")


def test_signature_needs_all_three_markers():
    statement_parser.validate_signature(SyntheticStatement(date(2026, 1, 1), date(2026, 1, 7), seed=1).text())
    with pytest.raises(UnsupportedStatementError):
        statement_parser.validate_signature("Transaction statement\nUPI Transaction ID: 1")


_NAME = st.text(alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz.&'-0123456789", min_size=1, max_size=40) \
    .map(lambda s: " ".join(s.split())).filter(lambda s: s and "₹" not in s)


@settings(max_examples=80, deadline=None)
@given(
    rows=st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=89),          # day offset
            st.integers(min_value=0, max_value=24 * 60 - 1),  # minute of day
            st.sampled_from(["Paid to", "Received from"]),
            _NAME,
            st.integers(min_value=1, max_value=99_999_999).map(lambda paise: paise / 100),
        ),
        min_size=1, max_size=25,
    )
)
def test_any_well_formed_statement_round_trips(rows):
    records = [
        Record(datetime(2026, 1, 1) + timedelta(days=d, minutes=m), direction, name, amount, str(110000000000 + i))
        for i, (d, m, direction, name, amount) in enumerate(rows)
    ]
    stmt = SyntheticStatement(date(2026, 1, 1), date(2026, 3, 31), records=records)
    text = stmt.text()
    parsed = statement_parser.parse_transactions(text)
    assert len(parsed) == len(records) == statement_parser.count_record_lines(text)
    assert [p.reference_number for p in parsed] == [r.reference for r in records]
    assert [p.counterparty_raw for p in parsed] == [r.counterparty for r in records]
    assert [p.amount for p in parsed] == [r.amount for r in records]
    assert statement_parser.parse_declared_totals(text) == (stmt.sent, stmt.received)


@pytest.mark.skipif(not os.path.exists(SAMPLE_PDF), reason="sample statement not present")
def test_the_real_sample_statement_parses_completely_and_reconciles():
    with open(SAMPLE_PDF, "rb") as f:
        raw = f.read()
    text = statement_parser.extract_text(raw)
    statement_parser.validate_signature(text)
    parsed = statement_parser.parse_transactions(text)
    assert len(parsed) == 184 == statement_parser.count_record_lines(text)
    sent = round(sum(p.amount for p in parsed if p.direction == "Paid to"), 2)
    received = round(sum(p.amount for p in parsed if p.direction == "Received from"), 2)
    assert (sent, received) == statement_parser.parse_declared_totals(text) == (80634.04, 28975.0)
