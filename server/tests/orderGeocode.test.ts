// Tests for the order-geocode route (Step 4C-3). Run from the project root:  npx tsx --test server/tests/orderGeocode.test.ts
// They go through the real gateway with a fake identity lookup, a fake database and a fake geocoder:
// no network, no Supabase key, no call to the real map service.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../gateway/gateway.js';
import { orderGeocodeRoute, reverseGeocode } from '../routes/orderGeocode.js';
import type { Identity } from '../gateway/types.js';

const O1 = '11111111-1111-4111-8111-111111111111';
const O2 = '22222222-2222-4222-8222-222222222222';
const O3 = '33333333-3333-4333-8333-333333333333';
const O4 = '44444444-4444-4444-8444-444444444444';
const O5 = '55555555-5555-4555-8555-555555555555'; // an old order with no owner
const KEY = 'secret-key-1234';

const TOKENS: Record<string, Identity> = {
  'owner-token': { userId: 'u-owner', role: 'regular' },
  'other-token': { userId: 'u-other', role: 'regular' },
  'employee-token': { userId: 'u-employee', role: 'employee' },
  'admin-token': { userId: 'u-admin', role: 'admin' },
};
const resolveIdentity = async (token: string) => {
  if (token === 'boom') throw new Error('database down');
  return TOKENS[token] || null;
};

// ---- a tiny fake of the Supabase calls this route uses ----
type Row = Record<string, any>;
interface DbOpts { failUpdate?: boolean; failReadOf?: string; updateMatchesNothing?: boolean }
function fakeDb(tables: Record<string, Row[]>, opts: DbOpts = {}) {
  const updates: { table: string; patch: Row; filters: Row }[] = [];
  const client = {
    from(table: string) {
      const filters: Row = {};
      let patch: Row | null = null;
      let wantRows = false;
      const match = () => (tables[table] || []).filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
      const api: any = {
        select() { if (patch) wantRows = true; return api; },
        update(p: Row) { patch = p; return api; },
        eq(k: string, v: any) { filters[k] = v; return api; },
        maybeSingle: async () => (opts.failReadOf === table
          ? { data: null, error: { message: 'read failed' } }
          : { data: match()[0] ? { ...match()[0] } : null, error: null }),
        then(resolve: any) {
          if (patch && opts.failUpdate) return resolve({ data: null, error: { message: 'update failed' } });
          const rows = patch && opts.updateMatchesNothing ? [] : match();
          if (patch) { updates.push({ table, patch, filters: { ...filters } }); rows.forEach((r) => Object.assign(r, patch)); }
          resolve({ data: wantRows ? rows.map((r) => ({ order_id: r.order_id })) : null, error: null });
        },
      };
      return api;
    },
  };
  return { client, updates };
}

async function captureLogs<T>(fn: () => Promise<T>) {
  const lines: string[] = [];
  const e = console.error, w = console.warn;
  console.error = (...a: any[]) => { lines.push(a.join(' ')); };
  console.warn = (...a: any[]) => { lines.push(a.join(' ')); };
  try { return { result: await fn(), lines }; } finally { console.error = e; console.warn = w; }
}

function setup(opts: { pins?: Row[]; orders?: Row[]; db?: DbOpts; geocode?: (lat: number, lng: number) => Promise<string | null> } = {}) {
  const tables = {
    orders: opts.orders || [
      { id: O1, user_id: 'u-owner', idempotency_key: KEY },            // order of a signed-in customer
      { id: O2, user_id: 'u-owner', idempotency_key: KEY },            // another order of the same customer
      { id: O5, user_id: null, idempotency_key: KEY },                 // old order with no owner (an old guest order or a staff walk-in)
    ],
    order_delivery_private: opts.pins || [
      { order_id: O1, delivery_lat: 10.1, delivery_lng: 122.1, map_address_status: 'pending', map_address: null },
      { order_id: O2, delivery_lat: 10.2, delivery_lng: 122.2, map_address_status: 'pending', map_address: null },
    ],
  };
  const db = fakeDb(tables, opts.db);
  const calls: [number, number][] = [];
  let clock = 1_000_000;
  const inner = opts.geocode || (async (lat: number, lng: number) => `Address for ${lat},${lng}`);
  const geocode = async (lat: number, lng: number) => { calls.push([lat, lng]); clock += 200; return inner(lat, lng); };
  const route = orderGeocodeRoute(() => db.client, { geocode, sleep: async (ms) => { clock += ms; }, now: () => clock });
  const gateway = createGateway({ routes: [route], resolveIdentity, log: () => {} });
  return { tables, db, calls, gateway, advance: (ms: number) => { clock += ms; }, setClock: (ms: number) => { clock = ms; } };
}

