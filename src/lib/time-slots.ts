// Shared, editable time slots (public.time_slots).
// Staff change them in Dashboard > Slot Capacity & Fully Booked. Every screen reads the same list
// and refreshes in real time (Supabase realtime on public.time_slots).
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Used until the table loads, and as a fallback if the time_slots migration has not been run yet.
export const DEFAULT_TIME_SLOTS = ['12:00 PM - 1:00 PM', '4:00 PM - 5:00 PM', '7:00 PM - 8:00 PM', '10:00 PM - 11:00 PM'];

const SLOT_RE = /^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*-\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*$/;
const toMinutes = (h: string, m: string, ap: string) =>
  ((parseInt(h, 10) % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0)) * 60 + parseInt(m, 10);

// Epoch ms when a slot ends on a given date (Asia/Manila, UTC+8), or null if the label is not valid.
export function slotEndsAt(dateKey: string, slot: string): number | null {
  const m = (slot || '').match(SLOT_RE);
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return null;
  const s = toMinutes(m[1], m[2], m[3]);
  let e = toMinutes(m[4], m[5], m[6]);
  if (e <= s) e += 1440;
  const [y, mo, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, 0, e, 0) - 8 * 3600 * 1000;
}

// True once the END of the slot has passed (works for any window length, not only 1-hour slots).
export function slotHasEnded(dateKey: string, slot: string): boolean {
  const end = slotEndsAt(dateKey, slot);
  return end === null ? true : end <= Date.now();
}

const startOf = (label: string) => {
  const m = (label || '').match(SLOT_RE);
  return m ? toMinutes(m[1], m[2], m[3]) : 0;
};

// Returns the slot labels in time order, kept up to date in real time.
export function useTimeSlots(): string[] {
  const [slots, setSlots] = useState<string[]>(DEFAULT_TIME_SLOTS);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from('time_slots').select('label,start_minutes');
      if (!alive || error || !data) return; // table missing (migration not run yet): keep the defaults
      const sorted = [...data].sort((a: any, b: any) => (a.start_minutes ?? startOf(a.label)) - (b.start_minutes ?? startOf(b.label)));
      setSlots(sorted.map((r: any) => r.label));
    };
    load();
    const channel = supabase
      .channel('time_slots_live_' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_slots' }, load)
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return slots;
}
