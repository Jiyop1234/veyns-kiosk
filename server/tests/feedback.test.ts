// Tests for the feedback route (Step 5F-2). Run from the project root:  npx tsx --test server/tests/feedback.test.ts
// They go through the real gateway with a fake identity lookup and a fake database: no network, no Supabase key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../gateway/gateway.js';
import { feedbackRoute } from '../routes/feedback.js';
import type { Identity } from '../gateway/types.js';

const TOKENS: Record<string, Identity> = {
  'owner-token': { userId: 'u-owner', role: 'regular' },
  'employee-token': { userId: 'u-employee', role: 'employee' },
  'admin-token': { userId: 'u-admin', role: 'admin' },
};
const resolveIdentity = async (token: string) => {
  if (token === 'boom') throw new Error('database down');
  return TOKENS[token] || null;
};

type RpcCall = { fn: string; args: Record<string, any> };
// A tiny fake of the one Supabase call this route uses: rpc('submit_feedback_for', args)
function fakeDb(answer: { data?: any; error?: any } = {}) {
  const calls: RpcCall[] = [];
  const client = {
    rpc: async (fn: string, args: Record<string, any>) => {
      calls.push({ fn, args });
      if (answer.error) return { data: null, error: answer.error };
      if ('data' in answer) return { data: answer.data, error: null };
      return { data: { id: 'post-1', created_at: '2026-11-23T00:00:00Z', duplicate: false }, error: null };
    },
  };
  return { client, calls };
}

function makeGateway(answer: { data?: any; error?: any } = {}) {
  const { client, calls } = fakeDb(answer);
  const gateway = createGateway({ routes: [feedbackRoute(() => client)], resolveIdentity, log: () => {} });
  return { gateway, calls };
}

const GOOD = {
  submissionKey: '3f2b9c1e-aaaa-bbbb-cccc-1234567890ab',
  rating: 5,
  comment: 'Very tasty sinugba.',
  itemIds: ['m-1', 'm-2'],
  photos: [{ path: 'posts/3f2b9c1e/aaa.webp' }],
};

async function call(gateway: any, opts: { method?: string; token?: string; body?: any; headers?: Record<string, string> } = {}) {
  const res: any = {
    statusCode: 0, body: null as any, headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
  };
  const req = {
    method: opts.method || 'POST',
    url: '/api/feedback',
    headers: { ...(opts.token ? { authorization: 'Bearer ' + opts.token } : {}), ...(opts.headers || {}) },
    body: opts.body === undefined ? GOOD : opts.body,
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
  const { gateway, calls } = makeGateway();
  const res = await quiet(() => call(gateway, { token: 'boom' }));
  assert.equal(res.statusCode, 503);
  assert.equal(calls.length, 0);
});

test('GET is refused: 405', async () => {
  const { gateway } = makeGateway();
  const res = await call(gateway, { method: 'GET', token: 'owner-token' });
  assert.equal(res.statusCode, 405);
});

test('a good post: 200, answer is { ok, post }, and the database gets the right arguments', async () => {
  const { gateway, calls } = makeGateway();
  const res = await call(gateway, { token: 'owner-token' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.post, { id: 'post-1', created_at: '2026-11-23T00:00:00Z', duplicate: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fn, 'submit_feedback_for');
  assert.deepEqual(calls[0].args, {
    p_uid: 'u-owner',
    p_submission_key: GOOD.submissionKey,
    p_rating: 5,
    p_comment: 'Very tasty sinugba.',
    p_item_ids: ['m-1', 'm-2'],
    p_photos: [{ path: 'posts/3f2b9c1e/aaa.webp' }],
    p_ip: '1.2.3.4',
  });
});

test('the customer id comes from the token only: ids in the body are ignored', async () => {
  const { gateway, calls } = makeGateway();
  const res = await call(gateway, { token: 'owner-token', body: { ...GOOD, p_uid: 'u-admin', userId: 'u-admin', uid: 'u-admin', is_guest: true } });
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].args.p_uid, 'u-owner');
  assert.ok(!JSON.stringify(calls[0].args).includes('u-admin'));
  assert.ok(!('is_guest' in calls[0].args));
});

test('extra fields inside a photo are dropped: only the path goes on', async () => {
  const { gateway, calls } = makeGateway();
  await call(gateway, { token: 'owner-token', body: { ...GOOD, photos: [{ path: 'posts/a/b.webp', bucket: 'other', url: 'http://evil' }] } });
  assert.deepEqual(calls[0].args.p_photos, [{ path: 'posts/a/b.webp' }]);
});

test('the real caller IP is passed on (from the proxy header), not the gateway address', async () => {
  const { gateway, calls } = makeGateway();
  await call(gateway, { token: 'owner-token', headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } });
  assert.equal(calls[0].args.p_ip, '203.0.113.7');
});

test('no IP known: null is passed, so the database skips the IP part of its limit', async () => {
  const { client, calls } = fakeDb();
  const gateway = createGateway({ routes: [feedbackRoute(() => client)], resolveIdentity, log: () => {} });
  const res: any = { statusCode: 0, body: null, headers: {}, setHeader() {}, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; } };
  await gateway({ method: 'POST', url: '/api/feedback', headers: { authorization: 'Bearer owner-token' }, body: GOOD }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].args.p_ip, null);
});