function post(gateway: (req: any, res: any) => Promise<void>, body: any, token?: string, ip = '1.1.1.1', method = 'POST') {
  const headers: Record<string, string> = { 'x-forwarded-for': ip };
  if (token) headers.authorization = 'Bearer ' + token;
  const out: { status: number; body: any } = { status: 0, body: undefined };
  const res = { setHeader() {}, status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; } };
  return gateway({ method, url: '/api/order-geocode', headers, body }, res).then(() => out);
}

// ---------------- customer mode ----------------
test('customer: right order id + key, signed in as the owner -> 200, one lookup, address saved, nothing about it returned', async () => {
  const t = setup();
  const r = await post(t.gateway, { orderId: O1, idempotencyKey: KEY }, 'owner-token');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(t.calls.length, 1);
  assert.equal(t.tables.order_delivery_private[0].map_address_status, 'ok');
  assert.equal(t.tables.order_delivery_private[0].map_address, 'Address for 10.1,122.1');
});

test('customer: wrong key, missing key, short key, unknown order -> no lookup', async () => {
  const t = setup();
  assert.equal((await post(t.gateway, { orderId: O1, idempotencyKey: 'wrong-key-9999' }, 'owner-token')).status, 403);
  assert.equal((await post(t.gateway, { orderId: O3, idempotencyKey: KEY }, 'owner-token')).status, 403);
  assert.equal((await post(t.gateway, { orderId: O1 }, 'owner-token')).status, 400);
  assert.equal((await post(t.gateway, { orderId: O1, idempotencyKey: 'short' }, 'owner-token')).status, 400);
  assert.equal((await post(t.gateway, { orderId: 'not-a-uuid', idempotencyKey: KEY }, 'owner-token')).status, 400);
  assert.equal((await post(t.gateway, { orderId: O1, idempotencyKey: 'x'.repeat(101) }, 'owner-token')).status, 400);
  assert.equal(t.calls.length, 0);
});

test('no token, or a token that is not valid: 401 before the route runs, no lookup (guests are gone)', async () => {
  const t = setup();
  const body = { orderId: O1, idempotencyKey: KEY };
  assert.equal((await post(t.gateway, body)).status, 401);
  assert.equal((await post(t.gateway, body, 'expired-token')).status, 401);
  assert.equal(t.calls.length, 0);
});

test('an order with no owner (old guest order or staff walk-in) is never filled in from customer mode', async () => {
  const t = setup();
  const body = { orderId: O5, idempotencyKey: KEY };
  assert.equal((await post(t.gateway, body, 'owner-token')).status, 403);
  assert.equal((await post(t.gateway, body, 'other-token')).status, 403);
  assert.equal(t.calls.length, 0);
  assert.equal(t.tables.order_delivery_private.find((p: any) => p.order_id === O5), undefined);
});

test('order of a signed-in customer: no token = 401, other customer = 403, owner = 200', async () => {
  const t = setup();
  const body = { orderId: O2, idempotencyKey: KEY };
  assert.equal((await post(t.gateway, body)).status, 401);
  assert.equal((await post(t.gateway, body, 'other-token')).status, 403);
  assert.equal((await post(t.gateway, body, 'expired-token')).status, 401);
  assert.equal(t.calls.length, 0);
  assert.equal((await post(t.gateway, body, 'owner-token')).status, 200);
  assert.equal(t.calls.length, 1);
});

test('customer mode only works once per order: a failed or finished pin is never looked up again', async () => {
  const t = setup({ pins: [
    { order_id: O1, delivery_lat: 1, delivery_lng: 2, map_address_status: 'failed', map_address: null },
    { order_id: O2, delivery_lat: 3, delivery_lng: 4, map_address_status: 'ok', map_address: 'Done' },
  ] });
  assert.equal((await post(t.gateway, { orderId: O1, idempotencyKey: KEY }, 'owner-token')).status, 200);
  assert.equal((await post(t.gateway, { orderId: O2, idempotencyKey: KEY }, 'owner-token')).status, 200);
  assert.equal(t.calls.length, 0);
  assert.equal(t.tables.order_delivery_private[0].map_address_status, 'failed');
  assert.equal(t.tables.order_delivery_private[1].map_address, 'Done');
});

