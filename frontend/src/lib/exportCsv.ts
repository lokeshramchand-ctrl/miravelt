import type { Transaction } from '../domain/types';

import { toZonedIso } from './format';

/**
 * RFC 4180 quoting, plus spreadsheet formula-injection defence (F24): payee
 * names are third-party text, and a cell beginning with = + - @ (or a tab /
 * carriage return) is executed as a formula by Excel and Sheets. Such a cell
 * is prefixed with an apostrophe, which the spreadsheet shows as plain text.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function transactionsToCsv(transactions: Transaction[]): string {
  const rows = transactions.map((t) =>
    [toZonedIso(t.timestamp), t.merchant ?? '', t.category ?? '', String(t.amount), t.transactionType.toLowerCase(), t.status.toLowerCase()].map(csvField).join(','),
  );
  return ['date,merchant,category,amount,type,status', ...rows].join('\n') + '\n';
}

/**
 * Writes text to a cache file and opens the system share sheet on it, so it
 * arrives as an attachment the receiving app can open - not pasted into a
 * message body (F24). Falls back to sharing text where sharing files is
 * unavailable.
 */
export async function shareTextFile(content: string, fileName: string, mimeType: string, dialogTitle: string, uti?: string): Promise<void> {
  const FileSystem = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: uti });
    return;
  }
  const { Share } = await import('react-native');
  await Share.share({ message: content, title: fileName });
}

/** A file-system-safe base name from something like a statement's original filename. */
export function safeBaseName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/\.pdf$/i, '') || 'miravelt';
}

export function shareCsvFile(csv: string, baseName: string): Promise<void> {
  return shareTextFile(csv, `${safeBaseName(baseName)}.csv`, 'text/csv', 'Export transactions', 'public.comma-separated-values-text');
}

/** The full account export (GET /users/me/export) as one JSON file. */
export function shareJsonFile(data: unknown, baseName: string): Promise<void> {
  return shareTextFile(JSON.stringify(data, null, 2), `${safeBaseName(baseName)}.json`, 'application/json', 'Export all my data', 'public.json');
}
