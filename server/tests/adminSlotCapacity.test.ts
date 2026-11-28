// Tests for the Slot Capacity gateway routes (Step 6D-2).
// Run from the project root:  npx tsx --test server/tests/adminSlotCapacity.test.ts
// Fake database client and fake identity lookup: no network, no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../gateway/gateway.js';
import { adminSlotCapacityRoutes } from '../routes/adminSlotCapacity.js';
import type { Identity } from '../gateway/types.js';

const TOKENS: Record<string, Identity> = {
  'customer-token': { userId: 'u-customer', role: 'regular' },
  'employee-token': { userId: 'u-employee', role: 'employee' },
  'admin-token': { userId: 'u-admin', role: 'admin' },
};
const resolveIdentity = async (token: string) => TOKENS[token] || null;

const ID = '3f2b8c1e-5a4d-4e7b-9c10-0a1b2c3d4e5f';
type Reply = { data: any; error: any };

function harness(rpc?: (fn: string, args: any) => Reply) {
  const calls: [string, any][] = [];
  const client = {
    rpc: async (fn: string, args: any) => { calls.push([fn, args]); return rpc ? rpc(fn, args) : { data: { success: true }, error: null }; },
  };
  const gateway = createGateway({ routes: adminSlotCapacityRoutes(() => client), resolveIdentity, log: () => {} });
  return { gateway, calls };
}

function post(g: (req: any, res: any) => Promise<void>, path: string, token: string | null, body: any, method = 'POST') {
  const headers: Record<string, string> = { 'x-forwarded-for': '1.1.1.1' };
  if (token) headers.authorization = 'Bearer ' + token;
  const req = { method, url: '/api/' + path, headers, body };
  const out: { status: number; body: any } = { status: 0, body: undefined };
  const res = { setHeader() {}, status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; } };
  return g(req, res).then(() => out);
}

const SLOT = '9:00 AM - 10:00 AM';
const BODIES: Record<string, any> = {
  'admin-slot-capacity-set': { dateKey: '2026-11-30', slotTime: SLOT, maxBowls: 12, maxSlots: 10, closed: false },
  'admin-slot-transfer': { reservationId: ID, newDateKey: '2026-12-01', newSlotTime: SLOT },
  'admin-time-slot-add': { label: SLOT },
  'admin-time-slot-rename': { oldLabel: SLOT, newLabel: '9:30 AM - 10:30 AM' },
  'admin-time-slot-delete': { label: SLOT },
};
const PATHS = Object.keys(BODIES);

test('who may call: no token 401, customer 403, GET 405; the database is never called', async () => {
  const h = harness();
  for (const p of PATHS) {
    assert.equal((await post(h.gateway, p, null, BODIES[p])).status, 401);
    assert.equal((await post(h.gateway, p, 'customer-token', BODIES[p])).status, 403);
    assert.equal((await post(h.gateway, p, 'admin-token', undefined, 'GET')).status, 405);
  }
  assert.equal(h.calls.length, 0);
});

test('staff: an employee and an admin may both use every route', async () => {
  for (const token of ['employee-token', 'admin-token']) {
    const h = harness();
    for (const p of PATHS) assert.equal((await post(h.gateway, p, token, BODIES[p])).status, 200, p);
    assert.equal(h.calls.length, PATHS.length);
  }
});

test('the user id comes from the token, never from the body', async () => {
  const h = harness();
  for (const p of PATHS) await post(h.gateway, p, 'employee-token', { ...BODIES[p], p_uid: 'u-evil', userId: 'u-evil', uid: 'u-evil' });
  assert.equal(h.calls.length, PATHS.length);
  for (const [, args] of h.calls) assert.equal(args.p_uid, 'u-employee');
});

test('set capacity: clean values go to the database; maxSlots optional', async () => {
  const h = harness();
  const r = await post(h.gateway, 'admin-slot-capacity-set', 'admin-token', BODIES['admin-slot-capacity-set']);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, result: { success: true } });
  assert.deepEqual(h.calls[0], ['admin_set_slot_capacity_for', { p_uid: 'u-admin', p_date_key: '2026-11-30', p_slot_time: SLOT, p_max_bowls: 12, p_max_slots: 10, p_closed: false }]);
  await post(h.gateway, 'admin-slot-capacity-set', 'admin-token', { ...BODIES['admin-slot-capacity-set'], maxSlots: undefined, closed: true });
  assert.equal(h.calls[1][1].p_max_slots, null);
  assert.equal(h.calls[1][1].p_closed, true);
});

