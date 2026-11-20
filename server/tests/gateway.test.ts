// Gateway tests. Run from the project root:  npx tsx --test server/tests/gateway.test.ts
// They use fake requests and a fake identity lookup: no network, no database, no Supabase key needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../gateway/gateway.js';
import { HttpError } from '../gateway/errors.js';
import { healthRoutes } from '../routes/health.js';
import type { Identity, RouteDef } from '../gateway/types.js';

const TOKENS: Record<string, Identity> = {
  'customer-token': { userId: 'u-customer', role: 'regular' },
  'employee-token': { userId: 'u-employee', role: 'employee' },
  'admin-token': { userId: 'u-admin', role: 'admin' },
};
const resolveIdentity = async (token: string) => {
  if (token === 'boom') throw new Error('database down');
  return TOKENS[token] || null;
};

function call(gateway: (req: any, res: any) => Promise<void>, opts: { method?: string; url: string; token?: string; body?: any; ip?: string; headers?: Record<string, string> }) {
  const headers: Record<string, string> = { 'x-forwarded-for': opts.ip || '1.1.1.1', ...(opts.headers || {}) };
  if (opts.token) headers.authorization = 'Bearer ' + opts.token;
  const req = { method: opts.method || 'GET', url: opts.url, headers, body: opts.body };
  const out: { status: number; headers: Record<string, string>; body: any } = { status: 0, headers: {}, body: undefined };
  const res = {
    setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v; },
    status(c: number) { out.status = c; return res; },
    json(b: any) { out.body = b; },
  };
  return gateway(req, res).then(() => out);
}

const noLog = () => {};
const make = (routes: RouteDef[] = healthRoutes, log: (l: any) => void = noLog) => createGateway({ routes, resolveIdentity, log });

test('public health route answers without a token', async () => {
  const r = await call(make(), { url: '/api/health' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, service: 'veyns-gateway' });
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.ok(r.headers['x-request-id']);
});

test('unknown path is a JSON 404', async () => {
  const g = make();
  for (const url of ['/api/nope', '/api/login-check', '/api', '/api/', '/api/HEALTH', '/api/health/staff', '/api/health/../admin', '/api/health%00', '/other']) {
    const r = await call(g, { url });
    assert.equal(r.status, 404, url);
    assert.equal(r.body.ok, false, url);
  }
});

test('wrong method is 405 with Allow', async () => {
  const r = await call(make(), { method: 'POST', url: '/api/health' });
  assert.equal(r.status, 405);
  assert.equal(r.headers['allow'], 'GET');
});

test('protected route: no token = 401, bad token = 401', async () => {
  const g = make();
  assert.equal((await call(g, { url: '/api/health-staff' })).status, 401);
  assert.equal((await call(g, { url: '/api/health-staff', token: 'wrong' })).status, 401);
});

test('role matrix: customer / employee / admin on each level', async () => {
  const g = make();
  const expect: Record<string, Record<string, number>> = {
    '/api/health-customer': { 'customer-token': 200, 'employee-token': 200, 'admin-token': 200 },
    '/api/health-staff': { 'customer-token': 403, 'employee-token': 200, 'admin-token': 200 },
    '/api/health-admin': { 'customer-token': 403, 'employee-token': 403, 'admin-token': 200 },
  };
  for (const [url, byToken] of Object.entries(expect)) {
    for (const [token, status] of Object.entries(byToken)) {
      assert.equal((await call(g, { url, token })).status, status, `${url} ${token}`);
    }
  }
});

test('role comes from the lookup, not from the request', async () => {
  const r = await call(make(), { url: '/api/health-admin?role=admin', token: 'customer-token', headers: { 'x-role': 'admin' } });
  assert.equal(r.status, 403);
});

test('identity lookup failure is 503, never "allowed"', async () => {
  const r = await call(make(), { url: '/api/health-staff', token: 'boom' });
  assert.equal(r.status, 503);
});

test('per-route rate limit returns 429 with Retry-After', async () => {
  const route: RouteDef = { method: 'GET', path: '/limited', access: 'public', rateLimit: { max: 3, windowSeconds: 60 }, handle: async () => ({ status: 200, body: { ok: true } }) };
  const g = make([route]);
  for (let i = 0; i < 3; i++) assert.equal((await call(g, { url: '/api/limited' })).status, 200);
  const r = await call(g, { url: '/api/limited' });
  assert.equal(r.status, 429);
  assert.ok(Number(r.headers['retry-after']) >= 1);
  assert.equal((await call(g, { url: '/api/limited', ip: '2.2.2.2' })).status, 200); // another caller is not affected
});

test('global flood limit also covers unknown paths', async () => {
  const g = make();
  let last = 0;
  for (let i = 0; i < 125; i++) last = (await call(g, { url: '/api/scan' + i, ip: '9.9.9.9' })).status;
  assert.equal(last, 429);
});

