import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../domain/job.dart';

class JobsRepository {
  JobsRepository({required this._apiClient});

  final ApiClient _apiClient;

  Future<Job> get(String jobId) async {
    final response = await _apiClient.get<Map<String, dynamic>>('/jobs/$jobId');
    return Job.fromJson(response.data!);
  }

  /// Polls until the job reaches a terminal state (COMPLETED/FAILED), or
  /// [timeout] elapses. There's no push/webhook - see docs/API_REFERENCE.md §4.
  ///
  /// A network-level failure (timeout, dropped connection) is retried up to
  /// [maxConsecutiveNetworkErrors] times in a row before surfacing: the
  /// backend processes statements in-process and can answer slowly while a
  /// job is running, and one slow poll must not end an analysis screen that
  /// is otherwise fine. HTTP errors (404, 401...) still surface immediately.
  Stream<Job> poll(
    String jobId, {
    Duration interval = const Duration(seconds: 2),
    Duration? timeout,
    int maxConsecutiveNetworkErrors = 5,
  }) async* {
    final deadline = timeout == null ? null : DateTime.now().add(timeout);
    var networkErrors = 0;
    while (true) {
      final Job job;
      try {
        job = await get(jobId);
        networkErrors = 0;
      } on ApiNetworkException {
        if (++networkErrors > maxConsecutiveNetworkErrors) rethrow;
        await Future.delayed(interval);
        continue;
      }
      yield job;
      if (job.status == JobStatus.completed || job.status == JobStatus.failed) return;
      if (deadline != null && DateTime.now().isAfter(deadline)) return;
      await Future.delayed(interval);
    }
  }
}
