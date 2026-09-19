import 'dart:io';

/// The two backends the app can point at - nothing else is supported.
/// Selectable at runtime from Profile > Developer (debug builds only; see
/// [ApiEnvironmentController] in settings_providers.dart). Each side's
/// default can still be overridden at build time via --dart-define for a
/// host/port that doesn't match the defaults below (see frontend/README.md).
enum ApiEnvironment {
  /// The deployed Coolify-hosted backend. Always the release default and
  /// what a fresh install with no stored preference falls back to.
  production,

  /// A backend running on the developer's own machine, reached from the
  /// device/emulator this app is running on.
  local;

  String get baseUrl {
    switch (this) {
      case ApiEnvironment.production:
        return const String.fromEnvironment(
          'VELAR_API_BASE_URL',
          defaultValue: 'https://velar.deploy.lokeshrc.me/',
        );
      case ApiEnvironment.local:
        const override = String.fromEnvironment('VELAR_LOCAL_API_BASE_URL');
        return override.isNotEmpty ? override : _defaultLocalBaseUrl;
    }
  }

  String get label => switch (this) {
        ApiEnvironment.production => 'Deployed',
        ApiEnvironment.local => 'Localhost',
      };

  // Android emulator can't resolve "localhost" to the host machine -
  // 10.0.2.2 is its documented alias for that. iOS simulator can reach the
  // host directly as localhost. Port 9850 matches docker-compose_local.yaml's
  // published port for the full containerized stack; override via
  // --dart-define=VELAR_LOCAL_API_BASE_URL=... for a bare
  // `uvicorn app:app --reload` on 8000, a real device on the LAN, or a
  // different port.
  static String get _defaultLocalBaseUrl => Platform.isAndroid ? 'http://10.0.2.2:9850/' : 'http://localhost:9850/';
}
