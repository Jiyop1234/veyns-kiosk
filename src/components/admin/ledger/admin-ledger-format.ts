// VEYNS Admin, Ledger: money, date and period helpers (Step B10a).
// All dates are Philippine time (UTC+8, no daylight saving), computed from epoch milliseconds,
// so the result does not depend on the time zone of the computer that opens the page.

import type { LedgerEntry, LedgerPeriod } from './admin-ledger-types';

export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatPeso(centavos: number, withSign = false): string {
  const sign = centavos < 0 ? '-' : withSign ? '+' : '';
  const abs = Math.abs(centavos);
  const text = (abs / 100).toLocaleString('en-PH', {
    minimumFractionDigits: abs % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${sign}₱${text}`;
}

export function formatCompactPeso(centavos: number): string {
  const pesos = Math.abs(centavos) / 100;
  if (pesos >= 1000) return `₱${(pesos / 1000).toFixed(1)}k`;
  return `₱${Math.round(pesos)}`;
}

export function manilaParts(ms: number) {
  const d = new Date(ms + MANILA_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(), // 0 = Sunday
  };
}

export function manilaStartOfDay(ms: number): number {
  const p = manilaParts(ms);
  return Date.UTC(p.year, p.month, p.day) - MANILA_OFFSET_MS;
}

// Monday 00:00 of the week that contains `ms`.
export function manilaStartOfWeek(ms: number): number {
  const p = manilaParts(ms);
  const sinceMonday = (p.weekday + 6) % 7;
  return manilaStartOfDay(ms) - sinceMonday * DAY_MS;
}

export type LedgerRange = { start: number; end: number };

// null means "no limit" (All Time).
export function periodRange(period: LedgerPeriod, now: number): LedgerRange | null {
  const p = manilaParts(now);
  if (period === 'today') {
    const start = manilaStartOfDay(now);
    return { start, end: start + DAY_MS };
  }
  if (period === 'week') {
    const start = manilaStartOfWeek(now);
    return { start, end: start + 7 * DAY_MS };
  }
  if (period === 'month') {
    return {
      start: Date.UTC(p.year, p.month, 1) - MANILA_OFFSET_MS,
      end: Date.UTC(p.year, p.month + 1, 1) - MANILA_OFFSET_MS,
    };
  }
  if (period === 'year') {
    return {
      start: Date.UTC(p.year, 0, 1) - MANILA_OFFSET_MS,
      end: Date.UTC(p.year + 1, 0, 1) - MANILA_OFFSET_MS,
    };
  }
  return null;
}

// The period right before the current one (for "vs last month"). null for All Time.
export function previousPeriodRange(period: LedgerPeriod, now: number): LedgerRange | null {
  const p = manilaParts(now);
  if (period === 'today') {
    const end = manilaStartOfDay(now);
    return { start: end - DAY_MS, end };
  }
  if (period === 'week') {
    const end = manilaStartOfWeek(now);
    return { start: end - 7 * DAY_MS, end };
  }
  if (period === 'month') {
    return {
      start: Date.UTC(p.year, p.month - 1, 1) - MANILA_OFFSET_MS,
      end: Date.UTC(p.year, p.month, 1) - MANILA_OFFSET_MS,
    };
  }
  if (period === 'year') {
    return {
      start: Date.UTC(p.year - 1, 0, 1) - MANILA_OFFSET_MS,
      end: Date.UTC(p.year, 0, 1) - MANILA_OFFSET_MS,
    };
  }
  return null;
}

export function inRange(ms: number, range: LedgerRange | null): boolean {
  return range ? ms >= range.start && ms < range.end : true;
}

// "Nov 16, 2026 • 3:24 PM"
export function formatDateTime(ms: number): string {
  const p = manilaParts(ms);
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const ampm = p.hour < 12 ? 'AM' : 'PM';
  return `${MONTHS[p.month]} ${p.day}, ${p.year} • ${hour12}:${pad(p.minute)} ${ampm}`;
}

// Value for <input type="datetime-local">: "2026-11-16T15:24" (Philippine time).
export function toInputValue(ms: number): string {
  const p = manilaParts(ms);
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function fromInputValue(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(text);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) - MANILA_OFFSET_MS;
  return Number.isFinite(ms) ? ms : null;
}

// "1,250.50" -> 125050. Returns null if it is not a positive amount with at most 2 decimals.
export function parsePesoToCentavos(text: string): number | null {
  const clean = text.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const centavos = Math.round(Number(clean) * 100);
  return centavos > 0 ? centavos : null;
}

export function centavosToInput(centavos: number): string {
  return centavos % 100 === 0 ? String(centavos / 100) : (centavos / 100).toFixed(2);
}

function csvCell(value: string | number): string {
  let s = String(value);
  // Stop spreadsheet programs from running typed text as a formula.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function entriesToCsv(entries: LedgerEntry[]): string {
  const rows = [['Date and time (PH)', 'Type', 'Description', 'Category', 'Amount (PHP)', 'Notes']];
  for (const e of entries) {
    rows.push([
      toInputValue(e.occurredAt).replace('T', ' '),
      e.kind === 'income' ? 'Income' : 'Expense',
      e.description,
      e.category,
      (e.amountCentavos / 100).toFixed(2),
      e.notes,
    ]);
  }
  return '\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
