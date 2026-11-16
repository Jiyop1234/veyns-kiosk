// @ts-nocheck
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { todayManila } from '@/components/admin/admin-slot-times';

// Step A8b: Reschedule dialog moved unchanged from employee-dashboard.tsx; state, handlers and slotAvailability stay in the dashboard until A8c.
export function AdminOrderRescheduleDialog({
  rescheduleOrder,
  setRescheduleOrder,
  rescheduleDate,
  setRescheduleDate,
  rescheduleSlot,
  setRescheduleSlot,
  timeSlotsList,
  slotAvailability,
  busyOrderId,
  handleConfirmReschedule
}: any) {
  // Reschedule modal
  return (
    <Dialog open={!!rescheduleOrder} onOpenChange={(open) => !open && setRescheduleOrder(null)}>
      {rescheduleOrder && (
        <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl">
          <div className="space-y-1 border-b border-emerald-900/60 pb-3">
            <DialogTitle className="font-display text-lg font-extrabold text-white">Reschedule {rescheduleOrder.orderNumber}</DialogTitle>
            <DialogDescription className="text-xs text-emerald-300">
              Current slot: {rescheduleOrder.slotDate ? `${rescheduleOrder.slotDate} (${rescheduleOrder.slotTime})` : 'unknown'}. Past and fully booked slots cannot be chosen.
            </DialogDescription>
          </div>
          <div className="my-3 space-y-3 text-xs">
            <div>
              <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">New Date</label>
              <input type="date" min={todayManila()} value={rescheduleDate}
                onChange={(e) => {
                  const d = e.target.value; if (!d) return;
                  setRescheduleDate(d);
                  const next = timeSlotsList.find((s) => !slotAvailability(d, s, rescheduleOrder).disabled);
                  setRescheduleSlot(next || '');
                }}
                className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-lime-400 uppercase tracking-wider block">New Time Slot</label>
              <div className="grid grid-cols-2 gap-2">
                {timeSlotsList.map((slot) => {
                  const a = slotAvailability(rescheduleDate, slot, rescheduleOrder);
                  return (
                    <button key={slot} type="button" disabled={a.disabled} onClick={() => setRescheduleSlot(slot)}
                      className={`p-2 rounded-lg border text-[11px] font-bold flex flex-col items-center transition-all ${
                        a.disabled ? 'bg-red-950/50 border-red-900 text-red-400 opacity-60 cursor-not-allowed'
                        : rescheduleSlot === slot ? 'bg-lime-400 text-black border-lime-400 shadow-md'
                        : 'bg-[#041913] text-emerald-300 border-emerald-800/60 hover:border-lime-400/50 cursor-pointer'}`}>
                      <span>{slot}</span>
                      <span className="text-[9px] font-semibold mt-0.5">{a.same ? 'Current slot' : a.ended ? '⏰ Past' : a.full ? '⛔ Fully Booked' : `🟢 ${a.left} bowls left`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
            <Button onClick={() => setRescheduleOrder(null)} className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</Button>
            <Button disabled={!rescheduleSlot || busyOrderId === rescheduleOrder.id} onClick={handleConfirmReschedule}
              className="flex-1 bg-lime-400 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed">
              {busyOrderId === rescheduleOrder.id ? 'Moving…' : 'Confirm Reschedule'}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
