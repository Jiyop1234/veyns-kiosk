// Downloads for the Delivery Fee screen: the draft rule as JSON, and a CSV that compares every recent delivery order under the live and the draft rule.
// Step B11a: new file. No customer name, phone, address or map coordinates are written to the CSV.
import { FeeRule, LIVE_RULE, STORE_LAT, STORE_LNG, computeFee, eligibleOrders } from '@/components/admin/delivery-fees/admin-delivery-fee-math';

// A cell starting with = + - @ could be run as a formula by Excel, so it gets a ' in front.
const cell = (v: string | number | null): string => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: (string | number | null)[]): string => cells.map(cell).join(',');

export const rulesJson = (draft: FeeRule): string =>
  JSON.stringify({
    note: 'Draft delivery fee rule from the VEYNS admin Delivery Fee screen. Not published: checkout still uses the live rule.',
    exportedAt: new Date().toISOString(),
    store: { lat: STORE_LAT, lng: STORE_LNG },
    liveRule: LIVE_RULE,
    draftRule: draft,
  }, null, 2);

export const comparisonCsv = (orders: any[], draft: FeeRule, nowMs: number, days: number): string => {
  const { rows } = eligibleOrders(orders, nowMs, days);
  const lines: string[] = [row(['Order', 'Date', 'Status', 'Distance km', 'Order subtotal', 'Fee charged', 'Fee under live rule', 'Fee under draft rule', 'Draft result'])];
  for (const { order, rawKm } of rows) {
    const subtotal = Number(order.subtotal || 0);
    const l = computeFee(LIVE_RULE, rawKm, subtotal);
    const d = computeFee(draft, rawKm, subtotal);
    const result = d.rejected === 'radius' ? 'Not delivered: beyond the maximum radius' : d.rejected === 'minimum' ? 'Not delivered: below the minimum order' : 'Delivered';
    lines.push(row([
      order.orderNumber || order.id || '',
      String(order.createdAt || '').slice(0, 10),
      order.status || '',
      Number(rawKm.toFixed(3)),
      subtotal,
      Number(order.deliveryFee || 0),
      l.fee,
      d.fee,
      result,
    ]));
  }
  return lines.join('\r\n');
};

export const downloadTextFile = (filename: string, text: string, mime: string): void => {
  const blob = new Blob([mime.startsWith('text/csv') ? '\uFEFF' + text : text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
