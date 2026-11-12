import type { Transaction } from '../domain/types';
import { formatCurrency, formatFullTimestamp } from './format';

/**
 * The categories offered when a user says "Wrong category". Spending
 * categories only (F4): a payment can't be filed as Income (it would vanish
 * from spending), and "Uncategorized" is the one name for "no category".
 */
export const TRANSACTION_CATEGORIES = [
  'Food',
  'Travel',
  'Entertainment',
  'Bills',
  'Friends',
  'Education',
  'Healthcare',
  'Subscription',
  'Shopping',
  'Utility',
  'Uncategorized',
] as const;

/** Only payments carry a spending category; money received is always Income. */
export function canRecategorize(txn: Pick<Transaction, 'transactionType'>): boolean {
  return txn.transactionType === 'DEBIT';
}

/**
 * A one-line description of a transaction (accessibility labels, sharing).
 * POST /v1/explain no longer takes this text: it takes the transaction id and
 * reads the user's own history with the payee.
 */
export function explainTransactionText(txn: Transaction): string {
  const amount = formatCurrency(Math.abs(txn.amount));
  const when = formatFullTimestamp(txn.timestamp);
  const merchant = txn.merchant ?? 'an unknown payee';
  if (txn.transactionType === 'CREDIT') return `Received ${amount} from ${merchant} on ${when}.`;
  return `Paid ${amount} to ${merchant} on ${when}, categorized as ${txn.category ?? 'Uncategorized'}.`;
}

/**
 * The "Why this category" card's label and sentence, chosen from how the
 * backend actually decided the category (`categorizationConfidence`) so the
 * card never claims more certainty than there was.
 */
export function categoryExplanation(txn: Transaction): { label: string; body: string } {
  const category = txn.category ?? 'Uncategorized';
  const payee = txn.merchant ?? 'this payee';
  const confidence = txn.categorizationConfidence;

  if (txn.transactionType === 'CREDIT') {
    return { label: 'INCOMING', body: `Money you received from ${payee}. Incoming payments are always filed under Income.` };
  }
  if (txn.categorizationSource === 'user') {
    return { label: 'YOUR CORRECTION', body: `You filed ${payee} under ${category}. Every payment to ${payee}, past and future, follows it.` };
  }
  if (txn.categorizationSource === 'user_memory') {
    return { label: 'REMEMBERED', body: `You corrected ${payee} to ${category} on an earlier statement, so Miravelt filed this one the same way.` };
  }
  if (txn.categorizationSource === 'community') {
    return {
      label: 'LEARNED',
      body: `Several Miravelt users filed this business under ${category}, so it is now a shared rule. Only businesses are ever shared - never people.`,
    };
  }
  if (category === 'Uncategorized' || confidence === 0) {
    return {
      label: 'NOT MATCHED',
      body:
        `Miravelt doesn't recognise ${payee} as a merchant or a type of business, so this is left uncategorized ` +
        `rather than guessed. Use Wrong category to teach it - every ${payee} payment updates with it.`,
    };
  }
  if (confidence != null && confidence < 0.9) {
    return {
      label: 'BEST GUESS',
      body: `${payee} isn't a known merchant, but its name suggests a ${category} business. This is a best guess - if it's off, use Wrong category.`,
    };
  }
  if (confidence != null) {
    return { label: 'KNOWN MERCHANT', body: `Filed under ${category} because ${payee} is a known merchant, or because you corrected it.` };
  }
  return { label: 'MERCHANT-BASED', body: `Filed under ${category} for ${payee}.` };
}
