// VEYNS Admin, Inventory: the five stat cards (Steps B12, B12b, 6C-3). Live numbers only: the database keeps no daily history, so no chart is drawn.
import type { ReactNode } from 'react';
import { AlertTriangle, Ban, Coins, Percent, UtensilsCrossed } from 'lucide-react';
import { peso } from './admin-inventory-calc';
import type { InventoryStats } from './admin-inventory-types';

function StatCard({ icon, iconCls, label, value }: { icon: ReactNode; iconCls: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconCls}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl font-extrabold leading-tight text-white">{value}</p>
        <p className="truncate text-[11px] text-zinc-300">{label}</p>
      </div>
    </div>
  );
}

export function AdminInventoryStatCards({ stats }: { stats: InventoryStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatCard icon={<Coins className="h-5 w-5" />} iconCls="bg-lime-400/15 text-lime-300" label="Total Stock Value" value={peso(stats.totalValue)} />
      <StatCard icon={<AlertTriangle className="h-5 w-5" />} iconCls="bg-amber-400/15 text-amber-300" label="Ingredients Below Par" value={String(stats.belowPar)} />
      <StatCard icon={<Ban className="h-5 w-5" />} iconCls="bg-red-400/15 text-red-300" label="Out of Stock" value={String(stats.out)} />
      <StatCard icon={<UtensilsCrossed className="h-5 w-5" />} iconCls="bg-emerald-400/15 text-emerald-300" label={`Recipes Cookable Now (of ${stats.dishCount})`} value={String(stats.cookable)} />
      <StatCard icon={<Percent className="h-5 w-5" />} iconCls="bg-sky-400/15 text-sky-300" label="Avg Food Cost" value={`${stats.avgFoodCostPct.toFixed(1)}%`} />
    </div>
  );
}
