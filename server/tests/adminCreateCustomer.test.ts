// Tests for the admin-create-customer gateway route (Step 4C-1).
// Run from the project root:  npx tsx --test server/tests/adminCreateCustomer.test.ts
// Fake Supabase client and fake identity lookup: no network, no database, no email is sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../gateway/gateway.js';
import { adminCreateCustomerRoute } from '../routes/adminCreateCustomer.js';
import type { Identity } from '../gateway/types.js';

process.env.SITE_URL = 'https://site.example/';

const TOKENS: Record<string, Identity> = {
  'customer-token': { userId: 'u-customer', role: 'regular' },
  'employee-token': { userId: 'u-employee', role: 'employee' },
  'admin-token': { userId: 'u-admin', role: 'admin' },
};
const resolveIdentity = async (token: string) => TOKENS[token] || null;

type Q = { table: string; op: 'select' | 'insert' | 'update'; cols?: string; filters: [string, string, any][]; payload?: any };
type Reply = { data: any; error: any };
const NONE: Reply = { data: null, error: null };

function harness(opts: {
  respond?: (q: Q) => Reply;
  createUser?: (a: any) => any;
  getUserById?: (id: string) => any;
  updateUserById?: (id: string, a: any) => any;
  mailError?: string | null;
} = {}) {
  const queries: Q[] = [];
  const calls = { createUser: [] as any[], deleteUser: [] as any[], getUserById: [] as any[], updateUserById: [] as any[], reset: [] as any[] };
  const answer = (q: Q) => { queries.push(q); return Promise.resolve((opts.respond || (() => NONE))(q)); };
  const client = {
    from(table: string) {
      const q: Q = { table, op: 'select', filters: [] };
      const b: any = {
        select(cols: string) { q.cols = cols; return b; },
        insert(p: any) { q.op = 'insert'; q.payload = p; return b; },
        update(p: any) { q.op = 'update'; q.payload = p; return b; },
        eq(c: string, v: any) { q.filters.push([c, 'eq', v]); return b; },
        neq(c: string, v: any) { q.filters.push([c, 'neq', v]); return b; },
        maybeSingle() { return answer(q); },
        single() { return answer(q); },
        then(res: any, rej: any) { return answer(q).then(res, rej); },
      };
      return b;
    },
    auth: {
      resetPasswordForEmail: async (to: string, o: any) => { calls.reset.push([to, o]); return { error: opts.mailError ? { message: opts.mailError } : null }; },
      admin: {
        createUser: async (a: any) => { calls.createUser.push(a); return opts.createUser ? opts.createUser(a) : { data: { user: { id: 'au1' } }, error: null }; },
        deleteUser: async (id: string) => { calls.deleteUser.push(id); return { error: null }; },
        getUserById: async (id: string) => { calls.getUserById.push(id); return opts.getUserById ? opts.getUserById(id) : { data: { user: { email: 'old@example.com' } } }; },
        updateUserById: async (id: string, a: any) => { calls.updateUserById.push([id, a]); return opts.updateUserById ? opts.updateUserById(id, a) : { error: null }; },
      },
    },
  };
  const gateway = createGateway({ routes: [adminCreateCustomerRoute(() => client)], resolveIdentity, log: () => {} });
  return { gateway, queries, calls };
}

function post(g: (req: any, res: any) => Promise<void>, token: string | null, body: any, opts: { method?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': '1.1.1.1', ...(opts.headers || {}) };
  if (token) headers.authorization = 'Bearer ' + token;
  const req = { method: opts.method || 'POST', url: '/api/admin-create-customer', headers, body };
  const out: { status: number; body: any } = { status: 0, body: undefined };
  const res = { setHeader() {}, status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; } };
  return g(req, res).then(() => out);
}

const profileRow = { id: 'p1', name: 'Ana Cruz', identifier: 'ana@example.com', auth_user_id: 'au1' };
const createResponder = (q: Q): Reply => (q.op === 'insert' ? { data: profileRow, error: null } : NONE);

test('create: success answers 201 and writes the right records (employee allowed)', async () => {
  const h = harness({ respond: createResponder });
  const r = await post(h.gateway, 'employee-token', { action: 'create', email: ' ANA@Example.com ', name: '  Ana   Cruz ', phone: '0917 123 4567' });
  assert.equal(r.status, 201);
  // compare what the browser receives (JSON drops undefined fields such as activationError)
  assert.deepEqual(JSON.parse(JSON.stringify(r.body)), { ok: true, customer: { id: 'p1', authUserId: 'au1', name: 'Ana Cruz', identifier: 'ana@example.com' }, activationEmailSent: true });
  assert.equal(h.calls.createUser[0].email, 'ana@example.com');
  assert.equal(h.calls.createUser[0].email_confirm, false);
  assert.equal(h.calls.createUser[0].user_metadata.name, 'Ana Cruz');
  assert.equal(h.calls.createUser[0].user_metadata.created_by_staff, 'u-employee');
  const ins = h.queries.find((q) => q.op === 'insert')!;
  assert.deepEqual(ins.payload, { auth_user_id: 'au1', identifier: 'ana@example.com', name: 'Ana Cruz', role: 'regular', status: 'ACTIVE', tier: null, current_stamp_count: 1 });
  assert.deepEqual(h.calls.reset[0], ['ana@example.com', { redirectTo: 'https://site.example' }]);
});

