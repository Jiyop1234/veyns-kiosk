// @ts-nocheck
// Admin slot capacity row: one time window on the selected date, shown as a table row
// (reserved, max bowls, bowls left, utilization, status, closed switch, Inspect and Save).
// Step B4: replaces admin-slot-capacity-card.tsx. The state, the effect and the save call are the card's code; only the markup is new.
import { useState, useEffect } from 'react';
import { Clock, Minus, Plus } from 'lucide-react';

// Column widths shared by the header row (in the tab) and every slot row, so they always line up.
export const ADMIN_SLOT_ROW_GRID = 'grid grid-cols-[minmax(150px,1.4fr)_80px_120px_56px_minmax(110px,1fr)_96px_64px_150px] items-center gap-3';

// --- One time slot of one date: edit its bowl cap and the manual fully-booked flag ---
export function AdminSlotCapacityRow({ slotTime, dateKey, initialMaxBowls, bookedBowls, initialMaxSlots, initialFullyBooked, selected, onSave, onInspect }: any) {
  // Use initialMaxBowls if provided, otherwise default to 10 (configurable, not hardcoded)
  const [maxBowls, setMaxBowls] = useState(initialMaxBowls || 10);
  const [maxSlots, setMaxSlots] = useState(initialMaxSlots || 10);
  const [isFullyBooked, setIsFullyBooked] = useState(initialFullyBooked || false);

  useEffect(() => {
    setMaxBowls(initialMaxBowls || 10);
    setMaxSlots(initialMaxSlots || 10);
    setIsFullyBooked(initialFullyBooked || false);
  }, [initialMaxBowls, initialMaxSlots, initialFullyBooked]);

  const currentBookedBowls = Number(bookedBowls || 0);
  // Calculate remaining bowls dynamically based on the configurable maxBowls
  const remainingBowls = Math.max(0, maxBowls - currentBookedBowls);

  // Display only: how full the slot is, and whether there is something typed that is not saved yet.
  const utilization = Math.min(100, Math.round((currentBookedBowls / Math.max(1, maxBowls)) * 100));
  const unsaved = maxBowls !== (initialMaxBowls || 10) || isFullyBooked !== !!initialFullyBooked;
  const status = remainingBowls === 0
    ? { label: 'Full', pill: 'bg-red-500/15 text-red-300', dot: 'bg-red-400', bar: 'bg-red-400' }
    : isFullyBooked
      ? { label: 'Closed', pill: 'bg-white/10 text-white/70', dot: 'bg-white/50', bar: 'bg-white/40' }
      : utilization >= 70
        ? { label: 'Filling up', pill: 'bg-amber-400/15 text-amber-300', dot: 'bg-amber-400', bar: 'bg-amber-400' }
        : { label: 'Open', pill: 'bg-lime-400/15 text-lime-300', dot: 'bg-lime-400', bar: 'bg-lime-400' };

  return (
    <div className={`${ADMIN_SLOT_ROW_GRID} rounded-2xl px-4 py-3 text-sm transition-colors ${selected ? 'bg-lime-400/10' : 'bg-white/[0.04] hover:bg-white/[0.06]'}`}>
      <span className="flex items-center gap-2 font-bold text-white">
        <Clock className="size-4 shrink-0 text-lime-400" /> {slotTime}
      </span>

      <span className="font-bold text-white">
        {currentBookedBowls} <span className="font-semibold text-white/40">/ {maxBowls}</span>
      </span>

      <div className="flex h-9 items-center rounded-xl bg-white/[0.06] focus-within:ring-1 focus-within:ring-lime-400/70">
        <button
          type="button"
          aria-label="One bowl less"
          onClick={() => setMaxBowls(Math.max(1, maxBowls - 1))}
          className="grid size-9 shrink-0 place-items-center rounded-l-xl text-white/60 hover:text-lime-400"
        >
          <Minus className="size-3.5" />
        </button>
        <input
          type="number"
          min="1"
          aria-label={`Max bowls for ${slotTime}`}
          value={maxBowls}
          onChange={(e) => setMaxBowls(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-full min-w-0 bg-transparent text-center text-sm font-bold text-lime-400 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="One bowl more"
          onClick={() => setMaxBowls(maxBowls + 1)}
          className="grid size-9 shrink-0 place-items-center rounded-r-xl text-white/60 hover:text-lime-400"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <span className="font-bold text-white" title={isFullyBooked ? `${remainingBowls} unused (slot is closed)` : undefined}>{remainingBowls}</span>

      <div className="flex items-center gap-2">
        <span className="w-9 shrink-0 font-bold text-white">{utilization}%</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${utilization}%` }} />
        </div>
      </div>

      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status.pill}`}>
        <span className={`size-1.5 rounded-full ${status.dot}`} /> {status.label}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={isFullyBooked}
        aria-label={`Mark ${slotTime} fully booked`}
        title="Mark fully booked"
        onClick={() => setIsFullyBooked(!isFullyBooked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${isFullyBooked ? 'bg-red-500/80' : 'bg-white/15'}`}
      >
        <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform ${isFullyBooked ? 'translate-x-5' : ''}`} />
      </button>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onInspect}
          className="cursor-pointer rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
        >
          Inspect
        </button>
        <button
          type="button"
          onClick={() => onSave(dateKey, slotTime, maxBowls, maxSlots, isFullyBooked)}
          className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-extrabold ${unsaved ? 'bg-lime-400 text-black hover:bg-lime-300' : 'bg-white/[0.06] text-white/70 hover:bg-white/10'}`}
        >
          Save
        </button>
      </div>
    </div>
  );
}
