// Gateway route: reverse geocoding of an order's pinned location (moved from api/order-geocode.ts, Step 4C-3).
// The pinned coordinates are stored in public.order_delivery_private (staff-only). This route turns them into a
// readable "map address" and saves it next to them. The address is ADMIN-ONLY: it is never returned to the browser
// of a customer, and it never touches the address the customer typed (orders.location).
//
// Access level 'optional' (new in 4C-3): the gateway verifies a token if one is sent, and otherwise lets the call
// through with identity = null. This route then decides:
//   1. CUSTOMER call (right after checkout). Body: { orderId, idempotencyKey }. The order id and the order's secret
//      idempotency key must match. If the order belongs to an account, the caller must be signed in as that owner.
//      Only 'pending' pins are processed and a failure marks the pin 'failed', so a customer can trigger at most
//      ONE outbound lookup per order. Answer: { ok: true } only (no address).
//   2. STAFF call (dashboard). Needs a signed-in employee or admin. Body: { orderIds: string[], force?: boolean }.
//      Fills pending pins (and failed ones when force is true). At most 3 orders per call, spaced out to respect the
//      public Nominatim usage policy (max 1 request per second, identifying User-Agent).
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
    if (!r.ok) return null;
    const d: any = await r.json();
    const name = typeof d?.display_name === 'string' ? d.display_name.trim().slice(0, 500) : '';
    return name || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function orderGeocodeRoute(getClient: () => any, deps: GeocodeDeps = {}): RouteDef {
  return {
    method: 'POST',
    path: '/order-geocode',
    access: 'optional',                          // guests may call the customer mode; staff mode checks the role below
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
  const identity = ctx.identity; // null = anonymous visitor (no token, or a token that is not valid)

  // Fill one pin. onlyPending=true: never retry a pin that already failed (customer calls).
  const fill = async (orderId: string, onlyPending: boolean): Promise<string> => {
    const { data: row } = await admin.from('order_delivery_private')
      .select('order_id,delivery_lat,delivery_lng,map_address_status').eq('order_id', orderId).maybeSingle();
    if (!row) return 'missing';
    if (row.map_address_status === 'ok') return 'ok';
    if (onlyPending && row.map_address_status !== 'pending') return row.map_address_status;
    const address = await geocode(Number(row.delivery_lat), Number(row.delivery_lng));
    const stamp = new Date(now()).toISOString();
    await admin.from('order_delivery_private').update(
      address
        ? { map_address: address, map_address_status: 'ok', map_address_at: stamp, updated_at: stamp }
        : { map_address_status: 'failed', map_address_at: stamp, updated_at: stamp },
    ).eq('order_id', orderId).eq('delivery_lat', row.delivery_lat).eq('delivery_lng', row.delivery_lng); // skip if the pin moved meanwhile
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
  // GUEST-ORDER BRANCH: an order with no user_id was placed by a guest. When guest checkout is removed (master plan,
  // waiting-for-owner item 4), change this route's access to 'customer' and delete the "no user_id" case.
  if (order.user_id) {
    if (!identity || identity.userId !== order.user_id) throw new HttpError(403, FORBIDDEN);
  }
  await fill(orderId, true);
  return { status: 200, body: { ok: true } }; // deliberately returns nothing about the address
}
