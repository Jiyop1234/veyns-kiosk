// Admin slot capacity calculations (no screen code): the 7-day series for the stat card charts and the plans for the Global Actions.
// Step B4b: new file. It only reads the slot_capacities rows the dashboard already loads; the saving is done by the tab with admin_set_slot_capacity.

export const SLOT_DEFAULT_MAX_BOWLS = 10;
export const SLOT_DEFAULT_MAX_SLOTS = 10;

export type SlotRow = { slotTime: string; maxBowls: number; bookedBowls: number; maxSlots: number; isFullyBooked: boolean };

// "2026-11-17" + 3 -> "2026-11-20" (plain calendar arithmetic, no time zone involved)
export const shiftDateKey = (dateKey: string, days: number): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey || '');
  if (!m) return dateKey;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
};

// The saved row of one window on one date, or null when nothing was saved or reserved there yet.
export const findSlotCapacity = (slotCapacities: any, dateKey: string, slotTime: string): any => {
  if (!slotCapacities) return null;
  const rows: any[] = Object.values(slotCapacities);
  return rows.find((s: any) => s.date_key === dateKey && s.slot_time === slotTime) || null;
};

// One window on one date. No saved row means the page defaults (10 bowls, nothing booked, open), exactly as the slot rows have always shown.
export const slotRowFor = (slotCapacities: any, dateKey: string, slotTime: string): SlotRow => {
  const existing = findSlotCapacity(slotCapacities, dateKey, slotTime);
  return {
    slotTime,
    maxBowls: existing ? existing.max_bowls : SLOT_DEFAULT_MAX_BOWLS,
    bookedBowls: existing ? existing.booked_bowls : 0,
    maxSlots: existing ? existing.max_slots : SLOT_DEFAULT_MAX_SLOTS,
    isFullyBooked: existing ? !!existing.is_manually_fully_booked : false,
  };
};

// Totals per day for the `days` days that end on endDateKey (oldest first), over the current time windows.
export const buildWeekSeries = (slotCapacities: any, timeSlotsList: string[], endDateKey: string, days: number = 7) => {
  const capacity: number[] = [];
  const reserved: number[] = [];
  const left: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateKey = shiftDateKey(endDateKey, -i);
    let cap = 0;
    let res = 0;
    let lf = 0;
    for (const slotTime of timeSlotsList) {
      const r = slotRowFor(slotCapacities, dateKey, slotTime);
      cap += Number(r.maxBowls || 0);
      res += Number(r.bookedBowls || 0);
      lf += Math.max(0, Number(r.maxBowls || 0) - Number(r.bookedBowls || 0));
    }
    capacity.push(cap);
    reserved.push(res);
    left.push(lf);
  }
  return { capacity, reserved, left };
};

// ---------------------------------------------------------------------------
// Global Actions: what each action would change, window by window. `to` is null when the window is left as it is (see `note`).
// ---------------------------------------------------------------------------
export type BulkKind = 'holiday' | 'copy' | 'reset';
export type BulkState = { maxBowls: number; isFullyBooked: boolean };
export type BulkTarget = { maxBowls: number; maxSlots: number; isFullyBooked: boolean };
export type BulkPlanItem = { slotTime: string; from: BulkState; to: BulkTarget | null; note: string };
export type BulkPlan = { kind: BulkKind; dateKey: string; sourceDateKey: string; items: BulkPlanItem[] };

export const planBulkAction = (kind: BulkKind, slotCapacities: any, timeSlotsList: string[], dateKey: string): BulkPlan => {
  const sourceDateKey = shiftDateKey(dateKey, -1);
  const items: BulkPlanItem[] = timeSlotsList.map((slotTime: string): BulkPlanItem => {
    const cur = slotRowFor(slotCapacities, dateKey, slotTime);
    const from: BulkState = { maxBowls: cur.maxBowls, isFullyBooked: cur.isFullyBooked };

    if (kind === 'holiday') {
      if (cur.isFullyBooked) return { slotTime, from, to: null, note: 'Already closed' };
      return { slotTime, from, to: { maxBowls: cur.maxBowls, maxSlots: cur.maxSlots, isFullyBooked: true }, note: '' };
    }

    if (kind === 'reset') {
      if (cur.bookedBowls > SLOT_DEFAULT_MAX_BOWLS) {
        return { slotTime, from, to: null, note: `${cur.bookedBowls} bowls are reserved, more than the default ${SLOT_DEFAULT_MAX_BOWLS}` };
      }
      if (cur.maxBowls === SLOT_DEFAULT_MAX_BOWLS && cur.maxSlots === SLOT_DEFAULT_MAX_SLOTS && !cur.isFullyBooked) {
        return { slotTime, from, to: null, note: 'Already at the default' };
      }
      return { slotTime, from, to: { maxBowls: SLOT_DEFAULT_MAX_BOWLS, maxSlots: SLOT_DEFAULT_MAX_SLOTS, isFullyBooked: false }, note: '' };
    }

    // copy previous day
    const src = findSlotCapacity(slotCapacities, sourceDateKey, slotTime);
    if (!src) return { slotTime, from, to: null, note: `No saved settings on ${sourceDateKey}` };
    const target: BulkTarget = { maxBowls: Number(src.max_bowls), maxSlots: Number(src.max_slots), isFullyBooked: !!src.is_manually_fully_booked };
    if (cur.bookedBowls > target.maxBowls) {
      return { slotTime, from, to: null, note: `${cur.bookedBowls} bowls are reserved, more than ${target.maxBowls}` };
    }
    if (cur.maxBowls === target.maxBowls && cur.maxSlots === target.maxSlots && cur.isFullyBooked === target.isFullyBooked) {
      return { slotTime, from, to: null, note: 'Already the same' };
    }
    return { slotTime, from, to: target, note: '' };
  });
  return { kind, dateKey, sourceDateKey, items };
};
