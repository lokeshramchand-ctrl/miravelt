import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';
import '../storage/token_storage.dart';
import 'settings_providers.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

/// A session-expired signal the router listens to (see app_router.dart).
/// Bumped whenever the API layer forces a logout (refresh-token reuse,
/// expired refresh token) so the UI can react even outside of an explicit
/// sign-out button press.
final sessionExpiredTickProvider = StateProvider<int>((ref) => 0);

/// Rebuilds with a fresh [ApiClient] pointed at the new base URL whenever
/// [effectiveApiBaseUrlProvider] changes (e.g. the Profile > Developer
/// settings picker) - every repository provider watches this one, so
/// switching environments propagates through the whole app automatically.
final apiClientProvider = Provider<ApiClient>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  final baseUrl = ref.watch(effectiveApiBaseUrlProvider);
  return ApiClient(
    baseUrl: baseUrl,
    tokenStorage: tokenStorage,
    onSessionExpired: () async {
      ref.read(sessionExpiredTickProvider.notifier).state++;
    },
  );
});
