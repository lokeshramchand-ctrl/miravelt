import { statementsRepository } from '../api/instance';
import { showUnusualSpend } from './notifications';
import { useSettings } from '../state/settings';

/**
 * Profile > "Unusual spend" ("Only WATCH-level signals"): once a statement
 * finishes analysing, notify if its signals include a WARNING. A no-op when the
 * setting is off or nothing is at WATCH level. Never throws - a failed fetch
 * just means no alert, not a broken completion flow.
 */
export async function alertUnusualSpendIfEnabled(statementId: string): Promise<void> {
  if (!useSettings.getState().notifyUnusualSpend) return;
  try {
    const { insights } = await statementsRepository.insights(statementId);
    const watch = insights.filter((i) => i.severity === 'WARNING');
    if (watch.length === 0) return;
    const more = watch.length > 1 ? ` (+${watch.length - 1} more)` : '';
    await showUnusualSpend(`${watch[0].message}${more}`);
  } catch {
    // Best-effort, see above.
  }
}
