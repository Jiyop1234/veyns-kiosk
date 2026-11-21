// @ts-nocheck
// Admin slot owners panel: who reserved the chosen time slot on the chosen date, what they ordered, and the Transfer button.
// Step B4: replaces the old "Slot Owners" pop-up. Same data (the reservations the tab loads) and the same Transfer action; it now sits beside the list.
import { Users, X, ArrowRightLeft, ClipboardList, Utensils, Gauge } from 'lucide-react';
import { itemQty, lineItemName } from '@/components/admin/admin-order-items';

const ORDER_STATUS_PILL: Record<string, string> = {
  pending: 'bg-amber-400/15 text-amber-300',
  rescheduled: 'bg-sky-400/15 text-sky-300',
  completed: 'bg-lime-400/15 text-lime-300',
  cancelled: 'bg-red-500/15 text-red-300',
};

function OwnersMini({ icon, value, label }: any) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-lime-400">{icon}<span className="text-lg font-extrabold leading-none text-white">{value}</span></div>
      <p className="mt-1 text-[11px] text-white/50">{label}</p>
    </div>
  );
}

export function AdminSlotCapacityOwnersPanel({ inspectingSlot, reservations, capacity, fit, onClose, onTransfer }: any) {
  // Capacity counts only reservations that are still active; released ones (cancelled orders) are listed but dimmed.
  const activeList = reservations.filter((r: any) => (r.status || 'active') === 'active');
  const orderCount = activeList.length;
  const bowlCount = activeList.reduce((sum: number, r: any) => sum + Number(r.bowls_reserved || 0), 0);

  return (
    <div className={`flex min-h-0 flex-col rounded-3xl bg-white/[0.04] p-4 ${fit ? 'h-full' : ''}`}>
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-white">
            <Users className="size-5 shrink-0 text-lime-400" /> <span className="truncate">Slot owners: {inspectingSlot.slotTime}</span>
          </h3>
          <p className="mt-0.5 text-xs text-white/50">{inspectingSlot.dateKey}</p>
        </div>
        <button type="button" aria-label="Close slot owners" onClick={onClose} className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-white/[0.06] text-white/70 hover:text-white">
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 grid shrink-0 grid-cols-3 gap-2">
        <OwnersMini icon={<ClipboardList className="size-4" />} value={orderCount} label="Orders" />
        <OwnersMini icon={<Utensils className="size-4" />} value={bowlCount} label="Bowls" />
        <OwnersMini icon={<Gauge className="size-4" />} value={capacity} label="Capacity" />
      </div>

      <div className={`mt-3 space-y-2 ${fit ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-[50vh] overflow-y-auto'}`}>
        {reservations.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/50">No reservations found for this time slot.</p>
        ) : (
          reservations.map((res: any) => {
            const released = (res.status || 'active') !== 'active';
            const orderStatus = String(res.orders?.status || '').toLowerCase();
            return (
              <div key={res.id} className={`rounded-2xl bg-white/[0.04] p-3 text-xs ${released ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-white">{res.customer_name}</p>
                    <p className="text-[11px] text-white/50">{res.customer_phone || 'No phone'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-lime-400 px-2.5 py-0.5 text-[11px] font-extrabold text-black">
                      {res.bowls_reserved} {Number(res.bowls_reserved) === 1 ? 'bowl' : 'bowls'}
                    </span>
                    {orderStatus && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${ORDER_STATUS_PILL[orderStatus] || 'bg-white/10 text-white/70'}`}>{orderStatus}</span>
                    )}
                    {released && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">Released</span>}
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  {res.orders?.items?.map((it: any, i: number) => (
                    <div key={i} className="border-l-2 border-lime-400/40 pl-2 text-[11px] text-white/80">
                      <span>{itemQty(it)}x {lineItemName(it)}</span>
                      {it.customizationsSummary && <span className="block text-[10px] text-lime-300">↳ {it.customizationsSummary}</span>}
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onTransfer(res)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-lime-400 hover:bg-lime-400 hover:text-black"
                  >
                    <ArrowRightLeft className="size-3.5" /> Transfer schedule
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3">
        <span className="text-sm font-bold text-white">Total reserved</span>
        <span className="text-xl font-extrabold text-lime-400">{bowlCount} <span className="text-white/40">/ {capacity}</span></span>
      </div>
    </div>
  );
}
