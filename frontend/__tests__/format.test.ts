import {
  formatCompactCurrency,
  formatCurrency,
  formatDayHeader,
  formatFullTimestamp,
  formatPeriodRange,
  formatTime12h,
  parseApiDate,
  toDateOnly,
} from '../src/lib/format';

describe('formatCurrency', () => {
  it('groups digits the Indian way', () => {
    expect(formatCurrency(80634)).toBe('₹80,634');
    expect(formatCurrency(1234567)).toBe('₹12,34,567');
    expect(formatCurrency(999)).toBe('₹999');
    expect(formatCurrency(0)).toBe('₹0');
  });
  it('uses a true minus and optional plus sign', () => {
    expect(formatCurrency(-4500)).toBe('−₹4,500');
    expect(formatCurrency(42000, true)).toBe('+₹42,000');
    expect(formatCurrency(0, true)).toBe('₹0');
  });
  it('rounds to whole rupees', () => {
    expect(formatCurrency(10.6)).toBe('₹11');
  });
  it('formats compact amounts', () => {
    expect(formatCompactCurrency(1500)).toBe('₹1.5k');
    expect(formatCompactCurrency(250)).toBe('₹250');
  });
});

describe('dates', () => {
  it('parses a bare date as a local calendar date, not UTC', () => {
    const d = parseApiDate('2026-06-28');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 5, 28]);
    expect(toDateOnly(d)).toBe('2026-06-28');
  });
  it('formats period ranges', () => {
    expect(formatPeriodRange(new Date(2026, 0, 1), new Date(2026, 5, 30))).toBe('Jan – Jun 2026');
    expect(formatPeriodRange(new Date(2025, 10, 1), new Date(2026, 1, 28))).toBe('Nov 2025 – Feb 2026');
  });
  it('formats the day header with the right weekday', () => {
    expect(formatDayHeader(new Date(2026, 5, 28))).toBe('28 JUN · SUN');
    expect(formatDayHeader(new Date(2026, 5, 29))).toBe('29 JUN · MON');
  });
  it('formats 12-hour times', () => {
    expect(formatTime12h(new Date(2026, 5, 28, 16, 47))).toBe('04:47 PM');
    expect(formatTime12h(new Date(2026, 5, 28, 0, 5))).toBe('12:05 AM');
    expect(formatTime12h(new Date(2026, 5, 28, 12, 0))).toBe('12:00 PM');
    expect(formatFullTimestamp(new Date(2026, 5, 28, 16, 47))).toBe('28 JUN 2026 · 04:47 PM');
  });
});
