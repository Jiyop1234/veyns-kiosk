// VEYNS Admin, Inventory: the five stat cards with a small 7-day chart each (Steps B12 and B12b).
// The six earlier points of each chart are sample data; the last point is the live number.
import type { ReactNode } from 'react';
import { AlertTriangle, Ban, Coins, Percent, UtensilsCrossed } from 'lucide-react';
import { peso } from './admin-inventory-calc';
import { SAMPLE_HISTORY } from './admin-inventory-sample';
import type { InventoryStats } from './admin-inventory-types';

function Spark({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return null;
  const w = 80, h = 32;
  const max = Math.max(...values), min = Math.min(...values), span = max - min;
  const pts = values.map((v, i): [number, number] => [(i / (values.length - 1)) * w, span === 0 ? h / 2 : h - 3 - ((v - min) / span) * (h - 8)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="hidden h-8 w-20 shrink-0 sm:block" aria-hidden="true">
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={stroke} fillOpacity="0.15" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({ icon, iconCls, label, value, values, stroke }: { icon: ReactNode; iconCls: string; label: string; value: string; values: number[]; stroke: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconCls}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl font-extrabold leading-tight text-white">{value}</p>
        <p className="truncate text-[11px] text-zinc-300">{label}</p>
      </div>
      <Spark values={values} stroke={stroke} />
    </div>
  );
}

export function AdminInventoryStatCards({ stats }: { stats: InventoryStats }) {
  const h = SAMPLE_HISTORY;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatCard icon={<Coins className="h-5 w-5" />} iconCls="bg-lime-400/15 text-lime-300" label="Total Stock Value" value={peso(stats.totalValue)} values={[...h.value, stats.totalValue]} stroke="#a3e635" />
      <StatCard icon={<AlertTriangle className="h-5 w-5" />} iconCls="bg-amber-400/15 text-amber-300" label="Ingredients Below Par" value={String(stats.belowPar)} values={[...h.belowPar, stats.belowPar]} stroke="#fbbf24" />
      <StatCard icon={<Ban className="h-5 w-5" />} iconCls="bg-red-400/15 text-red-300" label="Out of Stock" value={String(stats.out)} values={[...h.out, stats.out]} stroke="#f87171" />
      <StatCard icon={<UtensilsCrossed className="h-5 w-5" />} iconCls="bg-emerald-400/15 text-emerald-300" label={`Recipes Cookable Now (of ${stats.dishCount})`} value={String(stats.cookable)} values={[...h.cookable, stats.cookable]} stroke="#34d399" />
      <StatCard icon={<Percent className="h-5 w-5" />} iconCls="bg-sky-400/15 text-sky-300" label="Avg Food Cost" value={`${stats.avgFoodCostPct.toFixed(1)}%`} values={[...h.foodCost, Number(stats.avgFoodCostPct.toFixed(1))]} stroke="#38bdf8" />
    </div>
  );
}
