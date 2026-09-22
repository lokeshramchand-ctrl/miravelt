import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/api_environment.dart';

/// Overridden in main() once SharedPreferences.getInstance() resolves -
/// every provider below depends on it, so nothing reads prefs before the
/// override is in place.
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('sharedPreferencesProvider must be overridden in main()');
});

class ThemeModeController extends Notifier<ThemeMode> {
  static const _key = 'miravelt.theme_mode';

  @override
  ThemeMode build() {
    final stored = ref.watch(sharedPreferencesProvider).getString(_key);
    return switch (stored) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  void set(ThemeMode mode) {
    state = mode;
    ref.read(sharedPreferencesProvider).setString(_key, mode.name);
  }
}

final themeModeProvider = NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);

/// A simple on-device boolean preference (no server-side counterpart exists
/// for these yet - see docs/API_REFERENCE.md). Real, persisted, functional
/// local settings; not wired to backend behavior.
class BoolPreferenceController extends Notifier<bool> {
  BoolPreferenceController(this._key, this._defaultValue);

  final String _key;
  final bool _defaultValue;

  @override
  bool build() => ref.watch(sharedPreferencesProvider).getBool(_key) ?? _defaultValue;

  void set(bool value) {
    state = value;
    ref.read(sharedPreferencesProvider).setBool(_key, value);
  }
}

final keepOriginalPdfsProvider = NotifierProvider<BoolPreferenceController, bool>(
  () => BoolPreferenceController('miravelt.keep_original_pdfs', true),
);

final notifyAnalysisFinishedProvider = NotifierProvider<BoolPreferenceController, bool>(
  () => BoolPreferenceController('miravelt.notify_analysis_finished', true),
);

final notifyUnusualSpendProvider = NotifierProvider<BoolPreferenceController, bool>(
  () => BoolPreferenceController('miravelt.notify_unusual_spend', false),
);

/// Which backend (see [ApiEnvironment]) the app talks to. Persisted so a
/// developer's choice survives app restarts; always starts from
/// [ApiEnvironment.production] on a fresh install/unrecognized value - never
/// silently defaults to a developer's local machine.
class ApiEnvironmentController extends Notifier<ApiEnvironment> {
  static const _key = 'miravelt.api_environment';

  @override
  ApiEnvironment build() {
    final stored = ref.watch(sharedPreferencesProvider).getString(_key);
    return switch (stored) {
      'local' => ApiEnvironment.local,
      'custom' => ApiEnvironment.custom,
      _ => ApiEnvironment.production,
    };
  }

  void set(ApiEnvironment environment) {
    state = environment;
    ref.read(sharedPreferencesProvider).setString(_key, environment.name);
  }
}

final apiEnvironmentProvider = NotifierProvider<ApiEnvironmentController, ApiEnvironment>(ApiEnvironmentController.new);

/// The developer-entered URL backing [ApiEnvironment.custom] (e.g.
/// `http://192.168.1.5:8000/`) - unused while a preset environment is
/// active, but kept around so re-selecting Custom prefills the last value.
class CustomApiBaseUrlController extends Notifier<String> {
  static const _key = 'miravelt.custom_api_base_url';

  @override
  String build() => ref.watch(sharedPreferencesProvider).getString(_key) ?? '';

  void set(String url) {
    state = url;
    ref.read(sharedPreferencesProvider).setString(_key, url);
  }
}

final customApiBaseUrlProvider = NotifierProvider<CustomApiBaseUrlController, String>(CustomApiBaseUrlController.new);

/// The base URL every repository actually talks to - resolves
/// [ApiEnvironment.custom] against [customApiBaseUrlProvider] (falling back
/// to production if that's somehow blank, which the Profile UI's own
/// validation should never allow) so [ApiEnvironment.baseUrl]'s two fixed
/// presets stay the only case that needs no stored override.
final effectiveApiBaseUrlProvider = Provider<String>((ref) {
  final environment = ref.watch(apiEnvironmentProvider);
  if (environment != ApiEnvironment.custom) return environment.baseUrl;
  final custom = ref.watch(customApiBaseUrlProvider).trim();
  if (custom.isEmpty) return ApiEnvironment.production.baseUrl;
  return custom.endsWith('/') ? custom : '$custom/';
});

/// Unlocked by tapping the "Developer settings" row 5 times, mirroring
/// Android's Developer Options gesture - persisted so it stays unlocked
/// across restarts once a developer has found it once. Gates visibility of
/// the API server picker in every build (not just debug), since a tester on
/// a release APK may need to point at a staging/local backend too.
final developerModeUnlockedProvider = NotifierProvider<BoolPreferenceController, bool>(
  () => BoolPreferenceController('miravelt.developer_mode_unlocked', false),
);
