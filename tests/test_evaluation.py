"""The evaluation harness as a test (PROJECT_AUDIT.md E2): categorisation,
person/business and insight-faithfulness quality must not fall below the
committed baseline (evaluation/baseline.json)."""
import json

from evaluation.run import BASELINE, METRICS, evaluate, regressions


def test_quality_does_not_regress():
    result = evaluate()
    assert regressions(result, json.loads(BASELINE.read_text())) == []


def test_the_rules_never_file_a_person_under_a_merchant_category():
    assert evaluate()["people_kept_private"] == 1.0


def test_every_generated_sentence_check_is_right():
    assert evaluate()["insight_faithfulness"] == 1.0


def test_baseline_covers_every_metric():
    assert set(json.loads(BASELINE.read_text())) == set(METRICS)
