// Shared helpers for date-based promotional campaigns.
// The browser only DISPLAYS status/countdowns. The database (private.compute_order_discounts)
// is what actually accepts or rejects a promo, using its own clock.

export type CampaignStatus = 'scheduled' | 'active' | 'expired' | 'disabled';

export const BUSINESS_TIMEZONE = 'Asia/Manila'; // UTC+8, no daylight saving

// Absolute end of a promo in ms: new expires_at wins, otherwise the legacy created_at + duration rule.
export function getPromoEndMs(p: any): number | null {
  if (p?.expiresAt) return Number(p.expiresAt);
  if (p?.expiryDurationMs && p.expiryDurationMs > 0 && p.createdAt) return Number(p.createdAt) + Number(p.expiryDurationMs);
  return null;
}

export function getPromoStatus(p: any, nowMs: number): CampaignStatus {
  if (p?.isEnabled === false) return 'disabled';
  if (p?.startDate && Number(p.startDate) > nowMs) return 'scheduled';
  const end = getPromoEndMs(p);
  if (end !== null && nowMs >= end) return 'expired';
  return 'active';
}

// A "campaign" is a promo created with a name or an explicit schedule (vs. a plain legacy voucher).
export function isCampaignPromo(p: any): boolean {
  if (p?.name || p?.expiresAt) return true;
  return Boolean(p?.startDate && p?.createdAt && Number(p.startDate) - Number(p.createdAt) > 60_000);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatCountdown(diffMs: number): string {
  const d = Math.max(0, diffMs);
  const days = Math.floor(d / 86_400_000);
  const hours = Math.floor((d % 86_400_000) / 3_600_000);
  const minutes = Math.floor((d % 3_600_000) / 60_000);
  const seconds = Math.floor((d % 60_000) / 1000);
  return `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

// <input type="datetime-local"> value, interpreted as Asia/Manila wall-clock time -> ISO (UTC)
export function manilaLocalToIso(value: string): string | null {
  if (!value) return null;
  const v = value.length === 16 ? `${value}:00` : value;
  const d = new Date(`${v}+08:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ISO/ms -> value for <input type="datetime-local"> in Asia/Manila wall-clock time
export function toManilaLocalInput(msOrIso?: number | string | null): string {
  if (msOrIso === null || msOrIso === undefined || msOrIso === '') return '';
  const t = typeof msOrIso === 'number' ? msOrIso : Date.parse(String(msOrIso));
  if (Number.isNaN(t)) return '';
  return new Date(t + 8 * 3_600_000).toISOString().slice(0, 16);
}

export function formatManila(ms?: number | null): string {
  if (!ms) return '-';
  return new Date(ms).toLocaleString('en-PH', { timeZone: BUSINESS_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' });
}

export const STATUS_STYLES: Record<CampaignStatus, string> = {
  active: 'bg-lime-400/20 text-lime-400 border border-lime-400/40',
  scheduled: 'bg-sky-500/20 text-sky-300 border border-sky-400/40',
  expired: 'bg-red-950 text-red-400 border border-red-800',
  disabled: 'bg-slate-700/40 text-slate-300 border border-slate-500/50',
};