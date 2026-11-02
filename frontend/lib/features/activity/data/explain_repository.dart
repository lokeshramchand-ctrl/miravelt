import '../../../core/network/api_client.dart';
import '../domain/explain_outcome.dart';

/// Wraps POST /v1/explain (routers/rag.py) - grounded explanation of a
/// single transaction from the user's own merchant history. Rate-limited
/// 20/min on the backend, so this is a deliberate on-demand action from the
/// transaction sheet, never an auto-fetch-on-open call.
class ExplainRepository {
  ExplainRepository({required this._apiClient});

  final ApiClient _apiClient;

  Future<ExplainOutcome> explain({
    required String transactionText,
    String? targetQuestion,
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/v1/explain',
      data: {
        'transaction_text': transactionText,
        'target_question': ?targetQuestion,
      },
    );
    return ExplainOutcome.fromJson(response.data!);
  }
}
