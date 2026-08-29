/*
 * Local-timezone safe date-string helpers.
 *
 * `new Date("YYYY-MM-DD")` parses as UTC midnight, and `getFullYear() /
 * getMonth() / getDate()` read local time. For users west of UTC that shifts
 * every date by one day. All date handling in this plugin goes through these
 * helpers so dates always match the user's local calendar.
 */

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateStr(d);
}

/** Strict YYYY-MM-DD validation that rejects impossible dates (e.g. 2026-02-30). */
export function isValidDateStr(dateStr: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}