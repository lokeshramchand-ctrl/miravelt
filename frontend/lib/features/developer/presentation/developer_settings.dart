import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/api_environment.dart';
import '../../../core/providers/settings_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/widgets/toggle_row.dart';
import '../data/health_probe.dart';

/// Taps required to reveal Developer settings, and the window a run of taps
/// has to land in - mirrors Android's own "tap the build number" gesture.
const _tapsToUnlock = 5;
const _tapWindow = Duration(seconds: 2);

/// Wraps [child] in the unlock gesture. Once [developerModeUnlockedProvider]
/// is set, a single tap opens the sheet instead, so the gesture only has to
/// be performed once per install.
///
/// This sits on the login screen as well as Profile, deliberately: the moment
/// you need to repoint the app is the moment its backend is unreachable, and
/// at that moment you cannot sign in to reach Profile.
class DeveloperUnlockGesture extends ConsumerStatefulWidget {
  const DeveloperUnlockGesture({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<DeveloperUnlockGesture> createState() => _DeveloperUnlockGestureState();
}

class _DeveloperUnlockGestureState extends ConsumerState<DeveloperUnlockGesture> {
  int _taps = 0;
  Timer? _resetTimer;

  @override
  void dispose() {
    _resetTimer?.cancel();
    super.dispose();
  }

  void _onTap() {
    if (ref.read(developerModeUnlockedProvider)) {
      showDeveloperSettingsSheet(context);
      return;
    }
    _resetTimer?.cancel();
    _resetTimer = Timer(_tapWindow, () {
      if (mounted) setState(() => _taps = 0);
    });
    setState(() => _taps += 1);
    if (_taps < _tapsToUnlock) return;
    _resetTimer?.cancel();
    setState(() => _taps = 0);
    ref.read(developerModeUnlockedProvider.notifier).set(true);
    showDeveloperSettingsSheet(context);
  }

  @override
  Widget build(BuildContext context) {
    final remaining = _tapsToUnlock - _taps;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          widget.child,
          // Only ever rendered mid-gesture, so someone who taps a footer once
          // never learns there is anything hidden here.
          if (_taps > 0 && _taps < _tapsToUnlock) ...[
            const SizedBox(height: 4),
            Text(
              '$remaining more ${remaining == 1 ? 'tap' : 'taps'}',
              style: AppTypography.footnote1155.copyWith(color: AppColors.onDarkFaint),
            ),
          ],
        ],
      ),
    );
  }
}

Future<void> showDeveloperSettingsSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.ink850,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const _DeveloperSettingsSheet(),
  );
}

class _DeveloperSettingsSheet extends ConsumerStatefulWidget {
  const _DeveloperSettingsSheet();

  @override
  ConsumerState<_DeveloperSettingsSheet> createState() => _DeveloperSettingsSheetState();
}

class _DeveloperSettingsSheetState extends ConsumerState<_DeveloperSettingsSheet> {
  bool _probing = false;
  HealthProbeResult? _result;

  Future<void> _testConnection() async {
    final url = ref.read(effectiveApiBaseUrlProvider);
    setState(() {
      _probing = true;
      _result = null;
    });
    final result = await probeBackendHealth(url);
    if (!mounted) return;
    setState(() {
      _probing = false;
      _result = result;
    });
  }

