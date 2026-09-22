import 'package:dio/dio.dart';

/// Result of probing a candidate backend's unauthenticated `/health`.
class HealthProbeResult {
  const HealthProbeResult._({required this.reachable, this.status, this.services = const {}, this.error});

  const HealthProbeResult.unreachable(String error) : this._(reachable: false, error: error);

  const HealthProbeResult.ok({required String? status, required Map<String, String> services})
      : this._(reachable: true, status: status, services: services);

  final bool reachable;

  /// The backend's own overall verdict ("healthy"/"degraded"), if it sent one.
  final String? status;

  /// Per-dependency state, e.g. `{mongodb: connected, milvus: connected,
  /// ollama: connected, redis: not_configured}` - the whole self-hosted
  /// stack in one glance, which is the actual question when you've just
  /// brought Docker up.
  final Map<String, String> services;

  final String? error;
}

/// Hits `<baseUrl>/health` on a throwaway [Dio] - deliberately not the app's
/// [ApiClient], because the whole point is to check a URL *before* committing
/// to it, and because `/health` is one of the few unauthenticated endpoints
/// (no API key, no JWT) so a probe can't be confused by an auth failure.
///
/// Timeouts are much shorter than the app's own: an unreachable dev box
/// should report back in seconds, not leave someone staring at a spinner.
Future<HealthProbeResult> probeBackendHealth(String baseUrl) async {
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 5),
    receiveTimeout: const Duration(seconds: 5),
    // A backend that is up but unhealthy answers 503 with the same body -
    // that's a result worth showing, not an exception to swallow.
    validateStatus: (code) => code != null && code < 600,
  ));
  try {
    final response = await dio.get<Map<String, dynamic>>('health');
    final body = response.data ?? const {};
    final rawServices = body['services'];
    final services = <String, String>{};
    if (rawServices is Map) {
      rawServices.forEach((key, value) => services['$key'] = '$value');
    }
    return HealthProbeResult.ok(status: body['status'] as String?, services: services);
  } on DioException catch (e) {
    return HealthProbeResult.unreachable(_describe(e));
  } catch (_) {
    return const HealthProbeResult.unreachable("Responded, but not with a backend health payload.");
  } finally {
    dio.close(force: true);
  }
}

String _describe(DioException e) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return 'Timed out. Nothing answered at this address.';
    case DioExceptionType.badCertificate:
      return "The server's TLS certificate was rejected.";
    case DioExceptionType.connectionError:
      // By far the most common real-world cause on a phone: a host firewall
      // dropping the port, or plain http:// to a host the OS won't allow.
      return 'Could not connect. Check the host is running, the port is open in its firewall, and that this device is on the same network.';
    default:
      return e.message ?? 'Could not reach this address.';
  }
}
