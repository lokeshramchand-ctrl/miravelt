"""Turns the retrieved context (rag/retriever.py) into two things:

* `facts`  - plain sentences computed from the user's own data. They are
  the explanation whenever the model is unavailable or its answer fails the
  fact check, so Explain always has something true to say.
* a prompt - the same data as a strict block for the model to phrase.
"""
import json
from datetime import date
from typing import Any

NO_CONTEXT = "NO_CONTEXT_AVAILABLE"


def _money(value: float) -> str:
    return f"₹{value:,.0f}" if float(value).is_integer() else f"₹{value:,.2f}"


def _day(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day} {d.strftime('%b %Y')}"


class ContextBuilder:
    @staticmethod
    def build_prompt_string(context: dict[str, Any] | None) -> str:
        """A compact JSON block. JSON, not prose, so a payee name that reads
        like an instruction stays a quoted value."""
        if not context:
            return NO_CONTEXT
        return "<USER_PAYMENT_DATA>\n" + json.dumps(context, ensure_ascii=False, indent=1) + "\n</USER_PAYMENT_DATA>"

    @staticmethod
    def facts(context: dict[str, Any] | None) -> list[str]:
        if not context:
            return []
        txn, history = context["transaction"], context["history"]
        name = txn["merchant"] or txn["payee_name"] or "this payee"
        category, source = txn["category"], txn["categorized_by"]
        out: list[str] = []

        if txn["direction"] == "received":
            out.append(f"Money you receive is counted as income, not spending, so {name} is filed under Income.")
        elif source in ("user", "user_memory"):
            out.append(f"You filed {name} under {category}, and Miravelt remembers that for every payment to this payee.")
        elif source == "alias":
            out.append(f"{name} is a merchant Miravelt knows, and it is filed under {category}.")
        elif source == "community":
            out.append(f"Other people using Miravelt filed this business under {category}, so yours is too.")
        elif source == "keyword":
            out.append(f"A word in the payee's name suggests {category}. This is a best guess, not a known merchant.")
        else:
            out.append(
                f"Miravelt does not recognise {name} yet, so it is {category or 'Uncategorized'}. "
                "Pick a category once and it is remembered."
            )

        verb = "received money from" if txn["direction"] == "received" else "paid"
        count = history.get("payments", 0)
        if count <= 1:
            out.append(f"This is the only time you have {verb} {name} in the statements you added.")
        else:
            out.append(
                f"You have {verb} {name} {count} times between {_day(history['first_on'])} and "
                f"{_day(history['last_on'])}: {_money(history['total'])} in all, {_money(history['average'])} on average."
            )

        pattern = context.get("pattern")
        if pattern:
            out.append(
                f"It looks {pattern['cadence']}: usually {_money(pattern['typical_amount'])}, "
                f"with the next one expected around {_day(pattern['next_expected_on'])}."
            )

        comparison = context.get("comparison")
        if comparison and comparison["direction"] != "same" and comparison["percent_from_usual"] >= 20:
            out.append(
                f"This one is {_money(comparison['difference_from_usual'])} {comparison['direction']} than your usual "
                f"{_money(history['median'])}."
            )
        return out


context_builder = ContextBuilder()
