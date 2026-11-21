// VEYNS Admin Vouchers: the four stat cards on top of the screen (Step B6). Display only.
import React from 'react';
import { Award, DollarSign, ShoppingBag, Ticket } from 'lucide-react';
import { formatPeso } from '@/lib/menu-data';

function StatCard({ icon, value, label, note }: { icon: React.ReactNode; value: string; label: string; note?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/[0.04] p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-lime-400">{icon}</span>
      <div className="min-w-0">
        <p className="truncate font-display text-xl font-extrabold leading-tight text-white">{value}</p>
        <p className="truncate text-[11px] font-bold text-zinc-300">{label}</p>
        {note ? <p className="truncate text-[10px] text-zinc-500">{note}</p> : null}
      </div>
    </div>
  );
}

export function AdminVoucherStatCards({ activeCount, redemptions, discounts, top }: { activeCount: number; redemptions: number; discounts: { food: number; delivery: number; total: number }; top: any | null }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard icon={<Ticket className="h-5 w-5" />} value={String(activeCount)} label="Active vouchers" note="Working right now" />
      <StatCard icon={<ShoppingBag className="h-5 w-5" />} value={String(redemptions)} label="Total redemptions" note="All vouchers" />
      <StatCard icon={<DollarSign className="h-5 w-5" />} value={formatPeso(discounts.total)} label="Total discounts given" note={`${formatPeso(discounts.food)} food | ${formatPeso(discounts.delivery)} delivery`} />
      <StatCard icon={<Award className="h-5 w-5" />} value={top ? top.code : 'None yet'} label="Top performing" note={top ? `${top.usageCount} redemptions` : 'No redemptions yet'} />
    </div>
  );
}