test('create: invalid input is refused before anything is created', async () => {
  const h = harness();
  const bad = [
    [{ email: 'nope', name: 'Ana Cruz' }, 'invalid_email'],
    [{ email: 'a@b.co', name: 'x' }, 'invalid_name'],
    [{ email: 'a@b.co', name: 'Ana Cruz', phone: 'abc' }, 'invalid_phone'],
  ] as const;
  for (const [body, code] of bad) {
    const r = await post(h.gateway, 'admin-token', { action: 'create', ...body });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, code);
  }
  assert.equal(h.calls.createUser.length, 0);
});

test('create: existing profile = 409 duplicate_email, nothing created', async () => {
  const h = harness({ respond: (q) => (q.cols === 'identifier' ? { data: { identifier: 'ana@example.com' }, error: null } : NONE) });
  const r = await post(h.gateway, 'admin-token', { email: 'ana@example.com', name: 'Ana Cruz' });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'duplicate_email');
  assert.equal(h.calls.createUser.length, 0);
});

test('create: auth says email exists = 409; other auth failure = generic 500', async () => {
  const dup = harness({ createUser: () => ({ data: null, error: { code: 'email_exists', message: 'x' } }) });
  const r1 = await post(dup.gateway, 'admin-token', { email: 'a@b.co', name: 'Ana Cruz' });
  assert.equal(r1.status, 409);
  assert.equal(r1.body.code, 'duplicate_email');
  const bad = harness({ createUser: () => ({ data: null, error: { message: 'boom internal detail' } }) });
  const r2 = await post(bad.gateway, 'admin-token', { email: 'a@b.co', name: 'Ana Cruz' });
  assert.equal(r2.status, 500);
  assert.ok(!JSON.stringify(r2.body).includes('boom'));
});

test('create: profile insert fails = auth user is deleted again (rollback)', async () => {
  const generic = harness({ respond: (q) => (q.op === 'insert' ? { data: null, error: { message: 'db down' } } : NONE) });
  const r1 = await post(generic.gateway, 'admin-token', { email: 'a@b.co', name: 'Ana Cruz' });
  assert.equal(r1.status, 500);
  assert.equal(r1.body.code, 'profile_failed');
  assert.deepEqual(generic.calls.deleteUser, ['au1']);
  const dup = harness({ respond: (q) => (q.op === 'insert' ? { data: null, error: { code: '23505', message: 'dup' } } : NONE) });
  const r2 = await post(dup.gateway, 'admin-token', { email: 'a@b.co', name: 'Ana Cruz' });
  assert.equal(r2.status, 409);
  assert.deepEqual(dup.calls.deleteUser, ['au1']);
});

test('create: email failure still answers 201 and says so', async () => {
  const h = harness({ respond: createResponder, mailError: 'smtp down' });
  const r = await post(h.gateway, 'admin-token', { email: 'ana@example.com', name: 'Ana Cruz' });
  assert.equal(r.status, 201);
  assert.equal(r.body.activationEmailSent, false);
  assert.equal(r.body.activationError, 'smtp down');
});

test('resend: 404 for unknown or non-customer, 200 for a customer, 502 if the email fails', async () => {
  const none = harness();
  assert.equal((await post(none.gateway, 'admin-token', { action: 'resend', email: 'a@b.co' })).status, 404);
  const staffAcct = harness({ respond: () => ({ data: { role: 'admin', auth_user_id: 'x' }, error: null }) });
  assert.equal((await post(staffAcct.gateway, 'admin-token', { action: 'resend', email: 'a@b.co' })).status, 404);
  const ok = harness({ respond: () => ({ data: { role: 'regular', auth_user_id: 'x' }, error: null }) });
  const r = await post(ok.gateway, 'employee-token', { action: 'resend', email: 'a@b.co' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, activationEmailSent: true });
  const failing = harness({ respond: () => ({ data: { role: 'regular', auth_user_id: 'x' }, error: null }), mailError: 'smtp down' });
  assert.equal((await post(failing.gateway, 'admin-token', { action: 'resend', email: 'a@b.co' })).status, 502);
});

