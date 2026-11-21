// @ts-nocheck
// Admin Slot Capacity tab: bowl capacity per time window, edit/add/remove time windows, slot owner inspector and transfer dialog.
// Step A4: moved unchanged from employee-dashboard.tsx (Step A5B: renamed from AdminSlotsTab to match the SLOT CAPACITY nav label). New: this wrapper, its props, and the `active` flag (see below).
// Step B4: new look (stat cards, one table row per time window, slot owners panel beside it, time windows in their own tab, no page scroll on a large screen).
// The state and every function from "Time window manager" to handleDeleteSlot are the A4 code, unchanged; only `view` (which tab is open) and `fit` are new.
// Step B4b: 7-day charts on the stat cards and the Global Actions (Copy previous day, Holiday mode, Reset to default). They save through the same admin_set_slot_capacity function the Save button uses, one call per window.
// The tab body shows only when `active` is true, but this component stays mounted, so its state (selected date, messages,
// open panels and dialogs) is kept when you switch tabs, exactly like before.
import { useState } from 'react';
import { CalendarDays, Clock, Gauge, Plus, Utensils, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { todayManila, slotHasEnded, to12h, slotTo24 } from '@/components/admin/admin-slot-times';
import { AdminSlotCapacityRow, ADMIN_SLOT_ROW_GRID } from '@/components/admin/slot-capacity/admin-slot-capacity-row';
import { AdminSlotCapacityOwnersPanel } from '@/components/admin/slot-capacity/admin-slot-capacity-owners-panel';
import { AdminSlotCapacityWindowsPanel } from '@/components/admin/slot-capacity/admin-slot-capacity-windows-panel';
import { AdminSlotCapacitySparkline } from '@/components/admin/slot-capacity/admin-slot-capacity-sparkline';
import { AdminSlotCapacityActions } from '@/components/admin/slot-capacity/admin-slot-capacity-actions';
import { AdminSlotCapacityBulkDialog } from '@/components/admin/slot-capacity/admin-slot-capacity-bulk-dialog';
import { slotRowFor, buildWeekSeries, planBulkAction } from '@/components/admin/slot-capacity/admin-slot-capacity-math';

// --- Small summary card at the top of the page ---
function SlotStatCard({ icon, label, value, unit, note, children, spark }: any) {
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-white/[0.04] px-5 py-4">
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime-400/15 text-lime-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/60">{label}</p>
        <p className="text-3xl font-extrabold leading-tight text-white">{value}{unit ? <span className="ml-1.5 text-sm font-semibold text-white/50">{unit}</span> : null}</p>
        {children}
        {note ? <p className="text-[11px] text-white/40">{note}</p> : null}
      </div>
      {spark ? <div className="hidden w-24 shrink-0 self-end sm:block">{spark}</div> : null}
    </div>
  );
}

