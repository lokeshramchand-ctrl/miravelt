/// Runtime config, supplied via --dart-define (see frontend/README.md).
///
/// The API base URL itself is NOT here - see api_environment.dart's
/// [ApiEnvironment], which is the single source of truth for both backend
/// targets (deployed vs. localhost) and is switchable at runtime.
///
/// MIRAVELT_API_KEY has no client-facing issuance endpoint (see
/// docs/API_REFERENCE.md §0) - it's a static value the app ships/configures
/// with, the same way the backend operator holds it.
abstract final class AppConfig {
  static const String apiKey = String.fromEnvironment(
    'MIRAVELT_API_KEY',
    defaultValue:
        'miravelt_test_key_123', // or remove if you don't want a fallback
  );

  /// Pre-fills the login form with a seeded local test account
  /// (lo@gmail.com) so sign-in during development is one tap. Debug-only:
  /// kDebugMode is compiled out of release builds, so this never ships.
  static const String devEmail = 'lo@gmail.com';
  static const String devPassword = '123456789';
}
