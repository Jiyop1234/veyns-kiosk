// VEYNS Admin, Slot Capacity: browser helper for the five Slot Capacity gateway routes (Step 6D-3).
// Same style as admin-inventory-api.ts: the staff member's session token goes in the Authorization header;
// the server takes the user id from the token, never from the body.

import { supabase } from '@/lib/supabase';

export type SlotWriteResult = { ok: true; data?: any } | { ok: false; error: string };

async function callSlotRoute(path: string, payload: Record<string, unknown>): Promise<SlotWriteResult> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return { ok: false, error: 'Your session expired. Please sign in again.' };
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!body) return { ok: false, error: res.status === 404 ? `The Slot Capacity service (${path}) is not deployed.` : 'Unexpected response from the Slot Capacity service.' };
    if (!res.ok || !body.ok) return { ok: false, error: body.error || 'Request failed.' };
    return { ok: true, data: body.result };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

export const setSlotCapacity = (dateKey: string, slotTime: string, maxBowls: number, maxSlots: number | null, closed: boolean) =>
  callSlotRoute('/api/admin-slot-capacity-set', { dateKey, slotTime, maxBowls, maxSlots, closed });
export const transferSlot = (reservationId: string, newDateKey: string, newSlotTime: string) =>
  callSlotRoute('/api/admin-slot-transfer', { reservationId, newDateKey, newSlotTime });
export const addTimeSlot = (label: string) => callSlotRoute('/api/admin-time-slot-add', { label });
export const renameTimeSlot = (oldLabel: string, newLabel: string) => callSlotRoute('/api/admin-time-slot-rename', { oldLabel, newLabel });
export const deleteTimeSlot = (label: string) => callSlotRoute('/api/admin-time-slot-delete', { label });