  @override
  Widget build(BuildContext context) {
    final environment = ref.watch(apiEnvironmentProvider);
    final effectiveUrl = ref.watch(effectiveApiBaseUrlProvider);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          14,
          AppSpacing.gutter,
          MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(color: AppColors.ink700, borderRadius: BorderRadius.circular(100)),
                ),
              ),
              const SizedBox(height: 16),
              Text('Developer settings', style: AppTypography.rowLabel14.copyWith(fontSize: 17, color: AppColors.onDark)),
              const SizedBox(height: 6),
              Text(
                'Point the app at a different backend. MongoDB, Milvus and Ollama all sit behind whichever backend you pick.',
                style: AppTypography.footnote1155.copyWith(color: AppColors.onDarkMuted),
              ),
              const SizedBox(height: 18),
              Text('API SERVER', style: AppTypography.microLabelTracked105.copyWith(color: AppColors.onDarkFaint)),
              const SizedBox(height: 10),
              AuvrenSegmentedControl<ApiEnvironment>(
                value: environment,
                options: [for (final e in ApiEnvironment.values) (e, e.label)],
                onChanged: _switchEnvironment,
              ),
              const SizedBox(height: 16),
              _UrlPanel(
                url: effectiveUrl,
                onEdit: environment == ApiEnvironment.custom ? () => _switchEnvironment(ApiEnvironment.custom) : null,
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _probing ? null : _testConnection,
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: AppColors.hairlineDark),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                  ),
                  child: _probing
                      ? SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
                        )
                      : Text('Test connection', style: AppTypography.buttonLabel14.copyWith(color: AppColors.onDark)),
                ),
              ),
              if (_result != null) ...[
                const SizedBox(height: 14),
                _HealthReport(result: _result!),
              ],
              const SizedBox(height: 18),
              Text(
                'Switching backends signs you out - a session issued by one is not valid on another.',
                style: AppTypography.footnote1155.copyWith(color: AppColors.onDarkFaint),
              ),
              if (environment != ApiEnvironment.production) ...[
                const SizedBox(height: 6),
                Center(
                  child: TextButton(
                    onPressed: () => _switchEnvironment(ApiEnvironment.production),
                    child: Text(
                      'Reset to ${ApiEnvironment.production.label}',
                      style: AppTypography.footnote12.copyWith(color: AppColors.accentDim),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// Deliberately does not sign out or navigate: this sheet is reachable from
  /// the login screen, where there is no session to end. A session that is no
  /// longer valid against the newly-selected backend is cleared by the normal
  /// 401 path (auth_interceptor.dart), which the router already listens to.
  Future<void> _switchEnvironment(ApiEnvironment next) async {
    if (next == ApiEnvironment.custom) {
      final url = await _promptCustomBaseUrl(context, ref);
      if (url == null) return;
      ref.read(customApiBaseUrlProvider.notifier).set(url);
    } else if (next == ref.read(apiEnvironmentProvider)) {
      return;
    }
    ref.read(apiEnvironmentProvider.notifier).set(next);
    if (mounted) setState(() => _result = null);
  }
}

class _UrlPanel extends StatelessWidget {
  const _UrlPanel({required this.url, this.onEdit});

  final String url;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.ink900,
        border: Border.all(color: AppColors.hairlineDark),
        borderRadius: BorderRadius.circular(AppRadius.field),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('CURRENTLY USING', style: AppTypography.microLabelTracked105.copyWith(color: AppColors.onDarkFaint)),
                const SizedBox(height: 4),
                Text(url, style: AppTypography.body14.copyWith(color: AppColors.onDark)),
              ],
            ),
          ),
          if (onEdit != null)
            TextButton(
              onPressed: onEdit,
              child: Text('Edit', style: AppTypography.buttonLabel12.copyWith(color: AppColors.accent)),
            ),
        ],
      ),
    );
  }
}

class _HealthReport extends StatelessWidget {
  const _HealthReport({required this.result});

  final HealthProbeResult result;

  @override
  Widget build(BuildContext context) {
    final reachable = result.reachable;
    final accent = reachable ? AppColors.accent : AppColors.rose;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.ink900,
        border: Border.all(color: accent.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(AppRadius.field),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            reachable ? 'Responded - ${result.status ?? 'no status'}' : 'Could not reach it',
            style: AppTypography.rowLabel14.copyWith(color: accent),
          ),
          if (!reachable) ...[
            const SizedBox(height: 6),
            Text(result.error ?? '', style: AppTypography.footnote1155.copyWith(color: AppColors.onDarkMuted)),
          ],
          if (result.services.isNotEmpty) ...[
            const SizedBox(height: 10),
            for (final entry in result.services.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(entry.key, style: AppTypography.body14.copyWith(color: AppColors.onDark)),
                    Text(
                      entry.value,
                      style: AppTypography.meta12.copyWith(
                        color: entry.value == 'connected' ? AppColors.accent : AppColors.onDarkFaint,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

/// Prompts for and validates a backend URL, returning the normalized
/// (trailing-slash) form, or `null` if cancelled.
Future<String?> _promptCustomBaseUrl(BuildContext context, WidgetRef ref) {
  final controller = TextEditingController(text: ref.read(customApiBaseUrlProvider));
  String? error;
  return showDialog<String>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        backgroundColor: AppColors.ink850,
        title: Text('Custom backend URL', style: AppTypography.rowLabel14.copyWith(color: AppColors.onDark)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: TextInputType.url,
              style: TextStyle(color: AppColors.onDark),
              decoration: InputDecoration(hintText: 'http://192.168.1.5:8000/', errorText: error),
            ),
            const SizedBox(height: 8),
            Text(
              'Your machine\'s LAN address and the port the backend is published on. Its firewall has to allow that port.',
              style: AppTypography.footnote1155.copyWith(color: AppColors.onDarkMuted),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('Cancel', style: TextStyle(color: AppColors.onDarkMuted)),
          ),
          TextButton(
            onPressed: () {
              final normalized = normalizeBaseUrl(controller.text);
              if (normalized == null) {
                setState(() => error = 'Enter a valid http(s) URL, e.g. http://192.168.1.5:8000/');
                return;
              }
              Navigator.of(context).pop(normalized);
            },
            child: Text('Save', style: TextStyle(color: AppColors.accent)),
          ),
        ],
      ),
    ),
  );
}

/// Validates and normalizes a developer-entered backend URL, or returns
/// `null` if it is not a usable absolute http(s) URL.
String? normalizeBaseUrl(String input) {
  final trimmed = input.trim();
  if (trimmed.isEmpty) return null;
  final uri = Uri.tryParse(trimmed);
  if (uri == null || uri.host.isEmpty || (uri.scheme != 'http' && uri.scheme != 'https')) return null;
  return trimmed.endsWith('/') ? trimmed : '$trimmed/';
}
