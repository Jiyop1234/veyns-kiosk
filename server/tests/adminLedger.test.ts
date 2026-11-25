// Tests for the Ledger gateway routes (Step 6B-3).
// Run from the project root:  npx tsx --test server/tests/adminLedger.test.ts
// Fake database client and fake identity lookup: no network, no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../gateway/gateway.js';
import { adminLedgerRoutes } from '../routes/adminLedger.js';
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
    rpc: async (fn: string, args: any) => { calls.push([fn, args]); return rpc ? rpc(fn, args) : { data: 'new-id', error: null }; },
  };
  const gateway = createGateway({ routes: adminLedgerRoutes(() => client), resolveIdentity, log: () => {} });
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

const entry = { kind: 'expense', occurredAt: '2026-11-24T10:00:00+08:00', description: '  Rice   sack ', category: 'supplies', amountCentavos: 125000, notes: ' bought at market ' };
const PATHS = ['admin-ledger-add', 'admin-ledger-update', 'admin-ledger-void'];
const withId = (b: any) => ({ id: ID, ...b });

test('who may call: no token 401, customer 403, EMPLOYEE 403, GET 405; the database is never called', async () => {
  const h = harness();
  for (const p of PATHS) {
    assert.equal((await post(h.gateway, p, null, withId(entry))).status, 401);
    assert.equal((await post(h.gateway, p, 'customer-token', withId(entry))).status, 403);
    assert.equal((await post(h.gateway, p, 'employee-token', withId(entry))).status, 403);
    assert.equal((await post(h.gateway, p, 'admin-token', undefined, 'GET')).status, 405);
  }
  assert.equal(h.calls.length, 0);
});

test('add: success answers 201 with the new id and passes clean values to the database', async () => {
  const h = harness();
  const r = await post(h.gateway, 'admin-ledger-add', 'admin-token', entry);
  assert.equal(r.status, 201);
  assert.deepEqual(r.body, { ok: true, id: 'new-id' });
  assert.equal(h.calls.length, 1);
  const [fn, args] = h.calls[0];
  assert.equal(fn, 'admin_ledger_add_entry_for');
  assert.deepEqual(args, {
    p_uid: 'u-admin',
    p_kind: 'expense',
    p_occurred_at: '2026-11-24T02:00:00.000Z',
    p_description: 'Rice sack',
    p_category: 'supplies',
    p_amount_centavos: 125000,
    p_notes: 'bought at market',
  });
});

test('the user id comes from the token, never from the body', async () => {
  const h = harness();
  await post(h.gateway, 'admin-ledger-add', 'admin-token', { ...entry, p_uid: 'u-evil', userId: 'u-evil', uid: 'u-evil' });
  assert.equal(h.calls[0][1].p_uid, 'u-admin');
  await post(h.gateway, 'admin-ledger-void', 'admin-token', { id: ID, p_uid: 'u-evil', userId: 'u-evil' });
  assert.equal(h.calls[1][1].p_uid, 'u-admin');
});

test('add: empty or missing notes become null', async () => {
  const h = harness();
  await post(h.gateway, 'admin-ledger-add', 'admin-token', { ...entry, notes: '   ' });
  await post(h.gateway, 'admin-ledger-add', 'admin-token', { ...entry, notes: undefined });
  assert.equal(h.calls[0][1].p_notes, null);
  assert.equal(h.calls[1][1].p_notes, null);
});

test('add and update: bad input is refused with 400 before the database is called', async () => {
  const h = harness();
  const bad: [any, string][] = [
    [{ ...entry, kind: '' }, 'invalid_kind'],
    [{ ...entry, kind: 5 }, 'invalid_kind'],
    [{ ...entry, occurredAt: 'not a date' }, 'invalid_date'],
    [{ ...entry, occurredAt: undefined }, 'invalid_date'],
    [{ ...entry, description: '   ' }, 'invalid_description'],
    [{ ...entry, description: 'x'.repeat(201) }, 'invalid_description'],
    [{ ...entry, category: '' }, 'invalid_category'],
    [{ ...entry, amountCentavos: 12.5 }, 'invalid_amount'],
    [{ ...entry, amountCentavos: '1250' }, 'invalid_amount'],
    [{ ...entry, amountCentavos: Number.MAX_SAFE_INTEGER + 10 }, 'invalid_amount'],
    [{ ...entry, notes: 'x'.repeat(1001) }, 'invalid_notes'],
    [{ ...entry, notes: 42 }, 'invalid_notes'],
  ];
  for (const [body, code] of bad) {
    for (const p of ['admin-ledger-add', 'admin-ledger-update']) {
      const r = await post(h.gateway, p, 'admin-token', withId(body));
      assert.equal(r.status, 400, p + ' ' + code);
      assert.equal(r.body.code, code);
    }
  }
  assert.equal(h.calls.length, 0);
});

test('update and void: the entry id must be a UUID', async () => {
  const h = harness();
  for (const id of [undefined, '', 'abc', '123', ID + 'x', 42]) {
    assert.equal((await post(h.gateway, 'admin-ledger-update', 'admin-token', { ...entry, id })).body.code, 'invalid_id');
    assert.equal((await post(h.gateway, 'admin-ledger-void', 'admin-token', { id })).body.code, 'invalid_id');
  }
  assert.equal(h.calls.length, 0);
});

test('update: success answers 200 and calls the update function with the id', async () => {
  const h = harness();
  const r = await post(h.gateway, 'admin-ledger-update', 'admin-token', withId(entry));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(h.calls[0][0], 'admin_ledger_update_entry_for');
  assert.equal(h.calls[0][1].p_id, ID);
  assert.equal(h.calls[0][1].p_uid, 'u-admin');
});

test('void: success answers 200 and calls the void function', async () => {
  const h = harness();
  const r = await post(h.gateway, 'admin-ledger-void', 'admin-token', { id: ID });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.deepEqual(h.calls[0], ['admin_ledger_void_entry_for', { p_uid: 'u-admin', p_id: ID }]);
});

test('database answers: rule refusal 400 (message kept), forbidden 403, signed out 401, anything else a generic 500', async () => {
  const run = async (error: any) => {
    const h = harness(() => ({ data: null, error }));
    return post(h.gateway, 'admin-ledger-update', 'admin-token', withId(entry));
  };
  const rule = await run({ code: 'P0001', message: 'A voided entry cannot be edited.' });
  assert.equal(rule.status, 400);
  assert.equal(rule.body.code, 'ledger_rejected');
  assert.ok(JSON.stringify(rule.body).includes('voided entry'));
  assert.equal((await run({ code: '23514', message: 'check constraint' })).status, 400);
  assert.equal((await run({ code: 'P0001', message: 'Unauthorized' })).status, 403);
  assert.equal((await run({ code: '42501', message: 'permission denied for function x' })).status, 403);
  assert.equal((await run({ code: '28000', message: 'not signed in' })).status, 401);
  const generic = await run({ code: 'XX000', message: 'connection to server at 10.0.0.1 failed' });
  assert.equal(generic.status, 500);
  assert.equal(generic.body.code, 'ledger_failed');
  assert.ok(!JSON.stringify(generic.body).includes('10.0.0.1'));
});

test('rate limit: the 61st call in a minute is 429', async () => {
  const h = harness();
  let last = 0;
  for (let i = 0; i < 61; i++) last = (await post(h.gateway, 'admin-ledger-void', 'admin-token', { id: 'bad' })).status;
  assert.equal(last, 429);
});
