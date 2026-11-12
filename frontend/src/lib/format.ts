const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAYS_FROM_MONDAY = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/**
 * The app's clock (PROJECT_AUDIT.md F7). Statements print Indian local time
 * and the backend groups days in Asia/Kolkata (core/timezone.py), so every
 * date the app shows is read in IST, not the phone's zone: a phone abroad
 * still shows the time printed on the statement, and a 02:00 payment lands
 * on the same day in the list as in the charts. India has no DST, so a fixed
 * offset is exact and needs no Intl time-zone data (absent on Hermes).
 */
export const APP_TZ_OFFSET_MINUTES = 330;
const OFFSET_MS = APP_TZ_OFFSET_MINUTES * 60_000;

export interface ZonedParts {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** 0 = Monday ... 6 = Sunday */
  weekdayFromMonday: number;
}

/** Calendar/clock fields of `date` in the app's zone. */
export function zoned(date: Date): ZonedParts {
  const shifted = new Date(date.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    weekdayFromMonday: (shifted.getUTCDay() + 6) % 7,
  };
}

/** The instant a calendar day begins in the app's zone. */
export function startOfZonedDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - OFFSET_MS);
}

/** The start of the app-zone day containing `date` - the grouping key for day lists. */
export function zonedDayStart(date: Date): Date {
  const z = zoned(date);
  return startOfZonedDay(z.year, z.month, z.day);
}

/** Whole calendar months covered by [start, end], counting both ends. */
export function monthsSpanned(start: Date, end: Date): number {
  const a = zoned(start);
  const b = zoned(end);
  return (b.year - a.year) * 12 + (b.month - a.month) + 1;
}

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
  const a = zoned(start);
  const b = zoned(end);
  const s = titleCase(MONTHS[a.month - 1]);
  const e = titleCase(MONTHS[b.month - 1]);
  if (a.year === b.year) return `${s} – ${e} ${b.year}`;
  return `${s} ${a.year} – ${e} ${b.year}`;
}

/** `28 JUN · SUN` */
export function formatDayHeader(date: Date): string {
  const z = zoned(date);
  return `${z.day} ${MONTHS[z.month - 1]} · ${WEEKDAYS_FROM_MONDAY[z.weekdayFromMonday]}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `04:47 PM` */
export function formatTime12h(dt: Date): string {
  const z = zoned(dt);
  const hour12 = z.hours % 12 === 0 ? 12 : z.hours % 12;
  const period = z.hours >= 12 ? 'PM' : 'AM';
  return `${pad2(hour12)}:${pad2(z.minutes)} ${period}`;
}

/** `28 JUN 2026 · 04:47 PM` */
export function formatFullTimestamp(dt: Date): string {
  const z = zoned(dt);
  return `${z.day} ${MONTHS[z.month - 1]} ${z.year} · ${formatTime12h(dt)}`;
}

/**
 * Parses an API timestamp. A bare `YYYY-MM-DD` is a calendar date in the
 * app's zone, so it becomes the instant that day starts in IST - the same
 * day the backend means, whatever zone the phone is in.
 */
export function parseApiDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return startOfZonedDay(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]));
  return new Date(value);
}

/** `YYYY-MM-DD` of the app-zone calendar day `date` falls on, for query parameters. */
export function toDateOnly(date: Date): string {
  const z = zoned(date);
  return `${String(z.year).padStart(4, '0')}-${pad2(z.month)}-${pad2(z.day)}`;
}

/** `2026-06-28T16:47:00` in the app's zone (no offset suffix), for exports. */
export function toZonedIso(date: Date): string {
  const z = zoned(date);
  return `${toDateOnly(date)}T${pad2(z.hours)}:${pad2(z.minutes)}:${pad2(z.seconds)}`;
}

/** `4 Jun` */
export function formatDayMonth(date: Date): string {
  const z = zoned(date);
  return `${z.day} ${titleCase(MONTHS[z.month - 1])}`;
}

/** Elapsed time for live states: "0:07", "1:42", "1:02:05". Negative input reads as 0. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * Splits text into reveal chunks for a streamed-text effect: each word keeps its trailing
 * whitespace, so joining any prefix of the chunks is an exact prefix of the text.
 */
export function revealChunks(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [];
}
