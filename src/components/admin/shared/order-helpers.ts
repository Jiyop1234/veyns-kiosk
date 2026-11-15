// @ts-nocheck
// Step A2: order, slot, status and edit helpers moved unchanged from employee-dashboard.tsx (only "export" added).
// ---- order display helpers (work for normalised items AND old raw items) ----
export const itemQty = (it: any) => Number(it?.qty ?? it?.quantity ?? 1);
export const lineItemName = (it: any) => it?.name || it?.item?.name || 'Item';
export const itemUnit = (it: any) => Number(it?.unitPrice ?? it?.price ?? it?.item?.price ?? 0);

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

// ---- order status + PWD helpers ----
export const ORDER_STATUSES = ['pending', 'completed', 'cancelled', 'rescheduled'] as const;
export const STATUS_LABEL: Record<string, string> = { pending: 'Pending', completed: 'Completed', cancelled: 'Cancelled', rescheduled: 'Rescheduled' };
export const STATUS_SKIN: Record<string, string> = {
  pending: 'bg-amber-400/15 text-amber-300 border-amber-400/50',
  completed: 'bg-lime-400/15 text-lime-300 border-lime-400/50',
  cancelled: 'bg-red-950 text-red-400 border-red-800',
  rescheduled: 'bg-sky-400/15 text-sky-300 border-sky-400/50'
};
// Amount actually payable/collected: PWD orders use the discounted final amount.
export const payableAmount = (o: any) => (o?.pwdApplied ? Number(o.pwdFinal || 0) : Number(o?.total || 0));

// ---- edit-order helpers ----
// Our Delivery vs Maxim: use the saved delivery_option; older orders fall back to the schedule text.
export const orderDeliveryOption = (o: any): 'our' | 'maxim' | null => {
  if ((o?.fulfillment || '') !== 'delivery') return null;
  if (o?.deliveryOption === 'our' || o?.deliveryOption === 'maxim') return o.deliveryOption;
  return /maxim/i.test(o?.scheduleInfo || '') ? 'maxim' : 'our';
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
