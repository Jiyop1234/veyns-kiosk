// Gateway routes: Slot Capacity writes (Step 6D-2). Staff (employee or admin).
// The gateway already did: token check, STAFF role check, rate limit, body size and JSON check, timeout, safe errors.
// These routes only check the shape of the input and call the service-only database functions from 6D-1A
// (admin_*_for). The user id comes from the verified token, NEVER from the request body.
// The database stays the source of truth for the rules (caps, overlaps, open bookings, transfers, time slots).
//
// POST /api/admin-slot-capacity-set  body: dateKey, slotTime, maxBowls, maxSlots?, closed   -> 200 { ok, result }
// POST /api/admin-slot-transfer      body: reservationId, newDateKey, newSlotTime            -> 200 { ok, result }
// POST /api/admin-time-slot-add      body: label                                             -> 200 { ok, result }
// POST /api/admin-time-slot-rename   body: oldLabel, newLabel                                -> 200 { ok, result }
// POST /api/admin-time-slot-delete   body: label                                             -> 200 { ok, result }
import { HttpError } from '../gateway/errors.js';
import type { RouteContext, RouteDef, RouteResult } from '../gateway/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_LABEL = 40;

export function adminSlotCapacityRoutes(getClient: () => any): RouteDef[] {
  const common = {
    method: 'POST' as const,
    access: 'staff' as const, // slot capacity is staff level (as the database functions are)
    timeoutMs: 9000,
    maxBodyBytes: 10000,
    rateLimit: { max: 60, windowSeconds: 60 },
  };
  return [
    // Global Actions save one window per call, so this route gets a higher limit.
    { ...common, rateLimit: { max: 200, windowSeconds: 60 }, path: '/admin-slot-capacity-set', handle: (ctx) => setCapacity(ctx, getClient()) },
    { ...common, path: '/admin-slot-transfer', handle: (ctx) => transfer(ctx, getClient()) },
    { ...common, path: '/admin-time-slot-add', handle: (ctx) => addSlot(ctx, getClient()) },
    { ...common, path: '/admin-time-slot-rename', handle: (ctx) => renameSlot(ctx, getClient()) },
    { ...common, path: '/admin-time-slot-delete', handle: (ctx) => deleteSlot(ctx, getClient()) },
  ];
}

function bad(message: string, code: string): never {
  throw new HttpError(400, message, code);
}

// A real calendar date written YYYY-MM-DD.
function readDateKey(value: unknown, message: string, code: string): string {
  const v = typeof value === 'string' ? value.trim() : '';
  const m = DATE_RE.exec(v);
  if (!m) bad(message, code);
  const d = new Date(Date.UTC(Number(m![1]), Number(m![2]) - 1, Number(m![3])));
  if (d.toISOString().slice(0, 10) !== v) bad(message, code);
  return v;
}

function readLabel(value: unknown, message: string, code: string): string {
  const v = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!v || v.length > MAX_LABEL) bad(message, code);
  return v;
}

function readInt(value: unknown, min: number, max: number, message: string, code: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) bad(message, code);
  return value as number;
}

// Turns a database refusal into a safe answer. The slot functions raise their own readable messages for rule
// problems (those are passed on, shortened); anything unexpected is logged and answered generically.
function fail(error: any): never {
  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  if (code === '28000') throw new HttpError(401, 'Please sign in again.', 'not_signed_in');
  if (code === '42501' || /unauthori[sz]ed|not authori[sz]ed|permission denied/i.test(msg)) {
    console.error('admin-slot-capacity: refused by the database:', code, msg);
    throw new HttpError(403, 'Only staff can change slot capacity.', 'forbidden');
  }
  if (['P0001', '22023'].includes(code)) {
    throw new HttpError(400, msg.slice(0, 300) || 'The change was not accepted.', 'slot_rejected');
  }
  if (['22P02', '22003', '23514', '23502', '23503', '23505'].includes(code)) {
    console.error('admin-slot-capacity: rejected:', code, msg);
    throw new HttpError(400, 'The values were not accepted. Please check them and try again.', 'slot_rejected');
  }
  console.error('admin-slot-capacity: database error:', code, msg);
  throw new HttpError(500, 'The slot change could not be saved. Nothing was changed. Please try again.', 'slot_failed');
}

