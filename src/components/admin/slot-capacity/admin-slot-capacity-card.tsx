// @ts-nocheck
// Admin slot capacity card: edits the bowl cap and the manual fully-booked flag of one time slot on one date.
// Step A4: moved unchanged from employee-dashboard.tsx (function renamed from SlotCapacityCard to AdminSlotCapacityCard).
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

// --- Reusable editor card for an individual date/time slot's bowl capacity & bookings ---
export function AdminSlotCapacityCard({ slotTime, dateKey, initialMaxBowls, bookedBowls, initialMaxSlots, initialFullyBooked, onSave, onInspect }: any) {
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

  return (
    <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2">
        <span className="font-extrabold text-lime-400 text-sm flex items-center gap-1.5">
          <Clock className="size-4" /> {slotTime}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${isFullyBooked || remainingBowls === 0 ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-lime-400/20 text-lime-400 border border-lime-400/40'}`}>
            {remainingBowls === 0 ? 'Fully Booked' : isFullyBooked ? `Closed • ${remainingBowls} unused` : `${remainingBowls} Bowls Left`}
          </span>
          <Button
            size="sm"
            onClick={onInspect}
            className="bg-[#082a20] hover:bg-lime-400 hover:text-black text-lime-300 border border-emerald-700 text-[10px] px-2 py-0.5 rounded-lg font-bold cursor-pointer"
          >
            Inspect Owners
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-emerald-300 block mb-1">Max Bowls Cap (Configurable):</label>
          <input
            type="number"
            min="1"
            value={maxBowls}
            onChange={(e) => setMaxBowls(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-[#04140f] border border-emerald-800 rounded-lg p-2 text-lime-400 font-bold text-xs focus:outline-none focus:border-lime-400"
          />
        </div>
        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 p-2 rounded-lg bg-[#04140f] border border-emerald-800 cursor-pointer h-9">
            <input
              type="checkbox"
              checked={isFullyBooked}
              onChange={(e) => setIsFullyBooked(e.target.checked)}
              className="rounded border-emerald-700 text-red-500 focus:ring-red-400 bg-black/40 h-4 w-4"
            />
            <span className="font-bold text-red-400 text-[11px]">Mark Fully Booked</span>
          </label>
        </div>
      </div>

      <div className="flex justify-between items-center pt-1 text-[11px] text-emerald-300">
        <span>Reserved Bowls: <strong>{currentBookedBowls} / {maxBowls}</strong></span>
        <Button
          size="sm"
          onClick={() => onSave(dateKey, slotTime, maxBowls, maxSlots, isFullyBooked)}
          className="bg-lime-400 hover:bg-lime-500 text-black font-extrabold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer"
        >
          Save Slot
        </Button>
      </div>
    </div>
  );
}
