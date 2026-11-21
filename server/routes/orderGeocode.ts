// Gateway route: reverse geocoding of an order's pinned location (moved from api/order-geocode.ts, Step 4C-3).
// The pinned coordinates are stored in public.order_delivery_private (staff-only). This route turns them into a
// readable "map address" and saves it next to them. The address is ADMIN-ONLY: it is never returned to the browser
// of a customer, and it never touches the address the customer typed (orders.location).
//
// Access level 'customer' (Step GR-B; it was 'optional' in 4C-3 while guests could order): the gateway requires a
// signed-in user with a profile before this route runs. This route then decides:
//   1. CUSTOMER call (right after checkout). Body: { orderId, idempotencyKey }. The order id and the order's secret
//      idempotency key must match, and the caller must be the signed-in OWNER of the order. An order with no owner
//      (an old guest order or a staff walk-in) is never filled in from here; staff do those in staff mode.
//      Only 'pending' pins are processed and a failure marks the pin 'failed', so a customer can trigger at most
//      ONE outbound lookup per order. Answer: { ok: true } only (no address).
//   2. STAFF call (dashboard). Needs a signed-in employee or admin. Body: { orderIds: string[], force?: boolean }.
//      Fills pending pins (and failed ones when force is true). At most 3 orders per call, spaced out to respect the
//      public Nominatim usage policy (max 1 request per second, identifying User-Agent).
// Problems (database errors, a map service that answers with an error or times out) are written to the server log
// as short lines without the address, coordinates or keys, so they can be found in Vercel > Logs.
//
// Server environment: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (used by server/db/client.ts);
// GEOCODER_USER_AGENT is optional, e.g. "VeynsKiosk/1.0 (you@yourdomain.com)" (set a real contact address).
import { HttpError } from '../gateway/errors.js';
import type { RouteContext, RouteDef, RouteResult } from '../gateway/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STAFF_BATCH = 3;
// The gateway stops this route at 9 s. A new lookup is only started within the first 4 s, so the last one
// (up to 1.1 s pause + 3 s lookup) normally ends before the stop. The old function used 8 s.
const TIME_BUDGET_MS = 4000;
const FORBIDDEN = 'You are not allowed to do that.';

