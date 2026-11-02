/// Hand-parsed, not freezed/json_serializable: POST /v1/explain always
/// answers 200, but `result` has two incompatible shapes depending on
/// whether grounded context was found (routers/rag.py), so this models
/// that union directly instead of forcing one generated class to cover both.
class ExplainOutcome {
  const ExplainOutcome.explained({
    required this.explanation,
    required this.confidence,
    this.primarySource,
  }) : unavailableReason = null;

  const ExplainOutcome.unavailable(this.unavailableReason)
      : explanation = null,
        confidence = null,
        primarySource = null;

  final String? explanation;
  final String? confidence;
  final String? primarySource;
  final String? unavailableReason;

  bool get isAvailable => unavailableReason == null;

  factory ExplainOutcome.fromJson(Map<String, dynamic> json) {
    final result = (json['result'] as Map<String, dynamic>?) ?? const {};
    final error = result['error'] as String?;
    if (error != null) return ExplainOutcome.unavailable(error);
    return ExplainOutcome.explained(
      explanation: result['explanation'] as String? ?? 'No explanation returned.',
      confidence: result['confidence_in_explanation'] as String?,
      primarySource: result['primary_data_source'] as String?,
    );
  }
}