test('update_email: employee refused first (no lookups at all); admin rules work', async () => {
  const target = (q: Q): Reply => {
    if (q.cols === 'id,auth_user_id,role') return { data: { id: 'p1', auth_user_id: 'au1', role: 'regular' }, error: null };
    return NONE;
  };
  const emp = harness({ respond: target });
  const r0 = await post(emp.gateway, 'employee-token', { action: 'update_email', email: 'new@b.co', profileId: 'p1' });
  assert.equal(r0.status, 403);
  assert.equal(emp.queries.length, 0);
  assert.equal(emp.calls.updateUserById.length, 0);

  const missing = harness();
  assert.equal((await post(missing.gateway, 'admin-token', { action: 'update_email', email: 'new@b.co', profileId: 'p1' })).status, 404);

  const same = harness({ respond: target, getUserById: () => ({ data: { user: { email: 'NEW@b.co' } } }) });
  assert.equal((await post(same.gateway, 'admin-token', { action: 'update_email', email: 'new@b.co', profileId: 'p1' })).status, 400);

  const dup = harness({ respond: (q) => (q.cols === 'id' ? { data: { id: 'other' }, error: null } : target(q)) });
  assert.equal((await post(dup.gateway, 'admin-token', { action: 'update_email', email: 'new@b.co', profileId: 'p1' })).status, 409);
  assert.equal(dup.calls.updateUserById.length, 0);

  const ok = harness({ respond: target });
  const r = await post(ok.gateway, 'admin-token', { action: 'update_email', email: 'New@B.co', profileId: 'p1' });
  assert.equal(r.status, 200);
  assert.deepEqual(ok.calls.updateUserById[0], ['au1', { email: 'new@b.co', email_confirm: false }]);
  assert.deepEqual(ok.queries.find((q) => q.op === 'update')!.payload, { identifier: 'new@b.co' });
  assert.equal(ok.calls.reset[0][0], 'new@b.co'); // the setup email goes to the NEW address
});

test('send_reset: customers only, needs an email on the account', async () => {
  const target = (role: string): ((q: Q) => Reply) => (q) => (q.cols === 'id,auth_user_id,role' ? { data: { id: 'p1', auth_user_id: 'au1', role }, error: null } : NONE);
  const ok = harness({ respond: target('regular') });
  const r = await post(ok.gateway, 'employee-token', { action: 'send_reset', profileId: 'p1' });
  assert.equal(r.status, 200);
  assert.equal(ok.calls.reset[0][0], 'old@example.com');
  const noMail = harness({ respond: target('regular'), getUserById: () => ({ data: { user: {} } }) });
  assert.equal((await post(noMail.gateway, 'admin-token', { action: 'send_reset', profileId: 'p1' })).status, 400);
  const adminTarget = harness({ respond: target('admin') });
  assert.equal((await post(adminTarget.gateway, 'admin-token', { action: 'send_reset', profileId: 'p1' })).status, 404);
});

test('gateway rules apply: no token 401, customer 403, GET 405, bad body 400', async () => {
  const h = harness();
  assert.equal((await post(h.gateway, null, { email: 'a@b.co', name: 'Ana Cruz' })).status, 401);
  assert.equal((await post(h.gateway, 'customer-token', { email: 'a@b.co', name: 'Ana Cruz' })).status, 403);
  const get = await post(h.gateway, 'admin-token', undefined, { method: 'GET' });
  assert.equal(get.status, 405);
  assert.equal(get.body.error, 'Method not allowed.');
  assert.equal((await post(h.gateway, 'admin-token', '{not json')).status, 400);
  assert.equal(h.calls.createUser.length, 0);
});

test('documented current behavior: an unknown action is treated as create (old function did the same)', async () => {
  const h = harness({ respond: createResponder });
  const r = await post(h.gateway, 'admin-token', { action: 'delete', email: 'ana@example.com', name: 'Ana Cruz' });
  assert.equal(r.status, 201);
  assert.equal(h.calls.createUser.length, 1);
});

test('activation link comes from SITE_URL only, never from the browser Origin header', async () => {
  const saved = process.env.SITE_URL;
  delete process.env.SITE_URL;
  try {
    const h = harness({ respond: createResponder });
    await post(h.gateway, 'admin-token', { email: 'ana@example.com', name: 'Ana Cruz' }, { headers: { origin: 'https://evil.example' } });
    assert.equal(h.calls.reset[0][1], undefined);
  } finally { process.env.SITE_URL = saved; }
});

test('rate limit: 20 per minute per caller, the 21st is 429', async () => {
  const h = harness();
  let last = 0;
  for (let i = 0; i < 21; i++) last = (await post(h.gateway, 'admin-token', { email: 'bad' })).status;
  assert.equal(last, 429);
});
