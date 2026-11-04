// Vercel serverless function: server-side reverse geocoding of an order's pinned location.
/// <reference types="node" />
//
// The pinned coordinates are stored in public.order_delivery_private (staff-only). This function turns them
// into a readable "map address" and saves it next to them. The address is ADMIN-ONLY: it is never returned to
// the browser of a customer, and it never touches the address the customer typed (orders.location).
//
// Two callers:
//   1. CUSTOMER (right after checkout). Body: { orderId, idempotencyKey }. The order id and the order's
//      secret idempotency key must match. Signed-in customers must also send their own access token and own
//      the order. Only 'pending' pins are processed, and a failure marks the pin 'failed', so a customer can
//      trigger at most ONE outbound lookup per order. Response: { ok: true } only (no address).
//   2. STAFF (dashboard). Header: Authorization: Bearer <staff token>. Body: { orderIds: string[], force?: boolean }.
//      Fills pending pins (and failed ones when force is true). At most 3 orders per call, spaced out to respect
//      the public Nominatim usage policy (max 1 request per second, identifying User-Agent).
//
// Required Vercel environment variables (same as admin-create-customer.ts):
//   SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY (SECRET, server only)
//   GEOCODER_USER_AGENT  optional, e.g. "VeynsKiosk/1.0 (you@yourdomain.com)"  (set a real contact address)
import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STAFF_BATCH = 3;
const TIME_BUDGET_MS = 8000;

function json(res: any, status: number, body: Record<string, unknown>) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { ok: false });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('order-geocode: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return json(res, 500, { ok: false });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();

  // Fill one pin. onlyPending=true: never retry a pin that already failed (customer calls).
  const fill = async (orderId: string, onlyPending: boolean) => {
    const { data: row } = await admin.from('order_delivery_private')
      .select('order_id,delivery_lat,delivery_lng,map_address_status').eq('order_id', orderId).maybeSingle();
    if (!row) return 'missing';
    if (row.map_address_status === 'ok') return 'ok';
    if (onlyPending && row.map_address_status !== 'pending') return row.map_address_status;
    const address = await reverseGeocode(Number(row.delivery_lat), Number(row.delivery_lng));
    const now = new Date().toISOString();
    await admin.from('order_delivery_private').update(
      address
        ? { map_address: address, map_address_status: 'ok', map_address_at: now, updated_at: now }
        : { map_address_status: 'failed', map_address_at: now, updated_at: now },
    ).eq('order_id', orderId).eq('delivery_lat', row.delivery_lat).eq('delivery_lng', row.delivery_lng); // skip if the pin moved meanwhile
    return address ? 'ok' : 'failed';
  };

  // ---------------- staff mode ----------------
  if (Array.isArray(body.orderIds)) {
    if (!token) return json(res, 401, { ok: false });
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller?.user) return json(res, 401, { ok: false });
    const { data: staffRow } = await admin.from('profiles').select('role')
      .eq('auth_user_id', caller.user.id).in('role', ['employee', 'admin']).maybeSingle();
    if (!staffRow) return json(res, 403, { ok: false });

    const ids = (body.orderIds as any[]).map(String).filter((s) => UUID_RE.test(s)).slice(0, MAX_STAFF_BATCH);
    const started = Date.now();
    const results: Record<string, string> = {};
    for (let i = 0; i < ids.length; i++) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      if (i > 0) await sleep(1100);
      results[ids[i]] = await fill(ids[i], body.force !== true);
    }
    return json(res, 200, { ok: true, results });
  }

  // ---------------- customer mode ----------------
  const orderId = String(body.orderId || '');
  const key = String(body.idempotencyKey || '');
  if (!UUID_RE.test(orderId) || key.length < 8 || key.length > 100) return json(res, 400, { ok: false });
  const { data: order } = await admin.from('orders').select('id,user_id,idempotency_key').eq('id', orderId).maybeSingle();
  if (!order || order.idempotency_key !== key) return json(res, 403, { ok: false });
  if (order.user_id) {
    const { data: caller } = token ? await admin.auth.getUser(token) : { data: null as any };
    if (!caller?.user || caller.user.id !== order.user_id) return json(res, 403, { ok: false });
  }
  await fill(orderId, true);
  return json(res, 200, { ok: true }); // deliberately returns nothing about the address
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}