test('customer mode: geocoder fails -> pin marked failed, answer is still { ok: true }; order without a pin -> 200', async () => {
  const t = setup({ geocode: async () => null });
  const r = await post(t.gateway, { orderId: O1, idempotencyKey: KEY }, 'owner-token');
  assert.deepEqual(r.body, { ok: true });
  assert.equal(t.tables.order_delivery_private[0].map_address_status, 'failed');
  const t2 = setup({ pins: [] });
  assert.equal((await post(t2.gateway, { orderId: O1, idempotencyKey: KEY }, 'owner-token')).status, 200);
  assert.equal(t2.calls.length, 0);
});

test('the save is by order id only (no exact-number match on the pin, which never matched the real data)', async () => {
  const t = setup();
  await post(t.gateway, { orderId: O1, idempotencyKey: KEY }, 'owner-token');
  const u = t.db.updates[0];
  assert.equal(u.table, 'order_delivery_private');
  assert.deepEqual(u.filters, { order_id: O1 });
});

test('the save works for a pin with long decimals', async () => {
  const t = setup({ pins: [{ order_id: O1, delivery_lat: 10.3418767278971, delivery_lng: 123.911652359402, map_address_status: 'pending', map_address: null }] });
  await post(t.gateway, { orderId: O1, idempotencyKey: KEY }, 'owner-token');
  assert.equal(t.tables.order_delivery_private[0].map_address_status, 'ok');
});

test('pin moved while the lookup was running: nothing is saved', async () => {
  let t: any;
  t = setup({ geocode: async () => { t.tables.order_delivery_private[0].delivery_lat = 11.5; return 'Old pin address'; } });
  const r = await post(t.gateway, { orderIds: [O1] }, 'employee-token');
  assert.equal(r.body.results[O1], 'moved');
  assert.equal(t.tables.order_delivery_private[0].map_address_status, 'pending');
  assert.equal(t.tables.order_delivery_private[0].map_address, null);
});

test('database problems are logged (without addresses, coordinates or keys) and reported as error; the customer still gets { ok: true }', async () => {
  const cases: [string, DbOpts][] = [['save', { failUpdate: true }], ['read', { failReadOf: 'order_delivery_private' }], ['no row changed', { updateMatchesNothing: true }]];
  for (const [name, db] of cases) {
    const t = setup({ db });
    const { result: staff, lines } = await captureLogs(() => post(t.gateway, { orderIds: [O1] }, 'employee-token'));
    assert.equal(staff.status, 200, name);
    assert.equal(staff.body.results[O1], 'error', name);
    assert.ok(lines.some((l) => l.includes('order-geocode')), name);
    const text = lines.join('\n');
    assert.ok(!text.includes('Address for') && !text.includes('10.1') && !text.includes(KEY), name);
    const t2 = setup({ db });
    const { result: cust } = await captureLogs(() => post(t2.gateway, { orderId: O1, idempotencyKey: KEY }, 'owner-token'));
    assert.deepEqual(cust.body, { ok: true }, name);
  }
});

test('map service: an error answer or a failed call is logged by status or name only; a good answer returns the address', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = (async () => ({ ok: false, status: 403, json: async () => ({}) })) as any;
    const denied = await captureLogs(() => reverseGeocode(10.1, 122.1));
    assert.equal(denied.result, null);
    assert.ok(denied.lines.some((l) => l.includes('HTTP 403')));
    globalThis.fetch = (async () => { const e: any = new Error('x'); e.name = 'AbortError'; throw e; }) as any;
    const slow = await captureLogs(() => reverseGeocode(10.1, 122.1));
    assert.equal(slow.result, null);
    assert.ok(slow.lines.some((l) => l.includes('AbortError')));
    assert.ok(!slow.lines.join('').includes('10.1'));
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ display_name: '  Some Street, Cebu  ' }) })) as any;
    assert.equal(await reverseGeocode(10.1, 122.1), 'Some Street, Cebu');
  } finally { globalThis.fetch = real; }
});

