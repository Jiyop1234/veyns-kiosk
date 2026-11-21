// @ts-nocheck
// Step B9: hand-drawn SVG charts for Sales Analytics (no chart library): sparkline, donut and the Revenue Pulse bar chart.
import React, { useState } from 'react';

export const PALETTE = ['#a3e635', '#34d399', '#38bdf8', '#fbbf24', '#e879f9', '#a78bfa', '#60a5fa', '#f87171'];

export const peso = (n: number) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(n * 10) / 10));
const dayLabel = (ms: number, size: number) => {
  const d = new Date(ms + 8 * 3600000);
  const base = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return size > 1 ? `Week of ${base}` : base;
};

export function Sparkline({ values, color = '#a3e635', className = 'h-8 w-full' }: { values: number[]; color?: string; className?: string }) {
  const w = 100, h = 32;
  const max = Math.max(...values, 0);
  if (values.length < 2 || max <= 0) return <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true"><line x1="0" y1={h - 1} x2={w} y2={h - 1} stroke={color} strokeOpacity="0.25" strokeWidth="1" /></svg>;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - (v / max) * (h - 6)]);
  const line = pts.map((p) => p.join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={color} fillOpacity="0.12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Donut({ parts, empty = 'No data in this view', centerLabel, centerValue }: { parts: { label: string; value: number; color?: string }[]; empty?: string; centerLabel?: string; centerValue?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 40, c = 2 * Math.PI * r;
  let acc = 0;
  if (total <= 0) return <p className="py-8 text-center text-xs text-emerald-100/50">{empty}</p>;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 100 100" className="size-32 shrink-0 -rotate-90" role="img" aria-label="Share chart">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
        {parts.map((p, i) => {
          const len = (p.value / total) * c;
          const el = <circle key={p.label} cx="50" cy="50" r={r} fill="none" stroke={p.color || PALETTE[i % PALETTE.length]} strokeWidth="14" strokeDasharray={`${Math.max(len - 0.8, 0)} ${c}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
        {centerValue && (
          <g transform="rotate(90 50 50)">
            <text x="50" y="49" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">{centerValue}</text>
            {centerLabel && <text x="50" y="60" textAnchor="middle" fontSize="6" fill="#93a89b">{centerLabel}</text>}
          </g>
        )}
      </svg>
      <ul className="min-w-[8rem] flex-1 space-y-1.5 text-xs">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color || PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate text-emerald-100/80">{p.label}</span>
            <span className="font-bold tabular-nums text-white">{peso(p.value)}</span>
            <span className="w-10 text-right tabular-nums text-emerald-100/60">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const METRICS = [{ id: 'revenue', label: 'Revenue' }, { id: 'orders', label: 'Orders' }, { id: 'bowls', label: 'Bowls' }, { id: 'aov', label: 'AOV' }];

export function RevenuePulse({ series, prevSeries, metric, onMetric }: { series: any[]; prevSeries: any[] | null; metric: string; onMetric: (m: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const isMoney = metric === 'revenue' || metric === 'aov';
  const fmtV = (v: number) => (isMoney ? peso(v) : String(Math.round(v * 10) / 10));
  const W = 640, H = 230, L = 40, R = 8, T = 12, B = 30;
  const n = series.length;
  const maxData = Math.max(1, ...series.map((s) => s.value), ...(prevSeries || []).map((s) => s.value));
  const step = maxData <= 10 ? Math.ceil(maxData / 4) || 1 : Math.pow(10, Math.floor(Math.log10(maxData / 4)));
  const niceStep = [1, 2, 2.5, 5, 10].map((k) => k * step).find((s) => s * 4 >= maxData) || step * 10;
  const max = niceStep * 4;
  const bw = (W - L - R) / n;
  const x = (i) => L + i * bw;
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const total = series.reduce((s, x2) => s + x2.value, 0);
  const labelEvery = Math.max(1, Math.ceil(n / 8));
  const hv = hover !== null ? series[hover] : null;
  const hp = hover !== null && prevSeries ? prevSeries[hover] : null;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Chart metric" className="flex gap-1 rounded-full bg-white/[0.05] p-1">
          {METRICS.map((m) => (
            <button key={m.id} role="tab" aria-selected={metric === m.id} type="button" onClick={() => onMetric(m.id)} className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400 ${metric === m.id ? 'bg-lime-400 text-black' : 'text-emerald-100/70 hover:text-white'}`}>{m.label}</button>
          ))}
        </div>
        <p className="text-[11px] text-emerald-100/60">{metric === 'aov' ? 'Average per completed order' : <>Total <span className="font-bold text-white">{fmtV(total)}</span></>}{series[0]?.size > 1 ? ' · weekly' : ' · daily'}</p>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-label={`${METRICS.find((m) => m.id === metric).label} over time`} onMouseLeave={() => setHover(null)}>
          {[0, 1, 2, 3, 4].map((k) => (
            <g key={k}>
              <line x1={L} x2={W - R} y1={y(k * niceStep)} y2={y(k * niceStep)} stroke="rgba(255,255,255,0.07)" />
              <text x={L - 6} y={y(k * niceStep) + 3} textAnchor="end" fontSize="9" fill="#93a89b">{isMoney ? '₱' + compact(k * niceStep) : compact(k * niceStep)}</text>
            </g>
          ))}
          {series.map((s, i) => (
            <g key={s.startMs}>
              <rect x={x(i) + bw * 0.15} width={Math.max(bw * 0.7, 1)} y={y(s.value)} height={Math.max(H - B - y(s.value), s.value > 0 ? 1.5 : 0)} rx="2" fill="#a3e635" fillOpacity={hover === null || hover === i ? 0.95 : 0.35} style={{ transition: 'y 250ms ease-out, height 250ms ease-out, fill-opacity 150ms' }} />
              {s.hasVoucher && <circle cx={x(i) + bw / 2} cy={H - B + 8} r="2.5" fill="#fbbf24"><title>Voucher used</title></circle>}
              {i % labelEvery === 0 && <text x={x(i) + bw / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#93a89b">{new Date(s.startMs + 8 * 3600000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</text>}
              <rect x={x(i)} y={T} width={bw} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} />
            </g>
          ))}
          {prevSeries && prevSeries.length === n && (
            <polyline points={prevSeries.map((s, i) => `${x(i) + bw / 2},${y(s.value)}`).join(' ')} fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray="4 3" strokeLinejoin="round" opacity="0.9" />
          )}
        </svg>
        {hv && (
          <div className="pointer-events-none absolute top-1 z-10 w-44 rounded-xl border border-white/10 bg-[#051813] p-2.5 text-[11px] shadow-xl" style={{ left: `${Math.min(Math.max(((x(hover) + bw / 2) / W) * 100, 14), 86)}%`, transform: 'translateX(-50%)' }}>
            <p className="font-bold text-white">{dayLabel(hv.startMs, hv.size)}</p>
            <p className="mt-1 flex justify-between text-emerald-100/70"><span>{METRICS.find((m) => m.id === metric).label}</span><span className="font-bold tabular-nums text-lime-300">{fmtV(hv.value)}</span></p>
            <p className="flex justify-between text-emerald-100/70"><span>Orders</span><span className="tabular-nums text-white">{hv.orders}</span></p>
            <p className="flex justify-between text-emerald-100/70"><span>Bowls</span><span className="tabular-nums text-white">{hv.bowls}</span></p>
            {hp && <p className="flex justify-between text-sky-300"><span>Previous</span><span className="tabular-nums">{fmtV(hp.value)}</span></p>}
            {hv.hasVoucher && <p className="mt-1 text-amber-300">● Voucher used</p>}
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-emerald-100/60">
        <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-lime-400" />This period</span>
        {prevSeries && <span className="flex items-center gap-1"><span className="h-0 w-4 border-t-2 border-dashed border-sky-400" />Previous period</span>}
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-400" />Voucher used that day</span>
      </div>
    </div>
  );
}
