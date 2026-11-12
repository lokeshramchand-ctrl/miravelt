# Evaluation

Measured quality of the parts of Miravelt that label things, run in CI so a change that makes them
worse fails the build (PROJECT_AUDIT.md E2).

```bash
python -m evaluation.run            # prints the report, exits 1 on a regression
python -m evaluation.run --write    # accept the current numbers as the new baseline
```

## What is measured

| Metric | Meaning |
|---|---|
| Coverage | Share of business payees that get any category (not Uncategorized) |
| Accuracy when labelled | Of those, the share whose category is the expected one |
| End-to-end accuracy | Share of business payees with the right category (coverage × accuracy) |
| Person / business accuracy | Share of all payees classified as the right kind |
| People kept private | Share of people never given a merchant category by the rules. Must be 100% |
| Insight faithfulness | The fact checker admits every true sentence and rejects every invented one |

## The data

`payees.csv` is a hand-labelled list of payee strings as they print on UPI statements: national
brands under their legal names, local shops with and without a telling word, and people. They were
written for this purpose and are **not taken from anyone's statement**. A blank category means
"no category can be known from the name alone" and is excluded from category accuracy.

The set is small, was written by the same hand as the alias list, and the keyword rules were
extended with its misses in view. Read the numbers as a regression guard, not a benchmark: on
real statements, coverage will be lower. The honest next step is a set built from real corrections:
`db.feedback` already records every one.

`baseline.json` holds the numbers the build must not fall below.
