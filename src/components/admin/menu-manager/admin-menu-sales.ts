// VEYNS Admin: sales numbers for the Menu Manager (Step B7).
// "Sold" = units on orders that are not cancelled. An order line is matched to a menu item by its menu item id, or, for
// older orders that have no id, by the item name. The month and the days follow Philippine time on any computer.
import { itemQty, lineItemName } from '@/components/admin/admin-order-items';

const MANILA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });

// 'YYYY-MM-DD' of a moment in Philippine time
export function manilaDayKey(ts: string | number | Date): string {
  return MANILA_DAY.format(new Date(ts));
}

// Move a 'YYYY-MM-DD' key by whole days (pure date arithmetic, no time zone involved)
export function addDaysKey(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export type MenuSales = {
  monthKey: string;
  todayKey: string;
  monthQty: Record<string, number>;                  // units sold this month, by menu item id
  dayQty: Record<string, Record<string, number>>;    // units sold per day, by menu item id
};

export function buildMenuSales(orders: any[], menuItems: any[], now: number = Date.now()): MenuSales {
  const todayKey = manilaDayKey(now);
  const monthKey = todayKey.slice(0, 7);
  const ids = new Set<string>();
  const byName: Record<string, string> = {};
  (menuItems || []).forEach((m: any) => {
    ids.add(String(m.id));
    byName[String(m.name || '').trim().toLowerCase()] = String(m.id);
  });
  const monthQty: Record<string, number> = {};
  const dayQty: Record<string, Record<string, number>> = {};

  (orders || []).forEach((o: any) => {
    if (!o || o.status === 'cancelled' || !o.createdAt) return;
    const t = new Date(o.createdAt).getTime();
    if (!Number.isFinite(t)) return;
    const day = manilaDayKey(t);
    (Array.isArray(o.items) ? o.items : []).forEach((line: any) => {
      let id = String(line?.menuItemId ?? line?.id ?? line?.item?.id ?? '');
      if (!ids.has(id)) id = byName[String(lineItemName(line)).trim().toLowerCase()] || '';
      if (!id) return;
      const q = itemQty(line);
      if (day.startsWith(monthKey)) monthQty[id] = (monthQty[id] || 0) + q;
      if (!dayQty[id]) dayQty[id] = {};
      dayQty[id][day] = (dayQty[id][day] || 0) + q;
    });
  });
  return { monthKey, todayKey, monthQty, dayQty };
}

// Units sold per day for the last `days` days (oldest first, the last point is today)
export function dailySeries(sales: MenuSales, id: string, days: number = 14): number[] {
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push((sales.dayQty[id] || {})[addDaysKey(sales.todayKey, -i)] || 0);
  }
  return out;
}
