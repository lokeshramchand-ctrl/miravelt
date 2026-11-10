import type { Transaction } from '../domain/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-06-28T16:47:00` - the local wall-clock time, no zone suffix (as the statement shows it). */
function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** RFC 4180: quote a field that contains a comma, quote or newline (merchant names do contain commas). */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function transactionsToCsv(transactions: Transaction[]): string {
  const rows = transactions.map((t) =>
    [localIso(t.timestamp), t.merchant ?? '', t.category ?? '', String(t.amount), t.transactionType.toLowerCase(), t.status.toLowerCase()].map(csvField).join(','),
  );
  return ['date,merchant,category,amount,type,status', ...rows].join('\n') + '\n';
}
