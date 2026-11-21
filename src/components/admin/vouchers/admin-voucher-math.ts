// VEYNS Admin Vouchers: display numbers for the stat cards, the status chips and the 30-day chart (Step B6).
// Nothing here writes anything. It only reads the vouchers and orders the dashboard already loads.

export type VoucherStatusKey = 'active' | 'scheduled' | 'disabled' | 'expired';

// getPromoStatus() gives 'scheduled', 'expired' or 'disabled'; anything else is a voucher that works now.
export const voucherStatusKey = (status: string): VoucherStatusKey =>
  status === 'scheduled' || status === 'disabled' || status === 'expired' ? status : 'active';

const manilaKey = (ms: number): string => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

// An order counts when it used a promo code and was not cancelled.
const countsAsDiscount = (o: any): boolean => !!o && !!o.promoCode && o.status !== 'cancelled';

export function discountTotals(orders: any[]): { food: number; delivery: number; total: number } {
  let food = 0;
  let delivery = 0;
  (orders || []).forEach((o: any) => {
    if (!countsAsDiscount(o)) return;
    food += Number(o.promoDiscount || 0);
    delivery += Number(o.deliveryDiscount || 0);
  });
  return { food, delivery, total: food + delivery };
}

export function totalRedemptions(promos: any[]): number {
  return (promos || []).reduce((sum: number, p: any) => sum + Number(p?.usageCount || 0), 0);
}

// The voucher with the most successful redemptions (null when nobody used any).
export function topPromo(promos: any[]): any | null {
  let best: any = null;
  (promos || []).forEach((p: any) => {
    if (Number(p?.usageCount || 0) > 0 && (!best || Number(p.usageCount) > Number(best.usageCount))) best = p;
  });
  return best;
}

// Money given away per day for the last `days` days (Philippine dates), oldest first, ending today.
export function dailyDiscounts(orders: any[], days: number, nowMs: number): { key: string; value: number }[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(manilaKey(nowMs - i * 86400000));
  const sums: Record<string, number> = {};
  keys.forEach((k) => { sums[k] = 0; });
  (orders || []).forEach((o: any) => {
    if (!countsAsDiscount(o) || !o.createdAt) return;
    const t = Date.parse(o.createdAt);
    if (Number.isNaN(t)) return;
    const k = manilaKey(t);
    if (k in sums) sums[k] += Number(o.promoDiscount || 0) + Number(o.deliveryDiscount || 0);
  });
  return keys.map((k) => ({ key: k, value: sums[k] }));
}
