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

// ---------------------------------------------------------------------------
// Ordering rules shared by the customer checkout and the staff "Process Customer Order" screen.
// (The database enforces the same rules in place_order / admin_place_order.)
//   * The store opens at 12 noon (Asia/Manila): "Order Today" is closed before that.
//   * Orders for a time slot close 1 hour before the slot starts
//     (e.g. the 4:00 PM - 5:00 PM slot can no longer be ordered from 3:00 PM).
// ---------------------------------------------------------------------------
export const STORE_OPEN_HOUR = 12;
export const STORE_OPEN_LABEL = '12 NOON';
export const SLOT_CUTOFF_MINUTES = 60;

const MANILA_OFFSET_MS = 8 * 3600 * 1000;

// Epoch ms when a slot starts on a given date (Asia/Manila), or null if the label is not valid.
export function slotStartsAt(dateKey: string, slot: string): number | null {
  const m = (slot || '').match(SLOT_RE);
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return null;
  const s = toMinutes(m[1], m[2], m[3]);
  const [y, mo, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, 0, s, 0) - MANILA_OFFSET_MS;
}

export type SlotBlock = 'ended' | 'cutoff' | null;

// null = the slot can still be ordered. 'ended' = already over. 'cutoff' = inside the 1-hour cutoff.
export function slotOrderBlock(dateKey: string, slot: string, now: number = Date.now()): SlotBlock {
  const start = slotStartsAt(dateKey, slot);
  const end = slotEndsAt(dateKey, slot);
  if (start === null || end === null) return 'ended';
  if (end <= now) return 'ended';
  if (start - SLOT_CUTOFF_MINUTES * 60 * 1000 <= now) return 'cutoff';
  return null;
}

// Today's date (YYYY-MM-DD) in Asia/Manila.
export function todayKeyManila(now: number = Date.now()): string {
  return new Date(now + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

// Tomorrow's date (YYYY-MM-DD) in Asia/Manila.
export function tomorrowKeyManila(now: number = Date.now()): string {
  return new Date(now + MANILA_OFFSET_MS + 24 * 3600 * 1000).toISOString().slice(0, 10);
}

// True from 12:00 noon (Asia/Manila) onwards.
export function isStoreOpenNow(now: number = Date.now()): boolean {
  return new Date(now + MANILA_OFFSET_MS).getUTCHours() >= STORE_OPEN_HOUR;
}

// Re-renders the component every 30 seconds so open/closed labels and slot cutoffs update by themselves.
export function useMinuteTick(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}
