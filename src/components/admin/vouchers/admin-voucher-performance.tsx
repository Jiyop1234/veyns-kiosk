// VEYNS Admin Vouchers: money given away per day for the last 30 days, as a plain SVG line (Step B6). Display only, no chart library.
import React from 'react';
import { BarChart2 } from 'lucide-react';
import { formatPeso } from '@/lib/menu-data';

export function AdminVoucherPerformance({ series, className = '' }: { series: { key: string; value: number }[]; className?: string }) {
  const total = series.reduce((sum, d) => sum + d.value, 0);
  const max = Math.max(1, ...series.map((d) => d.value));
  const step = series.length > 1 ? 100 / (series.length - 1) : 0;
  const points = series.map((d, i) => `${(i * step).toFixed(2)},${(36 - (d.value / max) * 32).toFixed(2)}`).join(' ');
  const empty = total === 0;
  const fmt = (k: string) => { const [, m, d] = k.split('-'); return `${Number(m)}/${Number(d)}`; };

  return (
    <div className={`flex min-h-0 flex-col gap-2 rounded-2xl bg-white/[0.04] p-4 ${className}`}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-white"><BarChart2 className="h-4 w-4 text-lime-400" /> Voucher performance</h2>
        <span className="text-[11px] font-bold text-zinc-400">Last 30 days</span>
      </div>
      <p className="shrink-0 text-xs text-zinc-300"><span className="font-display text-lg font-extrabold text-lime-400">{formatPeso(total)}</span> discounts given</p>
      <div className="relative min-h-[64px] flex-1">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Discounts given per day, last 30 days">
          <line x1="0" y1="36" x2="100" y2="36" stroke="rgba(255,255,255,0.12)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {!empty && <polyline points={points} fill="none" stroke="#a3e635" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        </svg>
        {empty && <p className="absolute inset-0 flex items-center justify-center text-[11px] text-zinc-500">No discounts were given in the last 30 days.</p>}
        {!empty && <span className="absolute right-0 top-0 text-[10px] font-bold text-zinc-500">peak {formatPeso(max)}/day</span>}
      </div>
      <div className="flex shrink-0 justify-between text-[10px] text-zinc-500"><span>{series[0] ? fmt(series[0].key) : ''}</span><span>{series[series.length - 1] ? fmt(series[series.length - 1].key) : ''}</span></div>
    </div>
  );
}
