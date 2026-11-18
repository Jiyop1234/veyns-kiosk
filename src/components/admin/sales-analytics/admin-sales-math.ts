// @ts-nocheck
// Step B9: all Sales Analytics numbers come from here. Every card, chart and table of the page reads the same functions, so they cannot disagree.
// Money rules (written once, used everywhere):
//   payable(order)  = what the customer pays: the PWD final amount if PWD was applied, otherwise the order total.
//   Net sales       = sum of payable() of COMPLETED orders (money actually collected).
//   Gross sales     = Net + the discounts given on those same completed orders (voucher, delivery voucher, customer discount, PWD).
//   Discounts given = discounts on every order that is not cancelled (pending ones count, they are promised).
// Dates are grouped by Manila day, from the order's created time.

export const DAY = 86400000;
const MANILA = 8 * 3600000;

export const manilaKey = (ms: number) => new Date(ms + MANILA).toISOString().slice(0, 10);
export const keyToMs = (key: string) => Date.parse(key + 'T00:00:00Z') - MANILA; // start of that Manila day
export const orderMs = (o: any) => (o?.createdAt ? Date.parse(o.createdAt) : NaN);
export const payable = (o: any) => (o.pwdApplied ? Number(o.pwdFinal || 0) : Number(o.total || 0));
export const isCompleted = (o: any) => o.status === 'completed';
export const notCancelled = (o: any) => o.status !== 'cancelled';
const sum = (arr: any[], f: (x: any) => number) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const qtyOf = (it: any) => Number(it?.qty ?? it?.quantity ?? 1);
const nameOf = (it: any) => it?.name || it?.item?.name || 'Item';
const unitOf = (it: any) => Number(it?.unitPrice ?? it?.price ?? it?.item?.price ?? 0);
export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function discountsOf(o: any) {
  const voucher = Number(o.promoDiscount || 0) + Number(o.deliveryDiscount || 0);
  const manual = Number(o.manualDiscount || 0);
  const pwd = o.pwdApplied ? Number(o.pwdDiscount || 0) : 0;
  return { voucher, manual, pwd, total: voucher + manual + pwd };
}

export type Preset = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom';
export type Range = { fromMs: number; toMs: number };

export function resolveRange(preset: Preset, customFrom: string, customTo: string, orders: any[], nowMs: number): Range {
  const todayStart = keyToMs(manilaKey(nowMs));
  const endMs = todayStart + DAY - 1;
  const n = ({ '7d': 7, '30d': 30, '90d': 90 } as any)[preset];
  if (preset === 'today') return { fromMs: todayStart, toMs: endMs };
  if (n) return { fromMs: todayStart - (n - 1) * DAY, toMs: endMs };
  if (preset === 'custom') {
    let f = customFrom ? keyToMs(customFrom) : todayStart - 29 * DAY;
    let t = customTo ? keyToMs(customTo) + DAY - 1 : endMs;
    if (f > t) { const x = f; f = keyToMs(manilaKey(t)); t = x + DAY - 1; }
    return { fromMs: f, toMs: t };
  }
  const times = orders.map(orderMs).filter((x) => Number.isFinite(x));
  const first = times.length ? keyToMs(manilaKey(Math.min(...times))) : todayStart;
  return { fromMs: first, toMs: endMs };
}

// The period right before the chosen one, same length. "All time" has no previous period.
export function previousRange(r: Range, preset: Preset): Range | null {
  if (preset === 'all') return null;
  const len = r.toMs - r.fromMs + 1;
  return { fromMs: r.fromMs - len, toMs: r.fromMs - 1 };
}

export const fulfillmentKey = (o: any) => String(o.fulfillment || 'delivery').toLowerCase();

export function applyFilters(orders: any[], f: { range: Range; fulfillment: string; status: string }) {
  return orders.filter((o) => {
    const t = orderMs(o);
    if (!(t >= f.range.fromMs && t <= f.range.toMs)) return false;
    if (f.fulfillment !== 'all' && fulfillmentKey(o) !== f.fulfillment) return false;
    if (f.status !== 'all' && o.status !== f.status) return false;
    return true;
  });
}

export function bowlsOf(orders: any[]) {
  return orders.reduce((s, o) => s + sum(o.items || [], qtyOf), 0);
}

