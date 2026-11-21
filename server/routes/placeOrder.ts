// Gateway route: a signed-in customer places an order (Step 5E-2).
// POST /api/place-order, body: { order: { ...the same fields checkout.tsx has always sent... } }
// The gateway already did: token check, "signed in with a profile" check, global rate limit, body size and JSON check,
// timeout, safe errors. This file does two things only:
//   1. validate and trim the order to the fields the database function reads (anything else is dropped);
//   2. call public.place_order_for(customer id, order) with the SERVICE key. The customer id comes from the verified
//      token (ctx.identity.userId), never from the body.
// All prices, the delivery fee, promo checks, the slot reservation and the idempotency key are decided inside the
// database function, exactly as before. The answer is { ok: true, order } with the saved order row, the same row the
// browser used to get back from the database directly.
// Server environment: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (used by server/db/client.ts).
import { HttpError } from '../gateway/errors.js';
import type { RouteContext, RouteDef, RouteResult, ValidationResult } from '../gateway/types.js';

const MAX_LINES = 60;
const MAX_OPTIONS = 40;
const MAX_PROMOS = 10;

const bad = (msg: string): ValidationResult => ({ ok: false, error: msg });
const isStr = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
const isId = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 100) || (typeof v === 'number' && Number.isFinite(v));

// Optional text field: a string within the limit, or missing. Returns undefined when missing.
function text(o: Record<string, unknown>, key: string, max: number): string | undefined | null {
  const v = o[key];
  if (v === undefined || v === null) return undefined;
  return isStr(v, max) ? (v as string) : null; // null = invalid
}

export function validatePlaceOrder(body: Record<string, unknown>): ValidationResult {
  const o = body.order as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return bad('Invalid order.');

  const out: Record<string, unknown> = {};
  const fields: Array<[string, number]> = [
    ['name', 120], ['email', 254], ['phone', 40], ['fulfillment', 20], ['location', 500], ['landmark', 300],
    ['orderType', 20], ['scheduleInfo', 300], ['deliveryOption', 20], ['dateKey', 20], ['slotTime', 20],
  ];
  for (const [key, max] of fields) {
    const v = text(o, key, max);
    if (v === null) return bad('Invalid order.');
    if (v !== undefined) out[key] = v;
  }

  const key = o.idempotencyKey;
  if (typeof key !== 'string' || key.length < 8 || key.length > 100) return bad('Invalid order.');
  out.idempotencyKey = key;

  for (const k of ['deliveryLat', 'deliveryLng']) {
    const v = o[k];
    if (v === undefined || v === null) { out[k] = null; continue; }
    if (typeof v !== 'number' || !Number.isFinite(v)) return bad('Invalid order.');
    out[k] = v;
  }

  const promos = o.promoCodesList === undefined || o.promoCodesList === null ? [] : o.promoCodesList;
  if (!Array.isArray(promos) || promos.length > MAX_PROMOS || !promos.every((p) => isStr(p, 50))) return bad('Invalid order.');
  out.promoCodesList = promos;

  const items = o.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_LINES) return bad('Your cart is empty or too large.');
  const cleanItems: Array<Record<string, unknown>> = [];
  for (const it of items) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return bad('Invalid order.');
    const line = it as Record<string, unknown>;
    const qty = line.quantity;
    if (!isId(line.menuItemId) || typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 99) return bad('Invalid order.');
    const opts = line.options === undefined || line.options === null ? [] : line.options;
    if (!Array.isArray(opts) || opts.length > MAX_OPTIONS) return bad('Invalid order.');
    const cleanOpts: Array<Record<string, unknown>> = [];
    for (const op of opts) {
      if (!op || typeof op !== 'object' || Array.isArray(op)) return bad('Invalid order.');
      const oo = op as Record<string, unknown>;
      if (!isId(oo.groupId) || !isId(oo.optionId)) return bad('Invalid order.');
      cleanOpts.push({ groupId: oo.groupId, optionId: oo.optionId });
    }
    const summary = line.customizationsSummary === undefined || line.customizationsSummary === null ? '' : line.customizationsSummary;
    if (!isStr(summary, 500)) return bad('Invalid order.');
    cleanItems.push({ menuItemId: line.menuItemId, quantity: qty, options: cleanOpts, customizationsSummary: summary });
  }
  out.items = cleanItems;

  return { ok: true, value: { order: out } };
}

export function placeOrderRoute(getClient: () => any): RouteDef {
  return {
    method: 'POST',
    path: '/place-order',
    access: 'customer',                          // any signed-in user with a profile (the database function also needs a customer id)
    timeoutMs: 9000,                             // just under the Free plan limit of about 10 s
    maxBodyBytes: 60_000,                        // a full cart is a few KB
    rateLimit: { max: 15, windowSeconds: 60 },   // per caller IP; a shop's shared wifi stays well under this
    validate: validatePlaceOrder,
    handle: (ctx) => handle(ctx, getClient()),
  };
}

async function handle(ctx: RouteContext, admin: any): Promise<RouteResult> {
  const caller = ctx.identity!; // 'customer' route: the gateway guarantees a verified identity
  const order = (ctx.body as Record<string, any>).order;

  const { data, error } = await admin.rpc('place_order_for', { p_uid: caller.userId, p_order: order });
  if (error) {
    const code = String(error.code || '');
    const msg = String(error.message || '');
    // P0001 = a message the database function raised on purpose for the customer (slot full, invalid promo, ...).
    if (code === 'P0001') {
      if (msg === 'Sign in required') throw new HttpError(401, 'Sign in required.');
      throw new HttpError(400, msg.slice(0, 300) || 'Order could not be saved.');
    }
    // anything else: log a short line (no order data) and give a safe answer
    console.error(`place-order ${ctx.requestId}: database error ${code}: ${msg.slice(0, 200)}`);
    throw new HttpError(500, 'Your order could not be saved. Please try again.');
  }
  if (!data) {
    console.error(`place-order ${ctx.requestId}: the database function returned no order`);
    throw new HttpError(500, 'Your order could not be saved. Please try again.');
  }
  return { status: 200, body: { ok: true, order: data } };
}
