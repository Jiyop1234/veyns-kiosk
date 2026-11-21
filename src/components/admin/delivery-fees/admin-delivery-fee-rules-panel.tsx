// @ts-nocheck
// Fare Rules panel of the Delivery Fee screen: the four rules the database applies today, and extra draft options.
// Step B11a: new file. Nothing here is saved or published; the draft only drives this screen (map, estimate, curve, impact).
import { SlidersHorizontal } from 'lucide-react';
import { FeeRuleSlider, FeeSegmented, FeeSwitch, FeeNumberBox } from '@/components/admin/delivery-fees/admin-delivery-fee-controls';
import { RULE_LIMITS, LIVE_RULE } from '@/components/admin/delivery-fees/admin-delivery-fee-math';

function ToggleRow({ label, hint, on, onToggle, children }: any) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        {hint ? <p className="text-[10px] text-white/40">{hint}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {on ? children : null}
        <FeeSwitch on={on} onToggle={onToggle} label={label} />
      </div>
    </div>
  );
}

export function AdminDeliveryFeeRulesPanel({ rule, differs, onChange }: any) {
  const L = RULE_LIMITS;
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-3xl bg-white/[0.04] p-4">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-white"><SlidersHorizontal className="size-5 text-lime-400" /> Fare rules</h2>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${differs ? 'bg-amber-400/15 text-amber-300' : 'bg-lime-400/15 text-lime-300'}`}>
          <span className={`size-1.5 rounded-full ${differs ? 'bg-amber-400' : 'bg-lime-400'}`} /> {differs ? 'Draft, not published' : 'Same as live rule'}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto pr-1">
        <p className="text-[11px] text-white/50">Rules the database applies today. Changing them here only changes this screen.</p>
        <FeeRuleSlider label="Free radius" value={rule.freeKm} liveValue={LIVE_RULE.freeKm} min={L.freeKm.min} max={L.freeKm.max} step={L.freeKm.step} suffix="km" onChange={(v: number) => onChange({ freeKm: v })} />
        <FeeRuleSlider label="Base fare" value={rule.baseFare} liveValue={LIVE_RULE.baseFare} min={L.baseFare.min} max={L.baseFare.max} step={L.baseFare.step} prefix="₱" onChange={(v: number) => onChange({ baseFare: v })} />
        <FeeRuleSlider label="Base band upper limit" value={rule.baseUpperKm} liveValue={LIVE_RULE.baseUpperKm} min={Math.max(L.baseUpperKm.min, rule.freeKm)} max={L.baseUpperKm.max} step={L.baseUpperKm.step} suffix="km" onChange={(v: number) => onChange({ baseUpperKm: v })} />
        <FeeRuleSlider label="Per extra km" value={rule.perKmRate} liveValue={LIVE_RULE.perKmRate} min={L.perKmRate.min} max={L.perKmRate.max} step={L.perKmRate.step} prefix="₱" onChange={(v: number) => onChange({ perKmRate: v })} />

        <div className="border-t border-white/10 pt-3">
          <p className="mb-2 text-[11px] text-white/50">Extra options. The database does not have these yet, so they only exist in this draft.</p>
          <div className="space-y-3.5">
            <div>
              <p className="mb-1.5 text-sm font-semibold text-white">Round distance up to</p>
              <FeeSegmented label="Round distance up to" value={rule.distanceStep} onChange={(v: number) => onChange({ distanceStep: v })} options={[{ value: 0, label: 'Exact' }, { value: 0.5, label: '0.5 km' }, { value: 1, label: '1 km' }]} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-white">Round fee up to</p>
              <FeeSegmented label="Round fee up to" value={rule.feeStep} onChange={(v: number) => onChange({ feeStep: v })} options={[{ value: 0, label: 'Exact' }, { value: 1, label: '₱1' }, { value: 5, label: '₱5' }, { value: 10, label: '₱10' }]} />
            </div>
            <ToggleRow label="Maximum delivery radius" hint="No delivery beyond it" on={rule.maxRadiusOn} onToggle={() => onChange({ maxRadiusOn: !rule.maxRadiusOn })}>
              <FeeNumberBox value={rule.maxRadiusKm} onChange={(v: number) => onChange({ maxRadiusKm: v })} min={L.maxRadiusKm.min} max={L.maxRadiusKm.max} step={L.maxRadiusKm.step} suffix="km" label="Maximum delivery radius" width="w-24" />
            </ToggleRow>
            <ToggleRow label="Fee cap" hint="The fee never goes above it" on={rule.capOn} onToggle={() => onChange({ capOn: !rule.capOn })}>
              <FeeNumberBox value={rule.capAmount} onChange={(v: number) => onChange({ capAmount: v })} min={L.capAmount.min} max={L.capAmount.max} step={L.capAmount.step} prefix="₱" label="Fee cap" width="w-24" />
            </ToggleRow>
            <ToggleRow label="Minimum order for delivery" hint="Smaller orders cannot be delivered" on={rule.minOrderOn} onToggle={() => onChange({ minOrderOn: !rule.minOrderOn })}>
              <FeeNumberBox value={rule.minOrderAmount} onChange={(v: number) => onChange({ minOrderAmount: v })} min={L.minOrderAmount.min} max={L.minOrderAmount.max} step={L.minOrderAmount.step} prefix="₱" label="Minimum order for delivery" width="w-24" />
            </ToggleRow>
            <ToggleRow label="Peak / weather surcharge" hint="Added to deliveries that already have a fee" on={rule.surchargeOn} onToggle={() => onChange({ surchargeOn: !rule.surchargeOn })}>
              <FeeNumberBox value={rule.surchargeAmount} onChange={(v: number) => onChange({ surchargeAmount: v })} min={L.surchargeAmount.min} max={L.surchargeAmount.max} step={L.surchargeAmount.step} prefix="+₱" label="Peak surcharge" width="w-24" />
            </ToggleRow>
          </div>
        </div>
      </div>
    </div>
  );
}
