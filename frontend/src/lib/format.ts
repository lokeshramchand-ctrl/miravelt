const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAYS_FROM_MONDAY = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** Indian digit grouping (12,34,567) without depending on Intl locale data being present (Hermes). */
function groupIndian(n: number): string {
  const digits = String(n);
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** `₹80,634`, `−₹4,500` (true minus, not a hyphen), or `+₹42,000` when `forceSign` is set. */
export function formatCurrency(value: number, forceSign = false): string {
  const rounded = Math.round(value);
  const magnitude = groupIndian(Math.abs(rounded));
  if (rounded < 0) return `−₹${magnitude}`;
  if (forceSign && rounded > 0) return `+₹${magnitude}`;
  return `₹${magnitude}`;
}

export function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${Math.round(value)}`;
}

/** 1-indexed month abbreviation, e.g. `monthAbbr(6) === 'JUN'`. */
export function monthAbbr(month: number): string {
  return MONTHS[month - 1];
}

function titleCase(s: string): string {
  return s ? s[0] + s.slice(1).toLowerCase() : s;
}

/** `Jan – Jun 2026` */
export function formatPeriodRange(start: Date, end: Date): string {
  const s = titleCase(MONTHS[start.getMonth()]);
  const e = titleCase(MONTHS[end.getMonth()]);
  if (start.getFullYear() === end.getFullYear()) return `${s} – ${e} ${end.getFullYear()}`;
  return `${s} ${start.getFullYear()} – ${e} ${end.getFullYear()}`;
}

/** `28 JUN · SUN` */
export function formatDayHeader(date: Date): string {
  // JS getDay(): 0 = Sunday; the table starts at Monday.
  const weekday = WEEKDAYS_FROM_MONDAY[(date.getDay() + 6) % 7];
  return `${date.getDate()} ${MONTHS[date.getMonth()]} · ${weekday}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `04:47 PM` */
export function formatTime12h(dt: Date): string {
  const hour12 = dt.getHours() % 12 === 0 ? 12 : dt.getHours() % 12;
  const period = dt.getHours() >= 12 ? 'PM' : 'AM';
  return `${pad2(hour12)}:${pad2(dt.getMinutes())} ${period}`;
}

/** `28 JUN 2026 · 04:47 PM` */
export function formatFullTimestamp(dt: Date): string {
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()} · ${formatTime12h(dt)}`;
}

/**
 * Parses an API timestamp. A bare `YYYY-MM-DD` is a *local* calendar date (as
 * the Flutter client treated it); `new Date('2026-06-28')` would be UTC
 * midnight and slip a day backwards west of Greenwich.
 */
export function parseApiDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  return new Date(value);
}

/** `YYYY-MM-DD` of a local date, for query parameters. */
export function toDateOnly(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
