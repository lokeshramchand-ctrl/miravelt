import json
import logging
from typing import Any

import httpx

from core.llm_safety import llm_safety_validator
from core.ollama_client import LLM_MODEL, get_ollama_host
from insights.fact_check import FactChecker
from models.schemas import InsightItem, InsightSeverity, StatementAnalytics

logger = logging.getLogger(__name__)

# Below this fractional change in a recurring payment's estimated monthly
# cost, it's noise (rounding, a slightly different billing date) rather than
# a real price change worth surfacing.
_RECURRING_CHANGE_THRESHOLD = 0.10


class StatementInsightGenerator:
    """Reuses the Ollama-calling convention already established in
    rag/generator.py (httpx + core.ollama_client.get_ollama_host() +
    format: "json" + a strict, grounding-only system prompt), but for a
    different task: summarizing a whole statement's already-computed
    analytics into natural-language observations. That's distinct from what
    rag/generator.py::ExplanationGenerator does (explaining one
    categorization decision from merchant behavior context) and isn't a fit
    to force onto that class.

    Grounded strictly in the analytics JSON already computed by
    analytics/statement_analytics.py - never given raw transaction rows or
    asked to invent a figure, so it can't report a number that doesn't
    reconcile with what's actually persisted.
    """

    system_prompt = """
You are the Miravelt Financial Insights Engine.
Your ONLY purpose is to turn a user's already-computed statement analytics into brief, natural-language financial observations.

RULES:
1. Use ONLY the numbers provided in the CONTEXT. Never invent a figure, merchant, or category that isn't present there.
2. Do not act like a chatbot. No greetings, no filler.
3. If the context has nothing insight-worthy for a category (e.g. no recurring payments detected), simply omit that kind of insight - do not fabricate one.
4. ALWAYS output a JSON array, where each element matches exactly:
{"type": "<short_snake_case_type>", "message": "<one concise sentence>", "severity": "INFO|POSITIVE|WARNING"}
5. Output ONLY the JSON array - no surrounding prose, no markdown fences.
"""

    @staticmethod
    def build_context(
        analytics: StatementAnalytics, previous_analytics: StatementAnalytics | None = None
    ) -> dict[str, Any]:
        """What the model sees, and what its output is checked against.
        Payee names are third-party text printed on the statement - sanitised
        exactly as /v1/explain sanitises its input (F11)."""
        # daily_trend is one row per day - by far the bulk of the payload, and
        # nothing an insight sentence needs, so it only slows a CPU-bound model.
        exclude = {"generated_at", "daily_trend"}

        def clean(a: StatementAnalytics) -> dict[str, Any]:
            data = a.model_dump(exclude=exclude, mode="json")
            for key in ("top_merchants", "recurring_payments"):
                for row in data.get(key, []):
                    row["merchant"] = llm_safety_validator.sanitize_prompt_input(row["merchant"], max_length=80)
            return data

        context: dict[str, Any] = {"current_statement": clean(analytics)}
        if previous_analytics is not None:
            context["previous_statement"] = clean(previous_analytics)
        return context

    async def generate(
        self,
        analytics: StatementAnalytics,
        previous_analytics: StatementAnalytics | None = None,
        signals: list[InsightItem] | None = None,
    ) -> list[InsightItem]:
        context = self.build_context(analytics, previous_analytics)
        prompt = f"CONTEXT:\n{json.dumps(context, default=str)}\n\nGenerate the insights JSON array now."

        payload = {
            "model": LLM_MODEL,
            "system": self.system_prompt,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }

        llm_items: list[InsightItem] = []
        try:
            async with httpx.AsyncClient() as client:
                api_url = f"{get_ollama_host()}/api/generate"
                # This runs in a background job, not on a request path, and a
                # CPU-only Ollama routinely needs well over 30s for a
                # statement-sized prompt.
                response = await client.post(api_url, json=payload, timeout=180.0)
                response.raise_for_status()
                data = response.json()
                raw_items = json.loads(data["response"])
        except Exception:
            # Insights are additive value on top of already-persisted
            # analytics - an Ollama/network hiccup here is never a reason to
            # fail the whole statement-processing job.
            logger.warning("Statement insight generation failed - using computed insights instead.", exc_info=True)
        else:
            llm_items = self.verified(self._to_insight_items(raw_items), context)

        return self.assemble(analytics, previous_analytics, llm_items, signals or [])

    def assemble(
        self,
        analytics: StatementAnalytics,
        previous_analytics: StatementAnalytics | None,
        llm_items: list[InsightItem],
        signals: list[InsightItem],
    ) -> list[InsightItem]:
        """Generated sentences that passed the fact-check, or the computed
        observations when none did; then the always-computed diffs and signals."""
        base = llm_items or self._computed_insights(analytics)
        return base + self._recurring_change_insights(previous_analytics, analytics) + signals

    def refresh(
        self,
        existing: list[InsightItem],
        analytics: StatementAnalytics,
        previous_analytics: StatementAnalytics | None,
        signals: list[InsightItem],
    ) -> list[InsightItem]:
        """Recompute after a correction (A4) without calling the model again:
        generated sentences are re-checked against the new numbers and kept
        only if they still hold; everything computed is recomputed."""
        context = self.build_context(analytics, previous_analytics)
        kept = self.verified([i for i in existing if i.origin == "llm"], context)
        return self.assemble(analytics, previous_analytics, kept, signals)

    @staticmethod
    def verified(items: list[InsightItem], context: dict[str, Any]) -> list[InsightItem]:
        checker = FactChecker(context)
        admitted = []
        for item in items:
            ok, reason = checker.check(item.message)
            if ok:
                admitted.append(item.model_copy(update={"origin": "llm"}))
            else:
                logger.info("Dropped a generated insight that failed the fact-check: %s", reason)
        return admitted

    @staticmethod
    def _recurring_change_insights(
        previous: StatementAnalytics | None, current: StatementAnalytics
    ) -> list[InsightItem]:
        """Diffs this statement's recurring payments against the previous
        completed statement's (see statements/statement_service.py for how
        `previous` is fetched). A merchant that newly crosses the recurring
        threshold, or whose estimated monthly cost moves by more than
        _RECURRING_CHANGE_THRESHOLD, becomes a signal - every figure here is
        read straight off StatementAnalytics.recurring_payments, never
        invented."""
        if previous is None:
            return []

        def amount(item) -> float:
            # The per-payment amount when known; older stored analytics only
            # have the monthly estimate.
            return item.typical_amount or item.estimated_monthly_cost

        previous_by_merchant = {r.merchant: r for r in previous.recurring_payments}
        items: list[InsightItem] = []
        for current_item in current.recurring_payments:
            prior = previous_by_merchant.get(current_item.merchant)
            if prior is None:
                cadence = f" {current_item.cadence}" if current_item.typical_amount else ""
                items.append(InsightItem(
                    type="new_recurring",
                    message=(
                        f"{current_item.merchant} looks like a new{cadence} recurring payment: "
                        f"₹{amount(current_item):,.0f}."
                    ),
                    severity=InsightSeverity.INFO,
                ))
                continue

            before, now = amount(prior), amount(current_item)
            if before <= 0:
                continue
            change = (now - before) / before
            if abs(change) < _RECURRING_CHANGE_THRESHOLD:
                continue

            direction = "increased" if change > 0 else "decreased"
            items.append(InsightItem(
                type="recurring_change",
                message=(
                    f"Your {current_item.merchant} payment {direction} from "
                    f"₹{before:,.0f} to ₹{now:,.0f} ({change * 100:+.0f}%)."
                ),
                severity=InsightSeverity.WARNING if change > 0 else InsightSeverity.POSITIVE,
            ))
        return items

    @staticmethod
    def _computed_insights(analytics: StatementAnalytics) -> list[InsightItem]:
        """Deterministic observations read straight off the analytics, for
        when the LLM is unavailable or returns nothing usable. Same grounding
        rule as the prompt: every figure here is one already persisted."""
        items: list[InsightItem] = []
        spend = analytics.total_spend
        if spend > 0:
            spending = [
                c for c in analytics.category_breakdown if c.category not in ("Income", "Uncategorized")
            ]
            if spending:
                top = max(spending, key=lambda c: c.total_amount)
                share = round(top.total_amount / spend * 100)
                items.append(InsightItem(
                    type="top_category",
                    message=f"{top.category} was your biggest known category at ₹{top.total_amount:,.0f} ({share}% of spending).",
                    severity=InsightSeverity.INFO,
                ))
        if analytics.top_merchants:
            m = analytics.top_merchants[0]
            items.append(InsightItem(
                type="top_merchant",
                message=f"You paid {m.merchant} the most: ₹{m.total_amount:,.0f} across {m.count} payments.",
                severity=InsightSeverity.INFO,
            ))
        if analytics.recurring_payments:
            n = len(analytics.recurring_payments)
            items.append(InsightItem(
                type="recurring_payments",
                message=f"{n} recurring {'payment' if n == 1 else 'payments'} detected this period.",
                severity=InsightSeverity.INFO,
            ))
        if analytics.total_income or spend:
            if analytics.net >= 0:
                items.append(InsightItem(
                    type="net_flow",
                    message=f"More came in than went out: net +₹{analytics.net:,.0f} this period.",
                    severity=InsightSeverity.POSITIVE,
                ))
            else:
                items.append(InsightItem(
                    type="net_flow",
                    message=f"You spent ₹{-analytics.net:,.0f} more than came in this period.",
                    severity=InsightSeverity.WARNING,
                ))
        return items

    @staticmethod
    def _to_insight_items(raw_items: Any) -> list[InsightItem]:
        # format: "json" makes Ollama emit a JSON object, so the requested
        # array usually arrives wrapped, e.g. {"insights": [...]}.
        if isinstance(raw_items, dict):
            raw_items = next((v for v in raw_items.values() if isinstance(v, list)), [raw_items])
        if not isinstance(raw_items, list):
            return []

        items = []
        for raw in raw_items:
            try:
                item = InsightItem(**raw)
                if len(item.message) > 300:
                    raise ValueError("message too long")
                items.append(item)
            except Exception:
                logger.warning("Discarding malformed insight item from LLM output: %r", raw)
        return items


statement_insight_generator = StatementInsightGenerator()
