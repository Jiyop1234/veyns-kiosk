// @ts-nocheck
// Admin Slot Capacity tab: bowl capacity per time window, edit/add/remove time windows, slot owner inspector and transfer dialogs.
// Step A4: moved unchanged from employee-dashboard.tsx (Step A5B: renamed from AdminSlotsTab to match the SLOT CAPACITY nav label). New: this wrapper, its props, and the `active` flag (see below).
// The tab body shows only when `active` is true, but this component stays mounted, so its state (selected date, messages,
// open dialogs) is kept when you switch tabs, exactly like before.
import { useState } from 'react';
import { Clock, Users, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { itemQty, lineItemName } from '@/components/admin/shared/admin-order-items';
import { todayManila, slotHasEnded, to12h, slotTo24 } from '@/components/admin/shared/admin-slot-times';
import { AdminSlotCapacityCard } from '@/components/admin/slot-capacity/admin-slot-capacity-card';

export function AdminSlotCapacityTab({ active, timeSlotsList, slotCapacities, fetchCloudData }: { active: boolean; timeSlotsList: string[]; slotCapacities: any; fetchCloudData: () => void }) {
  // --- Time window manager (Slot Capacity tab) ---
  const [slotEdits, setSlotEdits] = useState<Record<string, { start: string; end: string }>>({});
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('10:00');
  const [slotMgmtBusy, setSlotMgmtBusy] = useState(false);
  const [slotMsg, setSlotMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [selectedSlotDate, setSelectedSlotDate] = useState(new Date().toISOString().split('T')[0]);

  // Slot Owner Inspector Modal State
  const [inspectingSlot, setInspectingSlot] = useState<{ slotTime: string; dateKey: string } | null>(null);
  const [slotReservationsList, setSlotReservationsList] = useState<any[]>([]);
  const [transferringReservation, setTransferringReservation] = useState<any>(null);
  const [transferTargetSlot, setTransferTargetSlot] = useState(timeSlotsList[0]);
  const [transferTargetDate, setTransferTargetDate] = useState<string>(todayManila());

  // --- Save configured capacity (max bowls & max slots) and booking status for a date/time slot ---
  const handleUpdateSlotCapacity = async (dateKey: string, slotTime: string, maxBowls: number, maxSlots: number, isFullyBooked: boolean) => {
    // The database owns booked_bowls / booked_count (derived from real reservations). The browser only sends the
    // cap and the manual "closed" flag, through a staff-only RPC, so a stale screen can never overwrite live counts.
    const { data, error } = await supabase.rpc('admin_set_slot_capacity', {
      p_date_key: dateKey, p_slot_time: slotTime, p_max_bowls: maxBowls, p_max_slots: maxSlots, p_closed: isFullyBooked
    });
    if (error || data?.success === false) {
      alert(error?.message || data?.message || 'Error updating slot capacity.');
      fetchCloudData();
      return;
    }
    alert(`Slot capacity updated successfully for ${slotTime} on ${dateKey}!`);
    fetchCloudData();
  };

  // --- Load Slot Reservations & Owners ---
  const handleInspectSlot = async (slotTime: string, dateKey: string) => {
    setInspectingSlot({ slotTime, dateKey });
    try {
      const { data, error } = await supabase
        .from('slot_reservations')
        .select('*, orders(*)')
        .eq('slot_time', slotTime)
        .eq('date_key', dateKey);
      
      if (data) {
        setSlotReservationsList(data);
      } else {
        setSlotReservationsList([]);
      }
    } catch (e) {
      setSlotReservationsList([]);
    }
  };

  // --- Execute Admin Slot Transfer ---
  const openTransfer = (res: any) => {
    const base = inspectingSlot?.dateKey || selectedSlotDate || todayManila();
    const date = base < todayManila() ? todayManila() : base;
    setTransferTargetDate(date);
    const firstOpen = timeSlotsList.find((s) => !slotHasEnded(date, s) && !(date === res.date_key && s === res.slot_time));
    setTransferTargetSlot(firstOpen || timeSlotsList[0]);
    setTransferringReservation(res);
  };

  const handleExecuteTransfer = async (reservationId: string, newDateKey: string, newSlotTime: string) => {
    if (slotHasEnded(newDateKey, newSlotTime)) {
      alert('That time slot has already passed. Choose a future date or a later time slot.');
      return;
    }
    try {
      const { data, error } = await supabase.rpc('admin_transfer_slot', {
        p_reservation_id: reservationId,
        p_new_date_key: newDateKey,
        p_new_slot_time: newSlotTime
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.message || 'Transfer failed.');
      alert('Slot successfully transferred!');
      setTransferringReservation(null);
      if (inspectingSlot) {
        handleInspectSlot(inspectingSlot.slotTime, inspectingSlot.dateKey);
      }
      fetchCloudData();
    } catch (e: any) {
      alert(e?.message || 'Failed to transfer slot.');
    }
  };
  // --- Time windows (Slot Capacity tab): edit / add / remove; customers and dashboards update live ---
  const slotFlash = (kind: 'ok' | 'err', text: string) => {
    setSlotMsg({ kind, text });
    setTimeout(() => setSlotMsg((cur) => (cur && cur.text === text ? null : cur)), 7000);
  };
  const slotEditValue = (label: string) => slotEdits[label] || slotTo24(label) || { start: '09:00', end: '10:00' };
  const handleRenameSlot = async (oldLabel: string) => {
    const v = slotEditValue(oldLabel);
    if (!v.start || !v.end || v.start >= v.end) { slotFlash('err', 'The end time must be after the start time.'); return; }
    const next = `${to12h(v.start)} - ${to12h(v.end)}`;
    if (next === oldLabel) { slotFlash('ok', 'No change: that is already the current time.'); return; }
    setSlotMgmtBusy(true);
    const { data, error } = await supabase.rpc('admin_rename_time_slot', { p_old_label: oldLabel, p_new_label: next });
    setSlotMgmtBusy(false);
    if (error || data?.success === false) { slotFlash('err', error?.message || data?.message || 'Could not change the time slot.'); return; }
    setSlotEdits((p) => { const n = { ...p }; delete n[oldLabel]; return n; });
    slotFlash('ok', `Time slot changed to ${next}. Today's and upcoming bookings moved with it.`);
    fetchCloudData();
  };
  const handleAddSlot = async () => {
    if (!newSlotStart || !newSlotEnd || newSlotStart >= newSlotEnd) { slotFlash('err', 'The end time must be after the start time.'); return; }
    const label = `${to12h(newSlotStart)} - ${to12h(newSlotEnd)}`;
    setSlotMgmtBusy(true);
    const { data, error } = await supabase.rpc('admin_add_time_slot', { p_label: label });
    setSlotMgmtBusy(false);
    if (error || data?.success === false) { slotFlash('err', error?.message || data?.message || 'Could not add the time slot.'); return; }
    slotFlash('ok', `Added ${label}.`);
  };
  const handleDeleteSlot = async (label: string) => {
    if (!window.confirm(`Remove the ${label} time slot? Customers will no longer be able to book it.`)) return;
    setSlotMgmtBusy(true);
    const { data, error } = await supabase.rpc('admin_delete_time_slot', { p_label: label });
    setSlotMgmtBusy(false);
    if (error || data?.success === false) { slotFlash('err', error?.message || data?.message || 'Could not remove the time slot.'); return; }
    slotFlash('ok', `Removed ${label}.`);
    fetchCloudData();
  };

  return (
    <>
        {/* Scheduling slot capacity & bowl inventory controls */}
        {active && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-emerald-900/60 pb-3 gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-lime-400" />
                <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Manage Bowl Capacity & Time Slot Bookings</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-300">Select Date:</span>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedSlotDate}
                  onChange={(e) => setSelectedSlotDate(e.target.value)}
                  className="bg-[#041913] border border-emerald-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-lime-400"
                />
              </div>
            </div>
            <p className="text-xs text-emerald-300">
              Configure maximum bowl limits per time window, inspect slot owners, or transfer reservations between time slots.
            </p>
            {/* Time windows: edits apply to today and all upcoming dates and show instantly for customers */}
            <div className="rounded-2xl border border-emerald-800/80 bg-[#041913] p-4 space-y-3">
              <div>
                <p className="text-xs font-extrabold text-lime-400 uppercase tracking-wider">Edit time windows</p>
                <p className="text-[11px] text-emerald-300 mt-0.5">
                  Change a window (for example 12:00 PM - 1:00 PM to 9:00 AM - 10:00 AM). Today's and upcoming bookings move with it and customers see the new time instantly. Past dates keep their original time.
                </p>
              </div>
              {slotMsg && (
                <div className={`rounded-xl border p-2.5 text-[11px] font-bold ${slotMsg.kind === 'ok' ? 'bg-lime-950/60 border-lime-500/40 text-lime-300' : 'bg-red-950/70 border-red-700 text-red-300'}`}>
                  {slotMsg.text}
                </div>
              )}
              <div className="space-y-2">
                {timeSlotsList.map((label) => {
                  const v = slotEditValue(label);
                  return (
                    <div key={label} className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-white w-40 shrink-0">{label}</span>
                      <input type="time" value={v.start}
                        onChange={(e) => setSlotEdits((p) => ({ ...p, [label]: { ...slotEditValue(label), start: e.target.value } }))}
                        className="bg-[#03120d] border border-emerald-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-lime-400" />
                      <span className="text-emerald-400 text-xs">to</span>
                      <input type="time" value={v.end}
                        onChange={(e) => setSlotEdits((p) => ({ ...p, [label]: { ...slotEditValue(label), end: e.target.value } }))}
                        className="bg-[#03120d] border border-emerald-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-lime-400" />
                      <Button disabled={slotMgmtBusy} onClick={() => handleRenameSlot(label)}
                        className="bg-lime-400 text-black font-extrabold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40">Save time</Button>
                      <Button disabled={slotMgmtBusy} onClick={() => handleDeleteSlot(label)}
                        className="bg-red-950 text-red-300 border border-red-800 font-bold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40">Remove</Button>
                    </div>
                  );
                })}
                {timeSlotsList.length === 0 && <p className="text-[11px] text-emerald-400/80">No time windows yet. Add one below.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-900/60">
                <span className="text-[11px] font-bold text-lime-400 w-40 shrink-0">Add a new window</span>
                <input type="time" value={newSlotStart} onChange={(e) => setNewSlotStart(e.target.value)}
                  className="bg-[#03120d] border border-emerald-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-lime-400" />
                <span className="text-emerald-400 text-xs">to</span>
                <input type="time" value={newSlotEnd} onChange={(e) => setNewSlotEnd(e.target.value)}
                  className="bg-[#03120d] border border-emerald-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-lime-400" />
                <Button disabled={slotMgmtBusy} onClick={handleAddSlot}
                  className="bg-emerald-300 text-black font-extrabold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40">Add window</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {timeSlotsList.map((slotTime) => {
                const existing = slotCapacities ? Object.values(slotCapacities).find((s: any) => s.date_key === selectedSlotDate && s.slot_time === slotTime) : null;
                const maxBowls = existing ? existing.max_bowls : 10;
                const bookedBowls = existing ? existing.booked_bowls : 0;
                const maxSlots = existing ? existing.max_slots : 10;
                const isFullyBooked = existing ? !!existing.is_manually_fully_booked : false;
                return (
                  <AdminSlotCapacityCard
                    key={slotTime}
                    slotTime={slotTime}
                    dateKey={selectedSlotDate}
                    initialMaxBowls={maxBowls}
                    bookedBowls={bookedBowls}
                    initialMaxSlots={maxSlots}
                    initialFullyBooked={isFullyBooked}
                    onSave={handleUpdateSlotCapacity}
                    onInspect={() => handleInspectSlot(slotTime, selectedSlotDate)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Slot Owner Inspector Modal */}
        <Dialog open={!!inspectingSlot} onOpenChange={(open) => !open && setInspectingSlot(null)}>
          {inspectingSlot && (
            <DialogContent className="max-w-2xl w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
                <div className="space-y-0.5">
                  <DialogTitle className="font-display text-lg font-extrabold text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-lime-400" /> Slot Owners: {inspectingSlot.slotTime} ({inspectingSlot.dateKey})
                  </DialogTitle>
                  <DialogDescription className="text-xs text-emerald-300">
                    Inspect who reserved this slot and view what exact items/bowls they ordered.
                  </DialogDescription>
                </div>
              </div>
              <div className="my-4 space-y-3">
                {slotReservationsList.length === 0 ? (
                  <p className="text-xs text-emerald-400/70 text-center py-6">No reservations found for this time slot.</p>
                ) : (
                  slotReservationsList.map((res) => (
                    <div key={res.id} className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2">
                        <div>
                          <span className="font-extrabold text-white text-sm">{res.customer_name}</span>
                          <span className="text-[10px] text-emerald-300 block">{res.customer_phone || 'No phone'}</span>
                        </div>
                        <div className="text-right">
                          <span className="bg-lime-400 text-black px-2.5 py-0.5 rounded-full font-extrabold text-[10px]">
                            {res.bowls_reserved} Bowls Reserved
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-emerald-400 uppercase font-bold">Ordered Items & Customizations:</span>
                        {res.orders?.items?.map((it: any, i: number) => (
                          <div key={i} className="text-emerald-200 text-[11px] pl-2 border-l-2 border-lime-400/40">
                            <span>{itemQty(it)}x {lineItemName(it)}</span>
                            {it.customizationsSummary && <span className="block text-[10px] text-lime-300 font-mono">↳ {it.customizationsSummary}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end pt-2 border-t border-emerald-900/40">
                        <Button
                          size="sm"
                          onClick={() => openTransfer(res)}
                          className="bg-[#082a20] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1.5"
                        >
                          <ArrowRightLeft className="size-3.5" /> Transfer Schedule
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* Transfer Schedule Modal */}
        <Dialog open={!!transferringReservation} onOpenChange={(open) => !open && setTransferringReservation(null)}>
          {transferringReservation && (
            <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl">
              <div className="space-y-1 border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-lg font-extrabold text-white">
                  Transfer Reservation for {transferringReservation.customer_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">
                  Move this customer's {transferringReservation.bowls_reserved} bowls to another date and time. Past time slots cannot be selected.
                </DialogDescription>
              </div>
              <div className="my-4 space-y-3 text-xs">
                <div>
                  <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">Target Date</label>
                  <input
                    type="date"
                    min={todayManila()}
                    value={transferTargetDate}
                    onChange={(e) => {
                      const d = e.target.value;
                      if (!d) return;
                      setTransferTargetDate(d);
                      if (slotHasEnded(d, transferTargetSlot)) {
                        const next = timeSlotsList.find((s) => !slotHasEnded(d, s));
                        if (next) setTransferTargetSlot(next);
                      }
                    }}
                    className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-lime-400"
                  />
                </div>
                <div>
                  <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">Target Time Slot</label>
                  <select
                    value={transferTargetSlot}
                    onChange={(e) => setTransferTargetSlot(e.target.value)}
                    className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-lime-400"
                  >
                    {timeSlotsList.map((slot) => {
                      const ended = slotHasEnded(transferTargetDate, slot);
                      const same = transferTargetDate === transferringReservation.date_key && slot === transferringReservation.slot_time;
                      return (
                        <option key={slot} value={slot} disabled={ended || same}>
                          {slot}{ended ? ' (already passed)' : same ? ' (current slot)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                <Button onClick={() => setTransferringReservation(null)} className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</Button>
                <Button
                  disabled={slotHasEnded(transferTargetDate, transferTargetSlot)}
                  onClick={() => handleExecuteTransfer(transferringReservation.id, transferTargetDate, transferTargetSlot)}
                  className="flex-1 bg-lime-400 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >Confirm Transfer</Button>
              </div>
            </DialogContent>
          )}
        </Dialog>
    </>
  );
}
