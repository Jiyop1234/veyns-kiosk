// VEYNS Admin: the five stat cards of the Menu Manager (Step B7).
// Every number comes from the menu list and the orders the dashboard already loaded. The chart on the Best Seller card
// shows the units sold per day over the last 14 days; the other cards have no chart because they have no history to draw.
import React from 'react';
import { Utensils, Eye, Tag, Star } from 'lucide-react';
import { formatPeso } from '@/lib/menu-data';
import { dailySeries } from '@/components/admin/menu-manager/admin-menu-sales';

const effectivePrice = (m: any) => Number(m.price || 0) * (1 - Number(m.discountPercent || 0) / 100);

function Sparkline({ values }: { values: number[] }) {
  const w = 96;
  const h = 32;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 3 - (v / max) * (h - 8)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="hidden h-8 w-24 shrink-0 sm:block" role="img" aria-label="Units sold per day, last 14 days">
      <title>Units sold per day, last 14 days</title>
      <polyline points={pts} fill="none" stroke="#a3e635" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({ icon, label, children, aside }: { icon: React.ReactNode; label: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/[0.04] p-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-lime-300">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-zinc-300">{label}</p>
        {children}
      </div>
      {aside}
    </div>
  );
}

export function AdminMenuStatCards({ menuItems, sales }: any) {
  const items: any[] = menuItems || [];
  const total = items.length;
  const extras = items.filter((m) => m.isExtra).length;
  const main = total - extras;
  const available = items.filter((m) => m.isAvailable !== false).length;
  const hidden = total - available;
  const discounted = items.filter((m) => Number(m.discountPercent || 0) > 0);
  const avgOff = discounted.length > 0
    ? discounted.reduce((s, m) => s + Number(m.price || 0) * Number(m.discountPercent || 0) / 100, 0) / discounted.length
    : 0;
  let top: any = null;
  items.forEach((m) => {
    const q = sales.monthQty[String(m.id)] || 0;
    if (q > 0 && (!top || q > top.q)) top = { item: m, q };
  });
  const mainItems = items.filter((m) => !m.isExtra);
  const avgPrice = mainItems.length > 0 ? mainItems.reduce((s, m) => s + effectivePrice(m), 0) / mainItems.length : 0;

  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-5">
      <StatCard icon={<Utensils className="h-5 w-5" />} label="Total items">
        <p className="font-display text-2xl font-extrabold leading-tight text-white">{total}</p>
        <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
          <div className="h-full bg-lime-400" style={{ width: `${total ? (main / total) * 100 : 0}%` }} />
        </div>
        <p className="mt-1 truncate text-[10px] text-zinc-400">Main {main} • Extras {extras}</p>
      </StatCard>
      <StatCard icon={<Eye className="h-5 w-5" />} label="Available now">
        <p className="font-display text-2xl font-extrabold leading-tight text-white">{available}</p>
        <p className="truncate text-[10px] text-zinc-400">{hidden} hidden</p>
      </StatCard>
      <StatCard icon={<Tag className="h-5 w-5" />} label="On discount">
        <p className="font-display text-2xl font-extrabold leading-tight text-white">{discounted.length}</p>
        <p className="truncate text-[10px] text-zinc-400">{discounted.length > 0 ? `Avg. ${formatPeso(avgOff)} off` : 'No discounts set'}</p>
      </StatCard>
      <StatCard icon={<Star className="h-5 w-5" />} label="Best seller this month" aside={top ? <Sparkline values={dailySeries(sales, String(top.item.id), 14)} /> : null}>
        <p className="truncate font-display text-lg font-extrabold leading-tight text-white" title={top ? top.item.name : ''}>{top ? top.item.name : 'No sales yet'}</p>
        <p className="truncate text-[10px] text-zinc-400">{top ? `${top.q} sold` : 'Counts orders that are not cancelled'}</p>
      </StatCard>
      <StatCard icon={<span className="text-base font-extrabold">₱</span>} label="Average price">
        <p className="font-display text-2xl font-extrabold leading-tight text-white">{formatPeso(avgPrice)}</p>
        <p className="truncate text-[10px] text-zinc-400">Main menu, after discounts</p>
      </StatCard>
    </div>
  );
}