export function AdminSlotCapacityTab({ active, timeSlotsList, slotCapacities, fetchCloudData, fit = false }: { active: boolean; timeSlotsList: string[]; slotCapacities: any; fetchCloudData: () => void; fit?: boolean }) {
  // --- Time window manager (Slot Capacity tab) ---
  // Step B4: which part of the page is open (the table of slots, or the time windows editor).
  const [view, setView] = useState<'daily' | 'windows'>('daily');
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

  // --- Step B4b: Global Actions (Copy previous day, Holiday mode, Reset to default) ---
  // The plan shows what would change; Apply then saves each window with the same function as the Save button (admin_set_slot_capacity).
  const [bulkPlan, setBulkPlan] = useState<any>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ done: { slotTime: string }[]; failed: { slotTime: string; message: string }[] } | null>(null);
  const openBulk = (kind: 'holiday' | 'copy' | 'reset') => {
    setBulkResult(null);
    setBulkPlan(planBulkAction(kind, slotCapacities, timeSlotsList, selectedSlotDate));
  };
  const closeBulk = () => {
    if (bulkBusy) return;
    setBulkPlan(null);
    setBulkResult(null);
  };
  const runBulk = async () => {
    if (!bulkPlan) return;
    const todo = bulkPlan.items.filter((i: any) => i.to);
    const done: { slotTime: string }[] = [];
    const failed: { slotTime: string; message: string }[] = [];
    setBulkBusy(true);
    for (const item of todo) {
      const { data, error } = await supabase.rpc('admin_set_slot_capacity', {
        p_date_key: bulkPlan.dateKey, p_slot_time: item.slotTime, p_max_bowls: item.to.maxBowls, p_max_slots: item.to.maxSlots, p_closed: item.to.isFullyBooked
      });
      if (error || data?.success === false) failed.push({ slotTime: item.slotTime, message: error?.message || data?.message || 'Could not update this slot.' });
      else done.push({ slotTime: item.slotTime });
    }
    setBulkBusy(false);
    setBulkResult({ done, failed });
    fetchCloudData();
  };

  // Step B4: one entry per time window for the chosen date (the same lookup the old cards did inline), shared by the stat cards and the rows.
  const slotRows = timeSlotsList.map((slotTime) => slotRowFor(slotCapacities, selectedSlotDate, slotTime));
  const week = buildWeekSeries(slotCapacities, timeSlotsList, selectedSlotDate);
  const totalCapacity = slotRows.reduce((s, r) => s + Number(r.maxBowls || 0), 0);
  const totalReserved = slotRows.reduce((s, r) => s + Number(r.bookedBowls || 0), 0);
  const totalLeft = slotRows.reduce((s, r) => s + Math.max(0, Number(r.maxBowls || 0) - Number(r.bookedBowls || 0)), 0);
  const closedCount = slotRows.filter((r) => r.isFullyBooked).length;
  const utilizationPct = totalCapacity > 0 ? Math.min(100, Math.round((totalReserved / totalCapacity) * 100)) : 0;
  const inspectedCapacity = inspectingSlot && slotCapacities
    ? (Object.values(slotCapacities).find((s: any) => s.date_key === inspectingSlot.dateKey && s.slot_time === inspectingSlot.slotTime)?.max_bowls ?? 10)
    : 10;

  return (
    <>
      {active && (
        <div className={fit ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-4'}>
          {/* Subtitle and the date picker */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/60">Manage bowl capacity and time slot bookings. Set the maximum bowls per window, inspect who reserved a slot, or transfer a reservation.</p>
            <label className="flex items-center gap-2 rounded-2xl bg-white/[0.06] px-3.5 py-2 text-sm text-white focus-within:ring-1 focus-within:ring-lime-400/70">
              <CalendarDays className="size-4 shrink-0 text-lime-400" />
              <span className="font-semibold text-white/60">Date</span>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={selectedSlotDate}
                onChange={(e) => setSelectedSlotDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-white focus:outline-none [color-scheme:dark]"
              />
            </label>
          </div>

          {/* Totals for the chosen date */}
          <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
            <SlotStatCard icon={<Utensils className="size-6" />} label="Total capacity" value={totalCapacity} unit="bowls" spark={<AdminSlotCapacitySparkline values={week.capacity} label="Total capacity, last 7 days" />} />
            <SlotStatCard icon={<PackageCheck className="size-6" />} label="Reserved" value={totalReserved} unit="bowls" spark={<AdminSlotCapacitySparkline values={week.reserved} label="Reserved bowls, last 7 days" />} />
            <SlotStatCard icon={<Clock className="size-6" />} label="Left to book" value={totalLeft} unit="bowls" note={closedCount > 0 ? `${closedCount} ${closedCount === 1 ? 'slot is' : 'slots are'} closed` : undefined} spark={<AdminSlotCapacitySparkline values={week.left} label="Bowls left to book, last 7 days" />} />
            <SlotStatCard icon={<Gauge className="size-6" />} label="Utilization" value={`${utilizationPct}%`}>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-lime-400" style={{ width: `${utilizationPct}%` }} />
              </div>
            </SlotStatCard>
          </div>

          {/* The slots (left) and, when Inspect is pressed, the slot owners (right) */}
          <div className={`grid gap-3 ${fit ? 'min-h-0 flex-1 grid-rows-[minmax(0,1fr)]' : ''} ${inspectingSlot ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1'}`}>
            <div className="flex min-h-0 flex-col gap-3">
            <div className="flex min-h-0 flex-1 flex-col rounded-3xl bg-white/[0.03] p-4">
              <div className="mb-3 flex shrink-0 items-center gap-2">
                {[['daily', 'Daily capacity', Gauge], ['windows', 'Time windows', Clock]].map(([id, label, Icon]: any) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setView(id)}
                    className={`flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition-colors ${view === id ? 'bg-lime-400 text-black' : 'bg-white/[0.06] text-white/70 hover:bg-white/10'}`}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>

              {view === 'daily' ? (
                <div className="min-h-0 flex-1 overflow-auto">
                  <div className="min-w-[860px]">
                    <div className={`${ADMIN_SLOT_ROW_GRID} sticky top-0 z-10 bg-[#071610] px-4 pb-2 text-xs font-semibold text-white/40`}>
                      <span>Time slot</span>
                      <span>Reserved</span>
                      <span>Max bowls</span>
                      <span>Left</span>
                      <span>Utilization</span>
                      <span>Status</span>
                      <span>Closed</span>
                      <span className="text-right">Actions</span>
                    </div>
                    <div className="space-y-2">
                      {slotRows.map((r) => (
                        <AdminSlotCapacityRow
                          key={r.slotTime}
                          slotTime={r.slotTime}
                          dateKey={selectedSlotDate}
                          initialMaxBowls={r.maxBowls}
                          bookedBowls={r.bookedBowls}
                          initialMaxSlots={r.maxSlots}
                          initialFullyBooked={r.isFullyBooked}
                          selected={!!inspectingSlot && inspectingSlot.slotTime === r.slotTime && inspectingSlot.dateKey === selectedSlotDate}
                          onSave={handleUpdateSlotCapacity}
                          onInspect={() => handleInspectSlot(r.slotTime, selectedSlotDate)}
                        />
                      ))}
                      {slotRows.length === 0 && <p className="py-6 text-center text-xs text-white/50">No time windows yet. Add one in the Time windows tab.</p>}
                      <button
                        type="button"
                        onClick={() => setView('windows')}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-lime-400/10 py-3 text-sm font-bold text-lime-300 hover:bg-lime-400/20"
                      >
                        <Plus className="size-4" /> Add new time slot
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <AdminSlotCapacityWindowsPanel
                  timeSlotsList={timeSlotsList}
                  slotMsg={slotMsg}
                  slotMgmtBusy={slotMgmtBusy}
                  slotEditValue={slotEditValue}
                  setSlotEdits={setSlotEdits}
                  newSlotStart={newSlotStart}
                  setNewSlotStart={setNewSlotStart}
                  newSlotEnd={newSlotEnd}
                  setNewSlotEnd={setNewSlotEnd}
                  onRename={handleRenameSlot}
                  onDelete={handleDeleteSlot}
                  onAdd={handleAddSlot}
                />
              )}
            </div>
            {view === 'daily' && (
              <AdminSlotCapacityActions dateKey={selectedSlotDate} disabled={bulkBusy} onEditWindows={() => setView('windows')} onBulk={openBulk} />
            )}
            </div>

            {inspectingSlot && (
              <AdminSlotCapacityOwnersPanel
                inspectingSlot={inspectingSlot}
                reservations={slotReservationsList}
                capacity={inspectedCapacity}
                fit={fit}
                onClose={() => setInspectingSlot(null)}
                onTransfer={openTransfer}
              />
            )}
          </div>
        </div>
      )}

      {/* Global Actions: confirm, then result */}
      <AdminSlotCapacityBulkDialog plan={bulkPlan} busy={bulkBusy} result={bulkResult} onConfirm={runBulk} onClose={closeBulk} />

      {/* Transfer Schedule Modal */}
      <Dialog open={!!transferringReservation} onOpenChange={(open) => !open && setTransferringReservation(null)}>
        {transferringReservation && (
          <DialogContent className="w-full max-w-md rounded-3xl border-0 bg-[#07130f] p-6 text-white shadow-2xl">
            <div className="space-y-1 pb-3">
              <DialogTitle className="font-display text-lg font-extrabold text-white">
                Transfer reservation for {transferringReservation.customer_name}
              </DialogTitle>
              <DialogDescription className="text-xs text-white/60">
                Move this customer's {transferringReservation.bowls_reserved} bowls to another date and time. Past time slots cannot be selected.
              </DialogDescription>
            </div>
            <div className="my-4 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-lime-400">Target date</label>
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
                  className="w-full rounded-xl bg-white/[0.06] p-2.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-lime-400/70 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-lime-400">Target time slot</label>
                <select
                  value={transferTargetSlot}
                  onChange={(e) => setTransferTargetSlot(e.target.value)}
                  className="w-full rounded-xl bg-white/[0.06] p-2.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-lime-400/70 [color-scheme:dark]"
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
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setTransferringReservation(null)} className="flex-1 cursor-pointer rounded-xl bg-white/[0.06] py-2.5 text-xs font-bold text-white hover:bg-white/10">Cancel</Button>
              <Button
                disabled={slotHasEnded(transferTargetDate, transferTargetSlot)}
                onClick={() => handleExecuteTransfer(transferringReservation.id, transferTargetDate, transferTargetSlot)}
                className="flex-1 cursor-pointer rounded-xl bg-lime-400 py-2.5 text-xs font-extrabold text-black shadow-lg hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
              >Confirm transfer</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
