// @ts-nocheck
// Admin time windows panel: change, remove or add the time windows (12:00 PM - 1:00 PM and so on) customers can book.
// Step B4: the "Edit time windows" box of the old Slot Capacity page, restyled and moved into its own tab. The state and the three save / add / remove
// functions stay in admin-slot-capacity-tab.tsx and arrive here as props, so the calls to the database are unchanged.

const TIME_FIELD = 'rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lime-400/70 [color-scheme:dark]';

export function AdminSlotCapacityWindowsPanel({
  timeSlotsList, slotMsg, slotMgmtBusy, slotEditValue, setSlotEdits,
  newSlotStart, setNewSlotStart, newSlotEnd, setNewSlotEnd,
  onRename, onDelete, onAdd,
}: any) {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
      <p className="text-xs text-white/60">
        Change a window (for example 12:00 PM - 1:00 PM to 9:00 AM - 10:00 AM). Today's and upcoming bookings move with it and customers see the new time instantly. Past dates keep their original time.
      </p>

      {slotMsg && (
        <div className={`rounded-xl border p-2.5 text-xs font-bold ${slotMsg.kind === 'ok' ? 'border-lime-500/40 bg-lime-950/60 text-lime-300' : 'border-red-700 bg-red-950/70 text-red-300'}`}>
          {slotMsg.text}
        </div>
      )}

      <div className="space-y-2">
        {timeSlotsList.map((label: string) => {
          const v = slotEditValue(label);
          return (
            <div key={label} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/[0.04] px-4 py-3">
              <span className="w-44 shrink-0 text-sm font-bold text-white">{label}</span>
              <input
                type="time"
                aria-label={`Start time for ${label}`}
                value={v.start}
                onChange={(e) => setSlotEdits((p: any) => ({ ...p, [label]: { ...slotEditValue(label), start: e.target.value } }))}
                className={TIME_FIELD}
              />
              <span className="text-xs text-white/50">to</span>
              <input
                type="time"
                aria-label={`End time for ${label}`}
                value={v.end}
                onChange={(e) => setSlotEdits((p: any) => ({ ...p, [label]: { ...slotEditValue(label), end: e.target.value } }))}
                className={TIME_FIELD}
              />
              <button
                type="button"
                disabled={slotMgmtBusy}
                onClick={() => onRename(label)}
                className="cursor-pointer rounded-xl bg-lime-400 px-3.5 py-2 text-xs font-extrabold text-black hover:bg-lime-300 disabled:opacity-40"
              >
                Save time
              </button>
              <button
                type="button"
                disabled={slotMgmtBusy}
                onClick={() => onDelete(label)}
                className="cursor-pointer rounded-xl bg-red-500/15 px-3.5 py-2 text-xs font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          );
        })}
        {timeSlotsList.length === 0 && <p className="py-4 text-xs text-white/50">No time windows yet. Add one below.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-lime-400/10 px-4 py-3">
        <span className="w-44 shrink-0 text-sm font-bold text-lime-300">Add a new window</span>
        <input type="time" aria-label="New window start time" value={newSlotStart} onChange={(e) => setNewSlotStart(e.target.value)} className={TIME_FIELD} />
        <span className="text-xs text-white/50">to</span>
        <input type="time" aria-label="New window end time" value={newSlotEnd} onChange={(e) => setNewSlotEnd(e.target.value)} className={TIME_FIELD} />
        <button
          type="button"
          disabled={slotMgmtBusy}
          onClick={onAdd}
          className="cursor-pointer rounded-xl bg-lime-400 px-3.5 py-2 text-xs font-extrabold text-black hover:bg-lime-300 disabled:opacity-40"
        >
          Add window
        </button>
      </div>
    </div>
  );
}