// Some of these functions can also answer { success: false, message } instead of raising an error.
function done(data: any): RouteResult {
  if (data && typeof data === 'object' && data.success === false) {
    throw new HttpError(400, String(data.message || 'The change was not accepted.').slice(0, 300), 'slot_rejected');
  }
  return { status: 200, body: { ok: true, result: data ?? null } };
}

async function setCapacity(ctx: RouteContext, db: any): Promise<RouteResult> {
  const b = ctx.body;
  const dateKey = readDateKey(b.dateKey, 'Choose a valid date.', 'invalid_date');
  const slotTime = readLabel(b.slotTime, 'Choose a time slot.', 'invalid_slot');
  const maxBowls = readInt(b.maxBowls, 1, 1000, 'Max bowls must be a whole number from 1 to 1000.', 'invalid_max_bowls');
  const maxSlots = b.maxSlots === undefined || b.maxSlots === null ? null : readInt(b.maxSlots, 0, 1000, 'Max slots must be a whole number from 0 to 1000.', 'invalid_max_slots');
  if (typeof b.closed !== 'boolean') bad('Say whether the slot is closed.', 'invalid_closed');
  const { data, error } = await db.rpc('admin_set_slot_capacity_for', {
    p_uid: ctx.identity!.userId, p_date_key: dateKey, p_slot_time: slotTime, p_max_bowls: maxBowls, p_max_slots: maxSlots, p_closed: b.closed,
  });
  if (error) fail(error);
  return done(data);
}

async function transfer(ctx: RouteContext, db: any): Promise<RouteResult> {
  const b = ctx.body;
  const id = typeof b.reservationId === 'string' ? b.reservationId.trim() : '';
  if (!UUID_RE.test(id)) bad('Choose a valid reservation.', 'invalid_reservation');
  const newDate = readDateKey(b.newDateKey, 'Choose a valid target date.', 'invalid_date');
  const newSlot = readLabel(b.newSlotTime, 'Choose a target time slot.', 'invalid_slot');
  const { data, error } = await db.rpc('admin_transfer_slot_for', { p_uid: ctx.identity!.userId, p_reservation_id: id, p_new_date_key: newDate, p_new_slot_time: newSlot });
  if (error) fail(error);
  return done(data);
}

async function addSlot(ctx: RouteContext, db: any): Promise<RouteResult> {
  const label = readLabel(ctx.body.label, 'Enter the time slot (up to 40 characters).', 'invalid_label');
  const { data, error } = await db.rpc('admin_add_time_slot_for', { p_uid: ctx.identity!.userId, p_label: label });
  if (error) fail(error);
  return done(data);
}

async function renameSlot(ctx: RouteContext, db: any): Promise<RouteResult> {
  const oldLabel = readLabel(ctx.body.oldLabel, 'Choose the time slot to change.', 'invalid_label');
  const newLabel = readLabel(ctx.body.newLabel, 'Enter the new time slot (up to 40 characters).', 'invalid_label');
  const { data, error } = await db.rpc('admin_rename_time_slot_for', { p_uid: ctx.identity!.userId, p_old_label: oldLabel, p_new_label: newLabel });
  if (error) fail(error);
  return done(data);
}

async function deleteSlot(ctx: RouteContext, db: any): Promise<RouteResult> {
  const label = readLabel(ctx.body.label, 'Choose the time slot to remove.', 'invalid_label');
  const { data, error } = await db.rpc('admin_delete_time_slot_for', { p_uid: ctx.identity!.userId, p_label: label });
  if (error) fail(error);
  return done(data);
}