test('body: too large = 413, bad JSON = 400, array = 400', async () => {
  const route: RouteDef = { method: 'POST', path: '/echo', access: 'public', maxBodyBytes: 50, handle: async (ctx) => ({ status: 200, body: { ok: true, got: ctx.body } }) };
  const g = make([route]);
  assert.equal((await call(g, { method: 'POST', url: '/api/echo', body: { a: 'x'.repeat(100) } })).status, 413);
  assert.equal((await call(g, { method: 'POST', url: '/api/echo', body: 'x'.repeat(100) })).status, 413);
  assert.equal((await call(g, { method: 'POST', url: '/api/echo', headers: { 'content-length': '5000' }, body: {} })).status, 413);
  assert.equal((await call(g, { method: 'POST', url: '/api/echo', body: '{not json' })).status, 400);
  assert.equal((await call(g, { method: 'POST', url: '/api/echo', body: [1, 2] })).status, 400);
  const ok = await call(g, { method: 'POST', url: '/api/echo', body: '{"a":1}' });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.got, { a: 1 });
});

test('route validation failure = 400 with its message', async () => {
  const route: RouteDef = {
    method: 'POST', path: '/v', access: 'public',
    validate: (b) => (typeof b.name === 'string' && b.name.length >= 2 ? { ok: true, value: { name: b.name } } : { ok: false, error: 'Enter a name.' }),
    handle: async (ctx) => ({ status: 200, body: { ok: true, name: ctx.body.name } }),
  };
  const g = make([route]);
  const bad = await call(g, { method: 'POST', url: '/api/v', body: { name: 'x' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'Enter a name.');
  assert.equal((await call(g, { method: 'POST', url: '/api/v', body: { name: 'Ana', extra: 'dropped' } })).status, 200);
});

test('HttpError shows its public message; any other error is a generic 500', async () => {
  const routes: RouteDef[] = [
    { method: 'GET', path: '/known', access: 'public', handle: async () => { throw new HttpError(409, 'Already exists.', 'duplicate'); } },
    { method: 'GET', path: '/secret', access: 'public', handle: async () => { throw new Error('SECRET connection string postgres://user:pw@host'); } },
  ];
  const g = make(routes);
  const known = await call(g, { url: '/api/known' });
  assert.equal(known.status, 409);
  assert.equal(known.body.code, 'duplicate');
  const unknown = await call(g, { url: '/api/secret' });
  assert.equal(unknown.status, 500);
  assert.ok(!JSON.stringify(unknown.body).includes('postgres'));
  assert.ok(unknown.body.requestId);
});

test('slow route = 504', async () => {
  const route: RouteDef = { method: 'GET', path: '/slow', access: 'public', timeoutMs: 30, handle: () => new Promise((r) => setTimeout(() => r({ status: 200, body: { ok: true } }), 300)) };
  assert.equal((await call(make([route]), { url: '/api/slow' })).status, 504);
});

test('log has one line per request and never holds tokens, bodies or IPs', async () => {
  const lines: any[] = [];
  const g = make(healthRoutes, (l) => lines.push(l));
  await call(g, { url: '/api/health-staff', token: 'employee-token', ip: '203.0.113.7' });
  await call(g, { url: '/api/nope' });
  assert.equal(lines.length, 2);
  const text = JSON.stringify(lines);
  assert.ok(!text.includes('employee-token'));
  assert.ok(!text.includes('203.0.113.7'));
  assert.equal(lines[0].role, 'employee');
  assert.equal(lines[1].path, '(unmatched)');
});

test('gateway refuses to start with a badly declared route', () => {
  const ok = async () => ({ status: 200, body: { ok: true } });
  assert.throws(() => make([{ method: 'GET', path: '/x', handle: ok } as any]), /access/);
  assert.throws(() => make([{ method: 'GET', path: '/x', access: 'everyone', handle: ok } as any]), /access/);
  assert.throws(() => make([{ method: 'GET', path: '/Bad Path', access: 'public', handle: ok }]), /not allowed/);
  assert.throws(() => make([{ method: 'GET', path: '/two/segments', access: 'public', handle: ok }]), /not allowed/);
  assert.throws(() => make([{ method: 'GET', path: '/x', access: 'public', handle: ok }, { method: 'GET', path: '/x', access: 'public', handle: ok }]), /duplicate/);
});

test('fallback: path taken from the catch-all segment when the URL was rewritten', async () => {
  const r = await call(make(), { url: '/somewhere-else' }) ;
  assert.equal(r.status, 404);
  const g = make();
  const req = { method: 'GET', url: '/', query: { route: ['health'] }, headers: {} };
  const out: any = {};
  const res = { setHeader() {}, status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; } };
  await g(req, res);
  assert.equal(out.status, 200);
});
