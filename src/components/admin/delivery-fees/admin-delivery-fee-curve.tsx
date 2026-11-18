// @ts-nocheck
// Fee Curve chart of the Delivery Fee screen: the fee at every distance under the draft rule (and the live rule, dotted, when they differ),
// with the free / base / per-km zones shaded and the simulated pin marked. Plain SVG.
// Step B11a: new file.
import { BarChart3 } from 'lucide-react';
import { buildCurve, formatPeso } from '@/components/admin/delivery-fees/admin-delivery-fee-math';

const W = 600;
const H = 210;
const L = 48;
const R = 590;
const T = 14;
const B = 170;
const ZONE_COLOR = { free: '#a3e635', base: '#fbbf24', perkm: '#38bdf8' };

export function AdminDeliveryFeeCurve({ rule, liveRule, differs, result }: any) {
  const outerKm = rule.maxRadiusOn ? rule.maxRadiusKm : Math.max(6, Math.ceil(rule.baseUpperKm + 4));
  const xMax = Math.max(6, Math.ceil(Math.max(outerKm, Math.min(15, result.rawKm + 0.5))));
  const draft = buildCurve(rule, xMax, xMax > 12 ? 0.05 : 0.02);
  const live = differs ? buildCurve(liveRule, xMax, xMax > 12 ? 0.05 : 0.02) : [];
  const maxFee = Math.max(40, ...draft.map((p) => (p.fee === null ? 0 : p.fee)), ...live.map((p) => (p.fee === null ? 0 : p.fee)));
  const yMax = Math.ceil(maxFee / 20) * 20;
  const x = (km: number) => L + (Math.min(km, xMax) / xMax) * (R - L);
  const y = (fee: number) => B - (fee / yMax) * (B - T);

  // one path per run of the same zone; a new run starts at the previous point so the steps stay joined
  const runs: { zone: string; pts: string[] }[] = [];
  let run: { zone: string; pts: string[] } | null = null;
  draft.forEach((p, i) => {
    if (p.fee === null) { run = null; return; }
    const pt = `${x(p.km).toFixed(1)} ${y(p.fee).toFixed(1)}`;
    if (!run || run.zone !== p.zone) {
      const prev = draft[i - 1];
      run = { zone: p.zone, pts: prev && prev.fee !== null ? [`${x(prev.km).toFixed(1)} ${y(prev.fee).toFixed(1)}`, pt] : [pt] };
      runs.push(run);
    } else {
      run.pts.push(pt);
    }
  });
  const paths = runs.map((r) => ({ zone: r.zone, d: r.pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt}`).join(' ') }));
  const livePath = live.filter((p) => p.fee !== null).map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.km).toFixed(1)} ${y(p.fee as number).toFixed(1)}`).join(' ');

  const radiusEnd = rule.maxRadiusOn ? Math.min(rule.maxRadiusKm, xMax) : xMax;
  const xTicks: number[] = [];
  const tickStep = xMax <= 8 ? 1 : xMax <= 16 ? 2 : 5;
  for (let k = 0; k <= xMax; k += tickStep) xTicks.push(k);
  const yTicks = [0, yMax / 2, yMax];

  const px = x(result.rawKm);
  const markerFee = result.fee;
  const labelRight = px < (L + R) / 2;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-3xl bg-white/[0.04] p-4">
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-white"><BarChart3 className="size-5 text-lime-400" /> Fee curve</h2>
        <span className="text-[11px] text-white/40">{differs ? 'Dotted line: live rule' : 'Fee by distance'}</span>
      </div>
      <div className="min-h-0 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Delivery fee by distance" className="h-full w-full">
          {rule.freeKm > 0 && <rect x={x(0)} y={T} width={x(rule.freeKm) - x(0)} height={B - T} fill={ZONE_COLOR.free} opacity="0.12" />}
          {rule.baseUpperKm > rule.freeKm && <rect x={x(rule.freeKm)} y={T} width={x(rule.baseUpperKm) - x(rule.freeKm)} height={B - T} fill={ZONE_COLOR.base} opacity="0.12" />}
          {radiusEnd > rule.baseUpperKm && <rect x={x(rule.baseUpperKm)} y={T} width={x(radiusEnd) - x(rule.baseUpperKm)} height={B - T} fill={ZONE_COLOR.perkm} opacity="0.09" />}
          {rule.maxRadiusOn && rule.maxRadiusKm < xMax && <rect x={x(rule.maxRadiusKm)} y={T} width={x(xMax) - x(rule.maxRadiusKm)} height={B - T} fill="#ef4444" opacity="0.16" />}

          {yTicks.map((v) => (
            <g key={v}>
              <line x1={L} x2={R} y1={y(v)} y2={y(v)} stroke="#ffffff" strokeOpacity="0.08" />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#ffffff" fillOpacity="0.5">{formatPeso(Math.round(v))}</text>
            </g>
          ))}
          {xTicks.map((k) => (
            <text key={k} x={x(k)} y={B + 18} textAnchor="middle" fontSize="11" fill="#ffffff" fillOpacity="0.5">{k} km</text>
          ))}

          {livePath && <path d={livePath} fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="3 3" />}
          {paths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={ZONE_COLOR[p.zone]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}

          {markerFee === null ? (
            <line x1={px} x2={px} y1={T} y2={B} stroke="#f87171" strokeWidth="1.5" strokeDasharray="4 3" />
          ) : (
            <g>
              <line x1={px} x2={px} y1={y(markerFee)} y2={B} stroke="#ffffff" strokeOpacity="0.3" strokeDasharray="3 3" />
              <circle cx={px} cy={y(markerFee)} r="5" fill="#020b08" stroke="#a3e635" strokeWidth="2.5" />
              <text x={labelRight ? px + 9 : px - 9} y={Math.max(T + 12, y(markerFee) - 9)} textAnchor={labelRight ? 'start' : 'end'} fontSize="12" fontWeight="700" fill="#ffffff">
                {formatPeso(markerFee)} · {Number(result.rawKm.toFixed(1))} km
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