// ---------------- staff mode ----------------
test('staff mode: no token = 401, invalid token = 401, customer = 403, lookup failure = 503', async () => {
  const t = setup();
  const body = { orderIds: [O1] };
  assert.equal((await post(t.gateway, body)).status, 401);
  assert.equal((await post(t.gateway, body, 'expired-token')).status, 401);
  assert.equal((await post(t.gateway, body, 'owner-token')).status, 403);
  assert.equal((await post(t.gateway, body, 'boom')).status, 503);
  assert.equal(t.calls.length, 0);
});

test('staff mode: employee and admin can fill pending pins; results are returned per order', async () => {
  const t = setup();
  const r = await post(t.gateway, { orderIds: [O1, O2] }, 'employee-token');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, results: { [O1]: 'ok', [O2]: 'ok' } });
  const t2 = setup();
  assert.equal((await post(t2.gateway, { orderIds: [O1] }, 'admin-token')).status, 200);
});

test('staff mode: at most 3 orders, invalid ids dropped, already-ok pins not looked up again', async () => {
  const pins = [O1, O2, O3, O4].map((id, i) => ({ order_id: id, delivery_lat: i, delivery_lng: i, map_address_status: i === 0 ? 'ok' : 'pending', map_address: null }));
  const t = setup({ pins });
  const r = await post(t.gateway, { orderIds: ['bad', O1, O2, O3, O4] }, 'employee-token');
  assert.deepEqual(Object.keys(r.body.results), [O1, O2, O3]);
  assert.equal(r.body.results[O1], 'ok');
  assert.equal(t.calls.length, 2); // O1 was already ok
});

test('staff mode: failed pins are retried only with force: true', async () => {
  const pins = [{ order_id: O1, delivery_lat: 1, delivery_lng: 2, map_address_status: 'failed', map_address: null }];
  const t = setup({ pins });
  const plain = await post(t.gateway, { orderIds: [O1] }, 'employee-token');
  assert.equal(plain.body.results[O1], 'failed');
  assert.equal(t.calls.length, 0);
  const forced = await post(t.gateway, { orderIds: [O1], force: true }, 'employee-token');
  assert.equal(forced.body.results[O1], 'ok');
  assert.equal(t.calls.length, 1);
});

test('staff mode: a slow geocoder cannot push the call past its time budget (new lookups stop after 4 s)', async () => {
  const pins = [O1, O2, O3].map((id, i) => ({ order_id: id, delivery_lat: i, delivery_lng: i, map_address_status: 'pending', map_address: null }));
  let clock = 0;
  const db = fakeDb({ orders: [], order_delivery_private: pins });
  const route = orderGeocodeRoute(() => db.client, {
    geocode: async () => { clock += 3000; return 'Slow address'; },
    sleep: async (ms) => { clock += ms; },
    now: () => clock,
  });
  const gateway = createGateway({ routes: [route], resolveIdentity, log: () => {} });
  const r = await post(gateway, { orderIds: [O1, O2, O3] }, 'employee-token');
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body.results), [O1, O2]); // the third is left for the next call
});

// ---------------- gateway rules that apply to this route ----------------
test('only POST is allowed; the route has its own rate limit; the body is size-limited', async () => {
  const t = setup();
  const get = await post(t.gateway, undefined, undefined, '1.1.1.1', 'GET');
  assert.equal(get.status, 405);
  assert.equal((await post(t.gateway, { orderIds: ['x'.repeat(25_000)] }, 'employee-token')).status, 413);
  const t2 = setup();
  let last = 0;
  for (let i = 0; i < 31; i++) last = (await post(t2.gateway, { orderIds: [] }, 'employee-token', '5.5.5.5')).status;
  assert.equal(last, 429);
  assert.equal((await post(t2.gateway, { orderIds: [] }, 'employee-token', '6.6.6.6')).status, 200); // another caller is fine
});

test('a database error inside the route is a safe 500 that shows nothing internal', async () => {
  const route = orderGeocodeRoute(() => { throw new Error('postgres://user:pw@host failed'); });
  const gateway = createGateway({ routes: [route], resolveIdentity, log: () => {} });
  const r = await post(gateway, { orderId: O1, idempotencyKey: KEY }, 'owner-token');
  assert.equal(r.status, 500);
  assert.ok(!JSON.stringify(r.body).includes('postgres'));
});