export interface GeocodeDeps {
  geocode?: (lat: number, lng: number) => Promise<string | null>; // injectable for tests
  sleep?: (ms: number) => Promise<void>;                          // injectable for tests
  now?: () => number;                                             // injectable for tests
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Same pin? Compared as numbers with a tiny tolerance (about 1 cm), never as text.
const samePin = (a: any, b: any) =>
  Math.abs(Number(a.delivery_lat) - Number(b.delivery_lat)) < 1e-7 && Math.abs(Number(a.delivery_lng) - Number(b.delivery_lng)) < 1e-7;

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=0&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`,
      {
        headers: { 'User-Agent': process.env.GEOCODER_USER_AGENT || 'VeynsKiosk/1.0 (order location verification)', 'Accept-Language': 'en' },
        signal: ctrl.signal,
      },
    );
    if (!r.ok) { console.warn(`order-geocode: map service answered HTTP ${r.status}`); return null; }
    const d: any = await r.json();
    const name = typeof d?.display_name === 'string' ? d.display_name.trim().slice(0, 500) : '';
    if (!name) console.warn('order-geocode: map service returned no address');
    return name || null;
  } catch (e: any) {
    console.warn(`order-geocode: map service call failed (${e?.name || 'error'})`); // e.g. AbortError = the 3 s limit
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function orderGeocodeRoute(getClient: () => any, deps: GeocodeDeps = {}): RouteDef {
  return {
    method: 'POST',
    path: '/order-geocode',
    access: 'customer',                          // signed-in users only (Step GR-B); staff mode checks the role below
    timeoutMs: 9000,                             // just under the Free plan limit of about 10 s
    maxBodyBytes: 20_000,                        // tighter than the default: the body is two ids or a few order ids
    rateLimit: { max: 30, windowSeconds: 60 },   // new: the old function had no rate limit (per caller IP)
    handle: (ctx) => handle(ctx, getClient(), deps),
  };
}

async function handle(ctx: RouteContext, admin: any, deps: GeocodeDeps): Promise<RouteResult> {
  const geocode = deps.geocode || reverseGeocode;
  const sleep = deps.sleep || defaultSleep;
  const now = deps.now || Date.now;
  const body = ctx.body as Record<string, any>;
  const identity = ctx.identity; // always set on a 'customer' route; the checks below stay as a second lock

  // Log a problem without any secret, address, coordinate or order key.
  const problem = (step: string, e?: { message?: string } | null) =>
    console.error(`order-geocode ${ctx.requestId}: ${step}${e?.message ? ': ' + e.message : ''}`);

  // Fill one pin. onlyPending=true: never retry a pin that already failed (customer calls).
  // Returns 'ok' | 'failed' | 'missing' | 'moved' | 'error' | the pin's current status when it is skipped.
  // The save is by order id only. (The old function also matched the exact latitude and longitude, but that
  // comparison of decimal numbers never matched, so nothing was ever saved. The pin is now re-checked in code.)
  const fill = async (orderId: string, onlyPending: boolean): Promise<string> => {
    const { data: row, error: readErr } = await admin.from('order_delivery_private')
      .select('order_id,delivery_lat,delivery_lng,map_address_status').eq('order_id', orderId).maybeSingle();
    if (readErr) { problem('could not read the pin', readErr); return 'error'; }
    if (!row) return 'missing';
    if (row.map_address_status === 'ok') return 'ok';
    if (onlyPending && row.map_address_status !== 'pending') return row.map_address_status;
    const address = await geocode(Number(row.delivery_lat), Number(row.delivery_lng));

    // skip the save if the pin was moved (or the order removed) while the lookup was running
    const { data: again, error: againErr } = await admin.from('order_delivery_private')
      .select('delivery_lat,delivery_lng').eq('order_id', orderId).maybeSingle();
    if (againErr) { problem('could not re-check the pin', againErr); return 'error'; }
    if (!again) return 'missing';
    if (!samePin(again, row)) return 'moved';

    const stamp = new Date(now()).toISOString();
    const { data: saved, error: saveErr } = await admin.from('order_delivery_private').update(
      address
        ? { map_address: address, map_address_status: 'ok', map_address_at: stamp, updated_at: stamp }
        : { map_address_status: 'failed', map_address_at: stamp, updated_at: stamp },
    ).eq('order_id', orderId).select('order_id');
    if (saveErr) { problem('could not save the result', saveErr); return 'error'; }
    if (!saved || saved.length === 0) { problem('the save changed no row'); return 'error'; }
    return address ? 'ok' : 'failed';
  };

  // ---------------- staff mode ----------------
  if (Array.isArray(body.orderIds)) {
    if (!identity) throw new HttpError(401, 'Sign in required.');
    if (identity.role !== 'employee' && identity.role !== 'admin') throw new HttpError(403, FORBIDDEN);

    const ids = (body.orderIds as any[]).map(String).filter((s) => UUID_RE.test(s)).slice(0, MAX_STAFF_BATCH);
    const started = now();
    const results: Record<string, string> = {};
    for (let i = 0; i < ids.length; i++) {
      if (now() - started > TIME_BUDGET_MS) break;
      if (i > 0) await sleep(1100);
      results[ids[i]] = await fill(ids[i], body.force !== true);
    }
    return { status: 200, body: { ok: true, results } };
  }

  // ---------------- customer mode ----------------
  const orderId = String(body.orderId || '');
  const key = String(body.idempotencyKey || '');
  if (!UUID_RE.test(orderId) || key.length < 8 || key.length > 100) throw new HttpError(400, 'Invalid request.');
  const { data: order } = await admin.from('orders').select('id,user_id,idempotency_key').eq('id', orderId).maybeSingle();
  if (!order || order.idempotency_key !== key) throw new HttpError(403, FORBIDDEN);
  // Step GR-B: guest checkout is gone, so the caller must be the owner. An order with no owner (an old guest order
  // or a staff walk-in) is never filled in from here; staff fill those in from the dashboard (staff mode above).
  if (!order.user_id || !identity || identity.userId !== order.user_id) throw new HttpError(403, FORBIDDEN);
  await fill(orderId, true);
  return { status: 200, body: { ok: true } }; // deliberately returns nothing about the address
}
