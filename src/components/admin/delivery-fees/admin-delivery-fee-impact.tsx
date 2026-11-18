// @ts-nocheck
// Impact Preview of the Delivery Fee screen: what the draft rule would have changed on the real delivery orders of the last 30 days.
// Step B11a: new file. The orders are read-only; nothing is changed.
import { BarChart3 } from 'lucide-react';
import { formatPeso } from '@/components/admin/delivery-fees/admin-delivery-fee-math';

function Tile({ label, value, sub, tone }: any) {
  const color = tone === 'up' ? 'text-lime-400' : tone === 'down' ? 'text-red-400' : 'text-white';
  return (
    <div className="rounded-2xl bg-white/[0.06] px-3 py-2">
      <p className="text-[11px] text-white/50">{label}</p>
      <p className={`text-xl font-extrabold leading-tight ${color}`}>{value}</p>
      <p className="truncate text-[10px] text-white/40">{sub}</p>
    </div>
  );
}

export function AdminDeliveryFeeImpact({ analysis }: any) {
  const a = analysis;
  const none = a.analyzed === 0;
  const delta = a.revenueDelta;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const pct = a.revenueDeltaPct;
  return (
    <div className="shrink-0 rounded-3xl bg-white/[0.04] p-4">
      <h2 className="mb-2 flex items-center gap-2 font-display text-base font-extrabold text-white"><BarChart3 className="size-5 text-lime-400" /> Impact preview</h2>
      <div className="grid grid-cols-2 gap-2">
        <Tile
          label="Revenue change"
          value={none ? '—' : `${sign}${formatPeso(Math.abs(delta))}`}
          sub={none ? '' : `${pct === null ? 'live rule had no fees' : `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(1)}%`} · ${formatPeso(a.draftRevenue)} total`}
          tone={none ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : ''}
        />
        <Tile label="Free deliveries" value={none ? '—' : `${a.draftFreePct.toFixed(0)}%`} sub={none ? '' : `${a.draftFree} orders · live ${a.liveFreePct.toFixed(0)}%`} />
        <Tile label="Not delivered" value={none ? '—' : String(a.rejected)} sub={none ? '' : `${a.rejectedPct.toFixed(1)}% of orders`} tone={a.rejected > 0 ? 'down' : ''} />
        <Tile label="Average fee" value={none ? '—' : formatPeso(Number(a.draftAvg.toFixed(2)))} sub={none ? '' : `live ${formatPeso(Number(a.liveAvg.toFixed(2)))}`} />
      </div>
      <p className="mt-1.5 text-[10px] text-white/40">
        {none
          ? `No delivery orders with a map pin in the last ${a.windowDays} days.`
          : `${a.analyzed} delivery orders of the last ${a.windowDays} days with a map pin${a.withoutPin > 0 ? ` (${a.withoutPin} without a pin skipped)` : ''}. Compared with the live rule.`}
      </p>
    </div>
  );
}
