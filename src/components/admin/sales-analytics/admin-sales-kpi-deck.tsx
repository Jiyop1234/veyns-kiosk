// @ts-nocheck
// Step B9: the 8 KPI cards. Each shows a change chip against the previous period (when Compare is on) and a small trend line.
import React from 'react';
import { Wallet, Receipt, ShoppingBag, Gauge, Tag, UtensilsCrossed, Repeat2, Hourglass, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Sparkline, peso } from '@/components/admin/sales-analytics/admin-sales-charts';
import { deltaOf } from '@/components/admin/sales-analytics/admin-sales-math';

function Delta({ cur, prev, goodWhenUp = true }: any) {
  const d = deltaOf(cur, prev);
  if (d === null || d === undefined) return null;
  const up = d > 0.0005, down = d < -0.0005;
  const good = goodWhenUp ? up : down;
  const bad = goodWhenUp ? down : up;
  const tone = good ? 'bg-emerald-400/15 text-emerald-300' : bad ? 'bg-red-400/15 text-red-300' : 'bg-white/10 text-emerald-100/70';
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tone}`} title="Compared with the previous period"><Icon className="size-3" />{Math.abs(Math.round(d * 100))}%</span>;
}

export function AdminSalesKpiDeck({ cur, prev, series }: any) {
  const spark = (key) => series.map((s) => s[key]);
  const cards = [
    { id: 'net', label: 'Net sales', icon: Wallet, tint: 'text-lime-300 bg-lime-400/15', color: '#a3e635', value: peso(cur.net), sub: 'Completed orders, after discounts', delta: [cur.net, prev?.net], spark: spark('net') },
    { id: 'gross', label: 'Gross sales', icon: Receipt, tint: 'text-emerald-300 bg-emerald-400/15', color: '#34d399', value: peso(cur.gross), sub: 'Net plus discounts given on them', delta: [cur.gross, prev?.gross], spark: spark('net') },
    { id: 'orders', label: 'Orders', icon: ShoppingBag, tint: 'text-sky-300 bg-sky-400/15', color: '#38bdf8', value: String(cur.count), sub: `${cur.byStatus.completed || 0} completed · ${cur.pendingCount} pending · ${cur.byStatus.cancelled || 0} cancelled`, extra: cur.count ? `${(cur.completionRate * 100).toFixed(1)}% completed` : '', delta: [cur.count, prev?.count], spark: spark('orders') },
    { id: 'aov', label: 'Avg order value', icon: Gauge, tint: 'text-amber-300 bg-amber-400/15', color: '#fbbf24', value: peso(cur.aov), sub: 'Per completed order', delta: [cur.aov, prev?.aov], spark: spark('net') },
    { id: 'disc', label: 'Discounts given', icon: Tag, tint: 'text-fuchsia-300 bg-fuchsia-400/15', color: '#e879f9', value: peso(cur.discounts.total), sub: `${peso(cur.discounts.voucher)} voucher · ${peso(cur.discounts.manual)} customer · ${peso(cur.discounts.pwd)} PWD`, extra: cur.discounts.total ? `${(cur.discountPct * 100).toFixed(1)}% of sales` : '', delta: [cur.discounts.total, prev?.discounts.total], goodWhenUp: false, spark: spark('net') },
    { id: 'bowls', label: 'Bowls sold', icon: UtensilsCrossed, tint: 'text-violet-300 bg-violet-400/15', color: '#a78bfa', value: String(cur.bowls), sub: 'Items on completed orders', delta: [cur.bowls, prev?.bowls], spark: spark('bowls') },
    { id: 'repeat', label: 'Repeat customers', icon: Repeat2, tint: 'text-blue-300 bg-blue-400/15', color: '#60a5fa', value: cur.repeat.customers ? `${Math.round(cur.repeat.rate * 100)}%` : '–', sub: cur.repeat.customers ? `${cur.repeat.repeaters} of ${cur.repeat.customers} registered customers` : 'No registered customers ordered', delta: [cur.repeat.rate, prev?.repeat.customers ? prev.repeat.rate : null], spark: null },
    { id: 'pending', label: 'Pending value', icon: Hourglass, tint: 'text-amber-300 bg-amber-400/15', color: '#fbbf24', value: peso(cur.pendingValue), sub: `${cur.pendingCount} ${cur.pendingCount === 1 ? 'order' : 'orders'} waiting, not in net sales`, delta: [cur.pendingValue, prev?.pendingValue], spark: null },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={c.id} className="animate-fade-up flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-100/70"><span className={`flex size-7 items-center justify-center rounded-lg ${c.tint}`}><Icon className="size-4" /></span>{c.label}</span>
              <Delta cur={c.delta[0]} prev={c.delta[1]} goodWhenUp={c.goodWhenUp !== false} />
            </div>
            <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-white sm:text-[1.7rem]">{c.value}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-emerald-100/60">{c.sub}</p>
            {c.extra && <p className="text-[11px] font-bold text-lime-300">{c.extra}</p>}
            {c.spark && <div className="mt-2"><Sparkline values={c.spark} color={c.color} /></div>}
          </div>
        );
      })}
    </div>
  );
}
