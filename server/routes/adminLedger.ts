// Gateway routes: Ledger writes (Step 6B-3). Admin only.
// The gateway already did: token check, ADMIN role check, rate limit, body size and JSON check, timeout, safe errors.
// These routes only check the shape of the input and call the service-only database functions from 6B-2
// (admin_ledger_*_for). The user id comes from the verified token, NEVER from the request body.
// The database stays the source of truth for the rules (kinds, categories, centavos, voided entries cannot be edited).
//
// POST /api/admin-ledger-add     body: kind, occurredAt, description, category, amountCentavos, notes?   -> 201 { ok, id }
// POST /api/admin-ledger-update  body: id + the same fields                                              -> 200 { ok }
// POST /api/admin-ledger-void    body: id                                                                -> 200 { ok }
import { HttpError } from '../gateway/errors.js';
import type { RouteContext, RouteDef, RouteResult } from '../gateway/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function adminLedgerRoutes(getClient: () => any): RouteDef[] {
  const common = {
    method: 'POST' as const,
    access: 'admin' as const,                      // ledger writes are admin only (Step 3 decision 1)
    timeoutMs: 9000,
    maxBodyBytes: 20000,
    rateLimit: { max: 60, windowSeconds: 60 },
  };
  return [
    { ...common, path: '/admin-ledger-add', handle: (ctx) => addEntry(ctx, getClient()) },
    { ...common, path: '/admin-ledger-update', handle: (ctx) => updateEntry(ctx, getClient()) },
    { ...common, path: '/admin-ledger-void', handle: (ctx) => voidEntry(ctx, getClient()) },
  ];
}

function bad(message: string, code: string): never {
  throw new HttpError(400, message, code);
}

function readId(body: Record<string, unknown>): string {
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!UUID_RE.test(id)) bad('Choose a valid ledger entry.', 'invalid_id');
  return id;
}

function readEntry(body: Record<string, unknown>) {
  const kind = typeof body.kind === 'string' ? body.kind.trim() : '';
  if (!kind || kind.length > 40) bad('Choose the entry type.', 'invalid_kind');

  const rawDate = typeof body.occurredAt === 'string' ? body.occurredAt.trim() : '';
  const ms = rawDate.length > 0 && rawDate.length <= 40 ? Date.parse(rawDate) : NaN;
  if (Number.isNaN(ms)) bad('Enter a valid date.', 'invalid_date');

  const description = typeof body.description === 'string' ? body.description.trim().replace(/\s+/g, ' ') : '';
  if (!description || description.length > 200) bad('Enter a description (1-200 characters).', 'invalid_description');

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  if (!category || category.length > 60) bad('Choose a category.', 'invalid_category');

  const amount = body.amountCentavos;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount)) bad('Enter the amount in whole centavos.', 'invalid_amount');

  let notes: string | null = null;
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string' || body.notes.length > 1000) bad('Notes can be up to 1000 characters.', 'invalid_notes');
    notes = (body.notes as string).trim() || null;
  }

  return {
    p_kind: kind,
    p_occurred_at: new Date(ms).toISOString(),
    p_description: description,
    p_category: category,
    p_amount_centavos: amount as number,
    p_notes: notes,
  };
}

// Turns a database refusal into a safe answer. The ledger functions raise their own readable messages for rule
// problems (those are passed on, shortened); anything unexpected is logged and answered generically.
function fail(error: any): never {
  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  if (code === '28000') throw new HttpError(401, 'Please sign in again.', 'not_signed_in');
  if (code === '42501' || /unauthori[sz]ed|permission denied/i.test(msg)) {
    console.error('admin-ledger: refused by the database:', code, msg);
    throw new HttpError(403, 'Only administrators can change the ledger.', 'forbidden');
  }
  if (['P0001', '22023', '22P02', '22003', '23514', '23502'].includes(code)) {
    throw new HttpError(400, msg.slice(0, 200) || 'The entry was not accepted.', 'ledger_rejected');
  }
  console.error('admin-ledger: database error:', code, msg);
  throw new HttpError(500, 'The ledger could not be updated. Nothing was saved. Please try again.', 'ledger_failed');
}

async function addEntry(ctx: RouteContext, db: any): Promise<RouteResult> {
  const entry = readEntry(ctx.body);
  const { data, error } = await db.rpc('admin_ledger_add_entry_for', { p_uid: ctx.identity!.userId, ...entry });
  if (error) fail(error);
  return { status: 201, body: { ok: true, id: data } };
}

async function updateEntry(ctx: RouteContext, db: any): Promise<RouteResult> {
  const id = readId(ctx.body);
  const entry = readEntry(ctx.body);
  const { error } = await db.rpc('admin_ledger_update_entry_for', { p_uid: ctx.identity!.userId, p_id: id, ...entry });
  if (error) fail(error);
  return { status: 200, body: { ok: true } };
}

async function voidEntry(ctx: RouteContext, db: any): Promise<RouteResult> {
  const id = readId(ctx.body);
  const { error } = await db.rpc('admin_ledger_void_entry_for', { p_uid: ctx.identity!.userId, p_id: id });
  if (error) fail(error);
  return { status: 200, body: { ok: true } };
}
