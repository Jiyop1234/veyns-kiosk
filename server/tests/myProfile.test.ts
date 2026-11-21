// Tests for the my-profile route (Step 5D). Run from the project root:  npx tsx --test server/tests/myProfile.test.ts
// They go through the real gateway with a fake identity lookup and a fake database: no network, no Supabase key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../gateway/gateway.js';
import { myProfileRoute } from '../routes/myProfile.js';
import type { Identity } from '../gateway/types.js';

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

type Row = Record<string, any>;
// A tiny fake of the one Supabase call this route uses: from(t).select(cols).eq(k, v).maybeSingle()
function fakeDb(rows: Row[], opts: { fail?: boolean } = {}) {
  const calls: { table: string; select: string; filters: Row }[] = [];
  const client = {
    from(table: string) {
      const call = { table, select: '', filters: {} as Row };
      calls.push(call);
      const api: any = {
        select(cols: string) { call.select = cols; return api; },
        eq(k: string, v: any) { call.filters[k] = v; return api; },
        maybeSingle: async () => {
          if (opts.fail) return { data: null, error: { message: 'relation "profiles" secret detail' } };
          const hit = rows.find((r) => Object.entries(call.filters).every(([k, v]) => r[k] === v));
          return { data: hit ? { ...hit } : null, error: null };
        },
      };
      return api;
    },
  };
  return { client, calls };
}

const ROWS: Row[] = [
  {
    auth_user_id: 'u-owner', name: 'Wat', created_at: '2026-10-01T00:00:00Z',
    stamps_data: [{ status: 'filled', date: '2026-11-01' }], penalty_data: null,
    // columns the route must never hand out, even if the database returned them:
    id: 'p-1', identifier: 'wat@example.com', role: 'regular', tier: 'PLATINUM', status: 'ACTIVE',
  },
  { auth_user_id: 'u-other', name: 'Other', created_at: '2026-10-02T00:00:00Z', stamps_data: null, penalty_data: { n: 1 } },
  { auth_user_id: 'u-employee', name: 'Staffer', created_at: '2026-10-03T00:00:00Z', stamps_data: null, penalty_data: null },
];

function makeGateway(rows = ROWS, opts: { fail?: boolean } = {}) {
  const { client, calls } = fakeDb(rows, opts);
  const gateway = createGateway({
    routes: [myProfileRoute(() => client)],
    resolveIdentity,
    log: () => {},
  });
  return { gateway, calls };
}

async function call(gateway: any, opts: { method?: string; token?: string; url?: string } = {}) {
  const res: any = {
    statusCode: 0, body: null as any, headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
  };
  const req = {
    method: opts.method || 'GET',
    url: opts.url || '/api/my-profile',
    headers: opts.token ? { authorization: 'Bearer ' + opts.token } : {},
    socket: { remoteAddress: '1.2.3.4' },
  };
  await gateway(req, res);
  return res;
}

async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const e = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = e; }
}

test('no token: 401 and the database is not touched', async () => {
  const { gateway, calls } = makeGateway();
  const res = await call(gateway);
  assert.equal(res.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('token that is not valid: 401', async () => {
  const { gateway, calls } = makeGateway();
  const res = await call(gateway, { token: 'garbage' });
  assert.equal(res.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('identity lookup down: 503, never "allowed"', async () => {
  const { gateway } = makeGateway();
  const res = await quiet(() => call(gateway, { token: 'boom' }));
  assert.equal(res.statusCode, 503);
});

test('POST is refused: 405', async () => {
  const { gateway } = makeGateway();
  const res = await call(gateway, { method: 'POST', token: 'owner-token' });
  assert.equal(res.statusCode, 405);
});

test('customer gets exactly four fields, nothing else', async () => {
  const { gateway } = makeGateway();
  const res = await call(gateway, { token: 'owner-token' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(Object.keys(res.body.profile).sort(), ['created_at', 'name', 'penalty_data', 'stamps_data']);
  assert.equal(res.body.profile.name, 'Wat');
  assert.deepEqual(res.body.profile.stamps_data, [{ status: 'filled', date: '2026-11-01' }]);
  const text = JSON.stringify(res.body);
  for (const secret of ['wat@example.com', 'PLATINUM', 'p-1', 'u-owner']) assert.ok(!text.includes(secret), `leaked ${secret}`);
});

test('the row is chosen by the token only, and only the four columns are selected', async () => {
  const { gateway, calls } = makeGateway();
  await call(gateway, { token: 'owner-token' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, 'profiles');
  assert.equal(calls[0].select, 'name,created_at,stamps_data,penalty_data');
  assert.deepEqual(calls[0].filters, { auth_user_id: 'u-owner' });
});

test('asking for someone else through the URL does nothing: you still get your own row', async () => {
  const { gateway, calls } = makeGateway();
  const res = await call(gateway, { token: 'owner-token', url: '/api/my-profile?auth_user_id=u-other&userId=u-other' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.profile.name, 'Wat');
  assert.deepEqual(calls[0].filters, { auth_user_id: 'u-owner' });
});

test('another customer gets their own row', async () => {
  const { gateway } = makeGateway();
  const res = await call(gateway, { token: 'other-token' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.profile.name, 'Other');
  assert.deepEqual(res.body.profile.penalty_data, { n: 1 });
});

test('an employee (or admin) using the store gets their own profile', async () => {
  const { gateway } = makeGateway();
  const res = await call(gateway, { token: 'employee-token' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.profile.name, 'Staffer');
});

test('no profile row: 404 with a plain message', async () => {
  const { gateway } = makeGateway();
  const res = await call(gateway, { token: 'admin-token' }); // valid token, no row in this fake table
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.ok, false);
});

test('database error: 500 with a safe message and no internal detail', async () => {
  const { gateway } = makeGateway(ROWS, { fail: true });
  const res = await quiet(() => call(gateway, { token: 'owner-token' }));
  assert.equal(res.statusCode, 500);
  assert.ok(!JSON.stringify(res.body).includes('secret detail'));
});

test('the answer is never cached', async () => {
  const { gateway } = makeGateway();
  const res = await call(gateway, { token: 'owner-token' });
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
