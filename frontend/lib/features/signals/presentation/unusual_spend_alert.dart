import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/notifications/local_notifications_service.dart';
import '../../../core/providers/feature_providers.dart';
import '../../../core/providers/settings_providers.dart';
import '../../statements/domain/insight.dart';

/// Profile > "Unusual spend" ("Only WATCH-level signals"): once a statement
/// finishes analysing, notify if its signals include a WARNING. A no-op when
/// the setting is off or nothing is at WATCH level. Never throws - a failed
/// fetch just means no alert, not a broken completion flow.
Future<void> alertUnusualSpendIfEnabled(WidgetRef ref, String statementId) async {
  if (!ref.read(notifyUnusualSpendProvider)) return;
  final repo = ref.read(statementsRepositoryProvider);
  try {
    final response = await repo.insights(statementId);
    final watch = response.insights.where((i) => i.severity == InsightSeverity.warning).toList();
    if (watch.isEmpty) return;
    final more = watch.length > 1 ? ' (+${watch.length - 1} more)' : '';
    await LocalNotificationsService.instance.showUnusualSpend(body: '${watch.first.message}$more');
  } catch (_) {
    // Best-effort, see above.
  }
}
