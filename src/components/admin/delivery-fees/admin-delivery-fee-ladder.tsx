// @ts-nocheck
// Rate Ladder of the Delivery Fee screen: one row per distance band under the draft rule, with how many recent orders fall in it and what they would pay.
// Step B11a: new file.
import { formatPeso } from '@/components/admin/delivery-fees/admin-delivery-fee-math';

const DOT = { free: 'bg-lime-400', base: 'bg-amber-400', perkm: 'bg-sky-400' };

export function AdminDeliveryFeeLadder({ rule, analysis }: any) {
  const rows: any[] = [];
  if (rule.freeKm > 0) rows.push({ id: 'free', range: `0 – ${rule.freeKm} km`, formula: 'FREE', stat: analysis.bands.free });
  if (rule.baseUpperKm > rule.freeKm) rows.push({ id: 'base', range: `${rule.freeKm} – ${rule.baseUpperKm} km`, formula: formatPeso(rule.baseFare), stat: analysis.bands.base });
  rows.push({ id: 'perkm', range: `${rule.baseUpperKm}+ km`, formula: `${formatPeso(rule.baseFare)} + ${formatPeso(rule.perKmRate)}/km`, stat: analysis.bands.perkm });

  const extras: string[] = [];
  if (rule.distanceStep > 0) extras.push(`distance rounded up to ${rule.distanceStep} km`);
  if (rule.surchargeOn) extras.push(`+${formatPeso(rule.surchargeAmount)} surcharge`);
  if (rule.feeStep > 0) extras.push(`fee rounded up to ${formatPeso(rule.feeStep)}`);
  if (rule.capOn) extras.push(`capped at ${formatPeso(rule.capAmount)}`);

  return (
    <div className="shrink-0 rounded-3xl bg-white/[0.04] p-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-extrabold text-white">Rate ladder</h2>
        <span className="text-[11px] text-white/40">Orders of the last {analysis.windowDays} days</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead>
            <tr className="text-white/40">
              <th className="py-1 font-semibold">Distance</th>
              <th className="py-1 font-semibold">Fee</th>
              <th className="py-1 text-right font-semibold">Orders</th>
              <th className="py-1 text-right font-semibold">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 text-white">
                <td className="py-1.5"><span className="flex items-center gap-2"><span className={`size-2 rounded-full ${DOT[r.id]}`} />{r.range}</span></td>
                <td className="py-1.5 font-semibold">{r.formula}</td>
                <td className="py-1.5 text-right">{r.stat.orders}</td>
                <td className="py-1.5 text-right font-semibold">{formatPeso(r.stat.revenue)}</td>
              </tr>
            ))}
            {analysis.bands.rejected > 0 && (
              <tr className="border-t border-white/5 text-red-300">
                <td className="py-1.5"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-red-400" />Not delivered</span></td>
                <td className="py-1.5">Radius or minimum order</td>
                <td className="py-1.5 text-right">{analysis.bands.rejected}</td>
                <td className="py-1.5 text-right">—</td>
              </tr>
            )}
            <tr className="border-t border-white/10 font-extrabold text-white">
              <td className="py-1.5" colSpan={2}>Total</td>
              <td className="py-1.5 text-right">{analysis.analyzed}</td>
              <td className="py-1.5 text-right text-lime-400">{formatPeso(analysis.draftRevenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {extras.length > 0 ? <p className="mt-1 text-[10px] text-white/40">Also: {extras.join(', ')}.</p> : null}
    </div>
  );
}
