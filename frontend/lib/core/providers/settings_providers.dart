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
  static const _key = 'auvren.theme_mode';

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
  () => BoolPreferenceController('auvren.keep_original_pdfs', true),
);

final notifyAnalysisFinishedProvider = NotifierProvider<BoolPreferenceController, bool>(
  () => BoolPreferenceController('auvren.notify_analysis_finished', true),
);

final notifyUnusualSpendProvider = NotifierProvider<BoolPreferenceController, bool>(
  () => BoolPreferenceController('auvren.notify_unusual_spend', false),
);

/// Which of the two backends (see [ApiEnvironment]) the app talks to.
/// Persisted so a developer's choice survives app restarts; always starts
/// from [ApiEnvironment.production] on a fresh install/unrecognized value -
/// never silently defaults to a developer's local machine.
class ApiEnvironmentController extends Notifier<ApiEnvironment> {
  static const _key = 'auvren.api_environment';

  @override
  ApiEnvironment build() {
    final stored = ref.watch(sharedPreferencesProvider).getString(_key);
    return switch (stored) {
      'local' => ApiEnvironment.local,
      _ => ApiEnvironment.production,
    };
  }

  void set(ApiEnvironment environment) {
    state = environment;
    ref.read(sharedPreferencesProvider).setString(_key, environment.name);
  }
}

final apiEnvironmentProvider = NotifierProvider<ApiEnvironmentController, ApiEnvironment>(ApiEnvironmentController.new);