test('set capacity: bad input is refused with 400 before the database is called', async () => {
  const h = harness();
  const base = BODIES['admin-slot-capacity-set'];
  const bad: [any, string][] = [
    [{ ...base, dateKey: '2026-13-40' }, 'invalid_date'],
    [{ ...base, dateKey: '2026-02-30' }, 'invalid_date'],
    [{ ...base, dateKey: 'tomorrow' }, 'invalid_date'],
    [{ ...base, slotTime: '' }, 'invalid_slot'],
    [{ ...base, slotTime: 'x'.repeat(41) }, 'invalid_slot'],
    [{ ...base, maxBowls: 0 }, 'invalid_max_bowls'],
    [{ ...base, maxBowls: 1001 }, 'invalid_max_bowls'],
    [{ ...base, maxBowls: 2.5 }, 'invalid_max_bowls'],
    [{ ...base, maxBowls: '10' }, 'invalid_max_bowls'],
    [{ ...base, maxSlots: -1 }, 'invalid_max_slots'],
    [{ ...base, closed: 'yes' }, 'invalid_closed'],
    [{ ...base, closed: undefined }, 'invalid_closed'],
  ];
  for (const [body, code] of bad) {
    const r = await post(h.gateway, 'admin-slot-capacity-set', 'admin-token', body);
    assert.equal(r.status, 400, code);
    assert.equal(r.body.code, code);
  }
  assert.equal(h.calls.length, 0);
});

test('transfer: success calls the transfer function; ids, dates and slots are checked', async () => {
  const h = harness();
  assert.equal((await post(h.gateway, 'admin-slot-transfer', 'admin-token', BODIES['admin-slot-transfer'])).status, 200);
  assert.deepEqual(h.calls[0], ['admin_transfer_slot_for', { p_uid: 'u-admin', p_reservation_id: ID, p_new_date_key: '2026-12-01', p_new_slot_time: SLOT }]);
  const base = BODIES['admin-slot-transfer'];
  for (const body of [{ ...base, reservationId: 'x' }, { ...base, reservationId: undefined }, { ...base, newDateKey: '2026-99-01' }, { ...base, newSlotTime: '' }]) {
    assert.equal((await post(h.gateway, 'admin-slot-transfer', 'admin-token', body)).status, 400);
  }
  assert.equal(h.calls.length, 1);
});

test('time slots: add, rename and delete call their functions with clean labels; bad labels refused', async () => {
  const h = harness();
  await post(h.gateway, 'admin-time-slot-add', 'admin-token', { label: '  9:00 AM   -  10:00 AM ' });
  await post(h.gateway, 'admin-time-slot-rename', 'admin-token', BODIES['admin-time-slot-rename']);
  await post(h.gateway, 'admin-time-slot-delete', 'admin-token', BODIES['admin-time-slot-delete']);
  assert.deepEqual(h.calls[0], ['admin_add_time_slot_for', { p_uid: 'u-admin', p_label: SLOT }]);
  assert.deepEqual(h.calls[1], ['admin_rename_time_slot_for', { p_uid: 'u-admin', p_old_label: SLOT, p_new_label: '9:30 AM - 10:30 AM' }]);
  assert.deepEqual(h.calls[2], ['admin_delete_time_slot_for', { p_uid: 'u-admin', p_label: SLOT }]);
  for (const [p, body] of [['admin-time-slot-add', { label: '' }], ['admin-time-slot-add', { label: 5 }], ['admin-time-slot-add', { label: 'x'.repeat(41) }],
    ['admin-time-slot-rename', { oldLabel: SLOT }], ['admin-time-slot-rename', { oldLabel: '', newLabel: SLOT }], ['admin-time-slot-delete', {}]] as [string, any][]) {
    assert.equal((await post(h.gateway, p, 'admin-token', body)).status, 400, p);
  }
  assert.equal(h.calls.length, 3);
});

test('database answers: rule message kept, success:false answer 400, forbidden 403, signed out 401, raw or unexpected hidden', async () => {
  const run = async (reply: Reply) => {
    const h = harness(() => reply);
    return post(h.gateway, 'admin-time-slot-delete', 'admin-token', BODIES['admin-time-slot-delete']);
  };
  const rule = await run({ data: null, error: { code: 'P0001', message: 'This slot still has 2 open booking(s) from today onward.' } });
  assert.equal(rule.status, 400);
  assert.equal(rule.body.code, 'slot_rejected');
  assert.ok(JSON.stringify(rule.body).includes('open booking'));
  const soft = await run({ data: { success: false, message: 'Transfer failed for a reason.' }, error: null });
  assert.equal(soft.status, 400);
  assert.ok(JSON.stringify(soft.body).includes('Transfer failed'));
  assert.equal((await run({ data: null, error: { code: '42501', message: 'Not authorized' } })).status, 403);
  assert.equal((await run({ data: null, error: { code: 'P0001', message: 'Unauthorized' } })).status, 403);
  assert.equal((await run({ data: null, error: { code: '28000', message: 'not signed in' } })).status, 401);
  const raw = await run({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "time_slots_label_key"' } });
  assert.equal(raw.status, 400);
  assert.ok(!JSON.stringify(raw.body).includes('time_slots_label_key'));
  const generic = await run({ data: null, error: { code: 'XX000', message: 'connection to server at 10.0.0.1 failed' } });
  assert.equal(generic.status, 500);
  assert.equal(generic.body.code, 'slot_failed');
  assert.ok(!JSON.stringify(generic.body).includes('10.0.0.1'));
});

test('rate limit: the 61st call in a minute is 429 (add route)', async () => {
  const h = harness();
  let last = 0;
  for (let i = 0; i < 61; i++) last = (await post(h.gateway, 'admin-time-slot-add', 'admin-token', { label: '' })).status;
  assert.equal(last, 429);
});
