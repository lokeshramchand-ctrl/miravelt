# 0003 - The grounding rule

**Status:** accepted

**Decision.** `POST /v1/explain` returns `NO_CONTEXT_AVAILABLE` without calling the model when
retrieval finds nothing about the user's own history with that payee. Generated statement insights
pass `insights/fact_check.py`: every number and merchant name in a sentence must appear in the
context, otherwise the sentence is dropped and the computed insight is used.

**Why.** The product promise is "grounded, never invented". A prompt asking the model to behave is a
request; a check on its output is a guarantee.

**Consequences.** Some answers are blunter than a free-running model's. That is intended.
Payee names are sanitised before they reach a prompt.

**Revisit when** never for the rule itself; only the checker's tolerance may change.
