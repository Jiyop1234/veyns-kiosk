// @ts-nocheck
// Estimated Delivery Fee card: the fee of the simulated pin under the draft rule, with the working shown line by line.
// Step B11a: new file.
import { CheckCircle2, AlertTriangle, XCircle, MapPin } from 'lucide-react';
import { formatPeso, formatKm } from '@/components/admin/delivery-fees/admin-delivery-fee-math';

const ZONE_BADGE = {
  free: { label: 'FREE', cls: 'bg-lime-400 text-black' },
  base: { label: 'BASE', cls: 'bg-amber-400 text-black' },
  perkm: { label: 'PER KM', cls: 'bg-sky-400 text-black' },
};

function Line({ label, value, strong }: any) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? 'border-t border-white/10 pt-1.5 font-extrabold text-white' : 'text-white/70'}`}>
      <span>{label}</span>
      <span className={strong ? 'text-lime-400' : 'font-semibold text-white'}>{value}</span>
    </div>
  );
}

export function AdminDeliveryFeeEstimate({ rule, result, liveResult, pin, subtotal }: any) {
  const badge = ZONE_BADGE[result.zone];
  const rejected = result.rejected;
  const differsFromLive = liveResult.fee !== result.fee;
  const status = rejected === 'radius'
    ? { cls: 'bg-red-500/15 text-red-300', icon: XCircle, text: `Beyond the ${rule.maxRadiusKm} km maximum radius` }
    : rejected === 'minimum'
      ? { cls: 'bg-amber-400/15 text-amber-300', icon: AlertTriangle, text: `Order is below the ${formatPeso(rule.minOrderAmount)} minimum` }
      : { cls: 'bg-lime-400/15 text-lime-300', icon: CheckCircle2, text: 'Within delivery range' };
  const StatusIcon = status.icon;

  return (
    <div className="shrink-0 rounded-3xl bg-white/[0.04] p-4">
      <h2 className="font-display text-base font-extrabold text-white">Estimated delivery fee</h2>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="font-display text-5xl font-extrabold leading-none text-lime-400">{result.fee === null ? '—' : formatPeso(result.fee)}</p>
        <span className={`rounded-xl px-3 py-1 text-xs font-extrabold ${badge.cls}`}>{badge.label}</span>
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-white">
        <MapPin className="size-4 text-lime-400" /> {formatKm(result.rawKm)}
        {differsFromLive && result.fee !== null && liveResult.fee !== null ? <span className="ml-auto text-xs font-normal text-white/50">Live rule: {formatPeso(liveResult.fee)}</span> : null}
      </p>

      <div className="mt-2.5 space-y-1 rounded-2xl bg-white/[0.06] px-3 py-2.5 text-xs">
        {result.km !== result.rawKm ? <Line label="Distance counted as" value={formatKm(result.km)} /> : null}
        {result.zone === 'free'
          ? <Line label={`Free zone (under ${rule.freeKm} km)`} value="₱0" />
          : <Line label="Base fare" value={formatPeso(result.baseFare)} />}
        {result.extraKm > 0 ? <Line label={`Extra ${result.extraKm} km × ${formatPeso(rule.perKmRate)}`} value={formatPeso(result.extraFee)} /> : null}
        {result.surcharge > 0 ? <Line label="Peak / weather surcharge" value={`+${formatPeso(result.surcharge)}`} /> : null}
        {result.roundingAdj !== 0 ? <Line label={`Rounded up to ${formatPeso(rule.feeStep)}`} value={`+${formatPeso(result.roundingAdj)}`} /> : null}
        {result.capAdj !== 0 ? <Line label={`Fee cap ${formatPeso(rule.capAmount)}`} value={`−${formatPeso(Math.abs(result.capAdj))}`} /> : null}
        <Line strong label="Delivery fee" value={result.fee === null ? 'Not delivered' : formatPeso(result.fee)} />
      </div>

      <div className={`mt-2.5 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold ${status.cls}`}>
        <StatusIcon className="size-4 shrink-0" /> {status.text}
      </div>
      <p className="mt-1.5 text-center text-[10px] text-white/40">Pin {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)} · order {formatPeso(subtotal)}</p>
    </div>
  );
}