export function summarize(orders: any[]) {
  const completed = orders.filter(isCompleted);
  const live = orders.filter(notCancelled);
  const byStatus: Record<string, number> = {};
  orders.forEach((o) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
  const net = sum(completed, payable);
  const completedDisc = sum(completed, (o) => discountsOf(o).total);
  const gross = net + completedDisc;
  const disc = { voucher: 0, manual: 0, pwd: 0, total: 0 };
  live.forEach((o) => { const d = discountsOf(o); disc.voucher += d.voucher; disc.manual += d.manual; disc.pwd += d.pwd; disc.total += d.total; });
  const liveGross = sum(live, payable) + disc.total;
  const perUser: Record<string, number> = {};
  live.forEach((o) => { if (o.userId) perUser[o.userId] = (perUser[o.userId] || 0) + 1; });
  const users = Object.keys(perUser);
  const repeaters = users.filter((u) => perUser[u] >= 2).length;
  return {
    count: orders.length,
    byStatus,
    completedCount: completed.length,
    completionRate: orders.length ? completed.length / orders.length : 0,
    net: round2(net),
    gross: round2(gross),
    aov: completed.length ? round2(net / completed.length) : 0,
    discounts: { voucher: round2(disc.voucher), manual: round2(disc.manual), pwd: round2(disc.pwd), total: round2(disc.total) },
    discountPct: liveGross > 0 ? disc.total / liveGross : 0,
    bowls: bowlsOf(completed),
    pendingValue: round2(sum(orders.filter((o) => o.status === 'pending'), payable)),
    pendingCount: byStatus['pending'] || 0,
    deliveryFees: round2(sum(completed, (o) => o.deliveryFee)),
    repeat: { customers: users.length, repeaters, rate: users.length ? repeaters / users.length : 0 },
  };
}

// Change vs the previous period (a fraction, 0.12 = +12%). null when there is nothing to compare with.
export function deltaOf(cur: number, prev: number | null | undefined) {
  if (prev === null || prev === undefined) return null;
  if (prev === 0) return cur === 0 ? 0 : null;
  return (cur - prev) / prev;
}

export type Metric = 'revenue' | 'orders' | 'bowls' | 'aov';

export function buildBuckets(range: Range) {
  const start = keyToMs(manilaKey(range.fromMs));
  const days = Math.floor((keyToMs(manilaKey(range.toMs)) - start) / DAY) + 1;
  const size = days > 62 ? 7 : 1;
  const n = Math.ceil(days / size);
  return Array.from({ length: n }, (_, i) => ({ startMs: start + i * size * DAY, endMs: Math.min(start + (i + 1) * size * DAY - 1, range.toMs), size }));
}

export function seriesFor(orders: any[], buckets: any[], metric: Metric) {
  return buckets.map((b) => {
    const inB = orders.filter((o) => { const t = orderMs(o); return t >= b.startMs && t <= b.endMs; });
    const done = inB.filter(isCompleted);
    const net = sum(done, payable);
    const bowls = bowlsOf(done);
    const live = inB.filter(notCancelled);
    const value = metric === 'revenue' ? net : metric === 'orders' ? live.length : metric === 'bowls' ? bowls : done.length ? net / done.length : 0;
    return { startMs: b.startMs, endMs: b.endMs, size: b.size, value: round2(value), net: round2(net), orders: live.length, bowls, hasVoucher: live.some((o) => o.promoCode) };
  });
}

// Items sold on completed orders, with a daily/weekly trend.
export function topItems(orders: any[], buckets: any[]) {
  const map: Record<string, any> = {};
  const done = orders.filter(isCompleted);
  done.forEach((o) => {
    const t = orderMs(o);
    const bi = buckets.findIndex((b) => t >= b.startMs && t <= b.endMs);
    (o.items || []).forEach((it: any) => {
      const name = nameOf(it);
      const m = map[name] || (map[name] = { name, units: 0, revenue: 0, trend: buckets.map(() => 0) });
      const q = qtyOf(it);
      m.units += q;
      m.revenue += q * unitOf(it);
      if (bi >= 0) m.trend[bi] += q;
    });
  });
  const list = Object.values(map).sort((a: any, b: any) => b.units - a.units || b.revenue - a.revenue);
  const totalUnits = list.reduce((s: number, x: any) => s + x.units, 0);
  return list.map((x: any) => ({ ...x, revenue: round2(x.revenue), share: totalUnits ? x.units / totalUnits : 0, price: x.units ? round2(x.revenue / x.units) : 0 }));
}

export function fulfillmentMix(orders: any[]) {
  const map: Record<string, number> = {};
  orders.filter(isCompleted).forEach((o) => {
    const f = fulfillmentKey(o);
    const label = f === 'delivery' ? (o.deliveryOption === 'maxim' ? 'Delivery (Maxim)' : 'Delivery') : f === 'pickup' ? 'Pickup' : f.charAt(0).toUpperCase() + f.slice(1);
    map[label] = (map[label] || 0) + payable(o);
  });
  return Object.entries(map).map(([label, value]) => ({ label, value: round2(value) })).sort((a, b) => b.value - a.value);
}

export function orderTypeSplit(orders: any[]) {
  const done = orders.filter(isCompleted);
  const res = done.filter((o) => o.orderType === 'reservation');
  return { today: done.length - res.length, reservation: res.length, todayValue: round2(sum(done.filter((o) => o.orderType !== 'reservation'), payable)), reservationValue: round2(sum(res, payable)) };
}

// Customers: new vs returning vs walk-in revenue, top spenders and loyalty tiers.
export function customerStats(orders: any[], allOrders: any[], customers: any[]) {
  const firstSeen: Record<string, number> = {};
  allOrders.filter(notCancelled).forEach((o) => {
    if (!o.userId) return;
    const t = orderMs(o);
    if (!(o.userId in firstSeen) || t < firstSeen[o.userId]) firstSeen[o.userId] = t;
  });
  const done = orders.filter(isCompleted);
  const range = orders.length ? Math.min(...orders.map(orderMs).filter(Number.isFinite)) : 0;
  let walkin = 0, fresh = 0, returning = 0;
  const spend: Record<string, any> = {};
  done.forEach((o) => {
    const p = payable(o);
    if (!o.userId) { walkin += p; return; }
    const isNew = firstSeen[o.userId] >= range && orders.some((x) => x.userId === o.userId && orderMs(x) === firstSeen[o.userId]);
    if (isNew) fresh += p; else returning += p;
    const s = spend[o.userId] || (spend[o.userId] = { userId: o.userId, total: 0, orders: 0, nickname: o.accountNickname });
    s.total += p; s.orders += 1;
  });
  const byAuth: Record<string, any> = {};
  (customers || []).forEach((c) => { if (c.auth_user_id) byAuth[c.auth_user_id] = c; });
  const top = Object.values(spend).sort((a: any, b: any) => b.total - a.total).slice(0, 5).map((s: any) => ({ ...s, total: round2(s.total), name: byAuth[s.userId]?.name || s.nickname || 'Customer', tier: byAuth[s.userId]?.tier || 'Regular' }));
  const tiers: Record<string, number> = {};
  (customers || []).forEach((c) => { const t = c.tier || 'Regular'; tiers[t] = (tiers[t] || 0) + 1; });
  return { walkin: round2(walkin), fresh: round2(fresh), returning: round2(returning), top, tiers, registered: (customers || []).length };
}

// Vouchers: uses, cost and revenue per code, plus customer discounts shown apart.
export function promoStats(orders: any[], promos: any[]) {
  const live = orders.filter(notCancelled);
  const withCode = live.filter((o) => o.promoCode);
  const map: Record<string, any> = {};
  withCode.forEach((o) => {
    const m = map[o.promoCode] || (map[o.promoCode] = { code: o.promoCode, uses: 0, cost: 0, revenue: 0, doneCount: 0 });
    m.uses += 1;
    m.cost += Number(o.promoDiscount || 0) + Number(o.deliveryDiscount || 0);
    if (isCompleted(o)) { m.revenue += payable(o); m.doneCount += 1; }
  });
  const done = orders.filter(isCompleted);
  const noCode = done.filter((o) => !o.promoCode);
  const aovWithout = noCode.length ? sum(noCode, payable) / noCode.length : 0;
  const info: Record<string, any> = {};
  (promos || []).forEach((p) => { info[p.code] = p; });
  const rows = Object.values(map).sort((a: any, b: any) => b.uses - a.uses).map((m: any) => {
    const p = info[m.code];
    const label = p ? `${p.type === 'peso' ? '₱' + p.discountValue : p.discountValue + '%'} off ${p.target_type === 'delivery' ? 'delivery' : 'food'}` : '';
    return { ...m, cost: round2(m.cost), revenue: round2(m.revenue), label, aovWith: m.doneCount ? round2(m.revenue / m.doneCount) : 0 };
  });
  const manualOrders = live.filter((o) => Number(o.manualDiscount || 0) > 0);
  return { rows, aovWithout: round2(aovWithout), manualCount: manualOrders.length, manualTotal: round2(sum(manualOrders, (o) => o.manualDiscount)), voucherUses: withCode.length };
}

const csvCell = (v: any) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stops spreadsheets from running text as a formula
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export function ordersToCsv(orders: any[]) {
  const head = ['Order #', 'Date (Manila)', 'Account', 'Customer', 'Fulfillment', 'Order type', 'Status', 'Items', 'Promo code', 'Voucher discount', 'Customer discount', 'PWD discount', 'Delivery fee', 'Total paid'];
  const rows = orders.map((o) => {
    const d = discountsOf(o);
    return [o.orderNumber, new Date(orderMs(o) + MANILA).toISOString().replace('T', ' ').slice(0, 16), o.accountNickname, o.name, o.fulfillment, o.orderType, o.status,
      (o.items || []).map((it: any) => `${qtyOf(it)}x ${nameOf(it)}`).join('; '), o.promoCode, d.voucher.toFixed(2), d.manual.toFixed(2), d.pwd.toFixed(2), Number(o.deliveryFee || 0).toFixed(2), payable(o).toFixed(2)];
  });
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

// Boss briefing: findings worked out from the same filtered numbers. Each has a severity, a finding and a suggested action.
export function buildBriefing(ctx: { cur: any; prev: any | null; items: any[]; series: any[]; orders: any[]; promoS: any; nowMs: number }) {
  const { cur, prev, items, series, orders, promoS, nowMs } = ctx;
  const out: any[] = [];
  if (cur.count === 0) return [{ id: 'empty', tone: 'info', title: 'No orders in this view', finding: 'Nothing matches the date range and filters you chose.', action: 'Widen the range or reset the filters.' }];
  const top = items[0];
  if (top && top.units >= 5 && top.share >= 0.6) out.push({ id: 'concentration', tone: 'warn', title: 'One item carries the menu', finding: `${top.name} is ${Math.round(top.share * 100)}% of the items sold (${top.units} units).`, action: 'Promote a second item or bundle it, so sales do not depend on one dish.' });
  const cancelled = cur.byStatus['cancelled'] || 0;
  if (cur.count >= 5 && cancelled / cur.count >= 0.1) out.push({ id: 'cancel', tone: 'bad', title: 'Cancellations are high', finding: `${cancelled} of ${cur.count} orders (${Math.round((cancelled / cur.count) * 100)}%) were cancelled.`, action: 'Open the cancelled orders in the log and look for a common cause (slot, stock, delivery).' });
  if (cur.pendingCount > 0) {
    const old = orders.filter((o) => o.status === 'pending' && nowMs - orderMs(o) > DAY).length;
    out.push({ id: 'pending', tone: old ? 'warn' : 'info', title: `${cur.pendingCount} pending ${cur.pendingCount === 1 ? 'order' : 'orders'}`, finding: `Worth ${fmt(cur.pendingValue)} and not yet completed${old ? `; ${old} older than a day` : ''}.`, action: 'Finish or reschedule them in Orders & POS so sales are counted.' });
  }
  if (cur.discountPct >= 0.15) out.push({ id: 'discounts', tone: 'warn', title: 'Discounts are a big slice', finding: `Discounts are ${(cur.discountPct * 100).toFixed(1)}% of sales (${fmt(cur.discounts.total)}).`, action: 'Check whether vouchers or customer discounts are bringing extra orders.' });
  else if (promoS.voucherUses === 0) out.push({ id: 'nopromo', tone: 'info', title: 'No voucher was used', finding: 'No order in this view used a voucher code.', action: 'Share a code with customers or check that your vouchers are active.' });
  if (prev) {
    const d = deltaOf(cur.net, prev.net);
    if (d !== null && d <= -0.2) out.push({ id: 'drop', tone: 'bad', title: 'Sales are down', finding: `Net sales fell ${Math.abs(Math.round(d * 100))}% against the previous period.`, action: 'Compare the days on the chart and check slots, menu availability and promos.' });
    if (d !== null && d >= 0.2) out.push({ id: 'rise', tone: 'good', title: 'Sales are up', finding: `Net sales grew ${Math.round(d * 100)}% against the previous period.`, action: 'Note what changed (promo, new item) and repeat it.' });
  }
  if (cur.repeat.customers >= 5 && cur.repeat.rate < 0.2) out.push({ id: 'repeat', tone: 'info', title: 'Few customers come back', finding: `Only ${cur.repeat.repeaters} of ${cur.repeat.customers} registered customers ordered more than once.`, action: 'Remind customers about loyalty stamps or send a come-back voucher.' });
  const best = series.reduce((b: any, s: any) => (s.net > (b?.net ?? 0) ? s : b), null);
  if (best && best.net > 0) out.push({ id: 'best', tone: 'good', title: 'Best day', finding: `${manilaKey(best.startMs)} brought ${fmt(best.net)}${best.size > 1 ? ' (that week)' : ''}.`, action: 'See what was special that day.' });
  return out.slice(0, 6);
}

const fmt = (n: number) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
