import 'dart:io';

/// The backends the app can point at. Selectable at runtime from Profile >
/// Developer settings, unlocked by tapping that row 5 times like Android's
/// Developer Options (see [ApiEnvironmentController] in
/// settings_providers.dart) - available in every build, not just debug, so a
/// tester on a release APK can point at a staging/local backend too. Each
/// preset's default can still be overridden at build time via --dart-define
/// for a host/port that doesn't match the defaults below (see
/// frontend/README.md).
enum ApiEnvironment {
  /// The deployed Coolify-hosted backend. Always the release default and
  /// what a fresh install with no stored preference falls back to.
  production,

  /// A backend running on the developer's own machine, reached from the
  /// device/emulator this app is running on.
  local,

  /// A developer-entered URL (any host/port), stored separately - see
  /// [customApiBaseUrlProvider] in settings_providers.dart. [baseUrl] does
  /// not carry this value since it needs no [ref] to resolve the two fixed
  /// presets above; use `effectiveApiBaseUrlProvider` instead of `.baseUrl`
  /// wherever the environment might be [custom].
  custom;

  /// Throws for [custom] - callers must resolve that case via
  /// `effectiveApiBaseUrlProvider`, which has access to the stored override.
  String get baseUrl {
    switch (this) {
      case ApiEnvironment.production:
        return const String.fromEnvironment(
          'MIRAVELT_API_BASE_URL',
          defaultValue: 'https://miravelt.deploy.lokeshrc.me/',
        );
      case ApiEnvironment.local:
        const override = String.fromEnvironment('MIRAVELT_LOCAL_API_BASE_URL');
        return override.isNotEmpty ? override : _defaultLocalBaseUrl;
      case ApiEnvironment.custom:
        throw UnsupportedError('ApiEnvironment.custom has no static baseUrl - use effectiveApiBaseUrlProvider');
    }
  }

  String get label => switch (this) {
        ApiEnvironment.production => 'Deployed',
        ApiEnvironment.local => 'Localhost',
        ApiEnvironment.custom => 'Custom',
      };

  // Android emulator can't resolve "localhost" to the host machine -
  // 10.0.2.2 is its documented alias for that. iOS simulator can reach the
  // host directly as localhost. Port 9850 matches docker-compose_local.yaml's
  // published port for the full containerized stack; override via
  // --dart-define=MIRAVELT_LOCAL_API_BASE_URL=... for a bare
  // `uvicorn app:app --reload` on 8000, a real device on the LAN, or a
  // different port.
  static String get _defaultLocalBaseUrl => Platform.isAndroid ? 'http://10.0.2.2:9850/' : 'http://localhost:9850/';
}
