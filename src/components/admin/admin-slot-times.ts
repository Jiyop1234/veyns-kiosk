// @ts-nocheck
// Admin time-slot helpers (Asia/Manila): today, when a slot ends, and 12-hour / 24-hour slot conversion.
// Step A3: moved unchanged from employee-dashboard.tsx (via the A2 helpers file); only "export" was added.
// ---- schedule-transfer helpers (Asia/Manila, real timestamps) ----
export const todayManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
export const slotEndsAt = (dateKey: string, slot: string): number | null => {
  const m = (slot || '').match(/^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*-\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*$/);
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return null;
  const mins = (h: string, mi: string, ap: string) => ((parseInt(h, 10) % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0)) * 60 + parseInt(mi, 10);
  const s = mins(m[1], m[2], m[3]);
  let e = mins(m[4], m[5], m[6]);
  if (e <= s) e += 1440;
  const [y, mo, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, 0, e, 0) - 8 * 3600 * 1000; // Manila = UTC+8
};
export const slotHasEnded = (dateKey: string, slot: string) => {
  const end = slotEndsAt(dateKey, slot);
  return end === null ? true : end <= Date.now();
};
// "09:00" -> "9:00 AM" (format required by the database slot parser)
export const to12h = (hhmm: string) => {
  const [h, m] = (hhmm || '').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
// "9:00 AM - 10:00 AM" -> { start: "09:00", end: "10:00" }
export const slotTo24 = (slot: string): { start: string; end: string } | null => {
  const m = (slot || '').match(/^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*-\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*$/);
  if (!m) return null;
  const conv = (h: string, mi: string, ap: string) => `${String((parseInt(h, 10) % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0)).padStart(2, '0')}:${mi}`;
  return { start: conv(m[1], m[2], m[3]), end: conv(m[4], m[5], m[6]) };
};