test('photos are optional: a post with none is fine', async () => {
  const { gateway, calls } = makeGateway();
  const { photos, ...noPhotos } = GOOD;
  const res = await call(gateway, { token: 'owner-token', body: noPhotos });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls[0].args.p_photos, []);
});

test('an employee or admin can post as a customer', async () => {
  for (const token of ['employee-token', 'admin-token']) {
    const { gateway, calls } = makeGateway();
    const res = await call(gateway, { token });
    assert.equal(res.statusCode, 200);
    assert.equal(calls[0].args.p_uid, TOKENS[token].userId);
  }
});

test('a retry with the same key answers 200 with duplicate: true', async () => {
  const { gateway } = makeGateway({ data: { id: 'post-1', created_at: 'x', duplicate: true } });
  const res = await call(gateway, { token: 'owner-token' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.post.duplicate, true);
});

const INVALID: Array<[string, any]> = [
  ['rating 0', { ...GOOD, rating: 0 }],
  ['rating 6', { ...GOOD, rating: 6 }],
  ['rating 2.5', { ...GOOD, rating: 2.5 }],
  ['rating as text', { ...GOOD, rating: '5' }],
  ['no rating', { ...GOOD, rating: undefined }],
  ['empty comment', { ...GOOD, comment: '' }],
  ['spaces-only comment', { ...GOOD, comment: '    \n ' }],
  ['comment is not text', { ...GOOD, comment: 123 }],
  ['comment far too long', { ...GOOD, comment: 'a'.repeat(10_001) }],
  ['no food items', { ...GOOD, itemIds: [] }],
  ['items missing', { ...GOOD, itemIds: undefined }],
  ['16 food items', { ...GOOD, itemIds: Array.from({ length: 16 }, (_, i) => 'm-' + i) }],
  ['item is not text', { ...GOOD, itemIds: ['m-1', 7] }],
  ['item is empty text', { ...GOOD, itemIds: [''] }],
  ['6 photos', { ...GOOD, photos: Array.from({ length: 6 }, (_, i) => ({ path: `p/${i}.webp` })) }],
  ['photos is not a list', { ...GOOD, photos: 'x' }],
  ['photo is not an object', { ...GOOD, photos: ['posts/a.webp'] }],
  ['photo without a path', { ...GOOD, photos: [{}] }],
  ['photo path too long', { ...GOOD, photos: [{ path: 'a'.repeat(301) }] }],
  ['submission key too short', { ...GOOD, submissionKey: 'abc' }],
  ['no submission key', { ...GOOD, submissionKey: undefined }],
];
for (const [name, body] of INVALID) {
  test(`refused before the database: ${name}`, async () => {
    const { gateway, calls } = makeGateway();
    const res = await call(gateway, { token: 'owner-token', body });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
    assert.equal(calls.length, 0);
  });
}

test('a body that is too large: 413 and the database is not touched', async () => {
  const { gateway, calls } = makeGateway();
  const res = await call(gateway, { token: 'owner-token', body: { ...GOOD, comment: 'a'.repeat(31_000) } });
  assert.equal(res.statusCode, 413);
  assert.equal(calls.length, 0);
});

test('the database says "Sign in required": 401', async () => {
  const { gateway } = makeGateway({ error: { code: 'P0001', message: 'Sign in required' } });
  const res = await call(gateway, { token: 'owner-token' });
  assert.equal(res.statusCode, 401);
});

test('the database refuses on purpose (for example a photo that is not in Storage): 400 with its message', async () => {
  const { gateway } = makeGateway({ error: { code: 'P0001', message: 'Photo 1 was not found.' } });
  const res = await call(gateway, { token: 'owner-token' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Photo 1 was not found.');
});

test('the database says the customer posted too often: 429 with its message', async () => {
  const { gateway } = makeGateway({ error: { code: 'P0001', message: 'Too many posts. Please wait a few minutes.' } });
  const res = await call(gateway, { token: 'owner-token' });
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error, 'Too many posts. Please wait a few minutes.');
});

test('any other database error: 500, safe message, no internal detail', async () => {
  const { gateway } = makeGateway({ error: { code: '42501', message: 'permission denied for function secret_detail' } });
  const res = await quiet(() => call(gateway, { token: 'owner-token' }));
  assert.equal(res.statusCode, 500);
  assert.ok(!JSON.stringify(res.body).includes('secret_detail'));
});

test('the database returns nothing: 500', async () => {
  const { gateway } = makeGateway({ data: null });
  const res = await quiet(() => call(gateway, { token: 'owner-token' }));
  assert.equal(res.statusCode, 500);
});

test('the route has its own limit: the 11th post from one IP in a minute is 429', async () => {
  const { gateway, calls } = makeGateway();
  let last: any;
  for (let i = 0; i < 11; i++) last = await call(gateway, { token: 'owner-token' });
  assert.equal(last.statusCode, 429);
  assert.equal(calls.length, 10);
});

test('the answer is never cached', async () => {
  const { gateway } = makeGateway();
  const res = await call(gateway, { token: 'owner-token' });
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
