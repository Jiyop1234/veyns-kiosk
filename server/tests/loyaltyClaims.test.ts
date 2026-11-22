// Tests for the two loyalty claim routes (Step 5G-3). Run from the project root:  npx tsx --test server/tests/loyaltyClaims.test.ts
// They go through the real gateway with a fake identity lookup and a fake database: no network, no Supabase key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../gateway/gateway.js';
import { claimLoyaltyRewardRoute, claimPlatinumDiscountRoute } from '../routes/loyaltyClaims.js';
import type { Identity } from '../gateway/types.js';

const TOKENS: Record<string, Identity> = {
  'owner-token': { userId: 'u-owner', role: 'regular' },
  'employee-token': { userId: 'u-employee', role: 'employee' },
};
const resolveIdentity = async (token: string) => {
  if (token === 'boom') throw new Error('database down');
  return TOKENS[token] || null;
};

type RpcCall = { fn: string; args: Record<string, any> };
function fakeDb(answer: { data?: any; error?: any } = {}, fallback: any = { success: true, promo_code: 'RW-ABC123', reward_type: '10%_off' }) {
  const calls: RpcCall[] = [];
  const client = {
    rpc: async (fn: string, args: Record<string, any>) => {
      calls.push({ fn, args });
      if (answer.error) return { data: null, error: answer.error };
      if ('data' in answer) return { data: answer.data, error: null };
      return { data: fallback, error: null };
    },
  };
  return { client, calls };
}

const REWARD_ID = '3f2b9c1e-1111-4222-8333-123456789abc';
type Which = 'reward' | 'platinum';

function makeGateway(which: Which, answer: { data?: any; error?: any } = {}) {
  const fallback = which === 'reward'
    ? { success: true, promo_code: 'RW-ABC123', reward_type: '10%_off' }
    : { success: true, promo_code: 'PT-XYZ789', target: 'subtotal', claims_remaining: 2 };
  const { client, calls } = fakeDb(answer, fallback);
  const route = which === 'reward' ? claimLoyaltyRewardRoute(() => client) : claimPlatinumDiscountRoute(() => client);
  const gateway = createGateway({ routes: [route], resolveIdentity, log: () => {} });
  return { gateway, calls };
}

async function call(gateway: any, which: Which, opts: { method?: string; token?: string; body?: any } = {}) {
  const res: any = {
    statusCode: 0, body: null as any, headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
  };
  const req = {
    method: opts.method || 'POST',
    url: which === 'reward' ? '/api/claim-loyalty-reward' : '/api/claim-platinum-discount',
    headers: opts.token ? { authorization: 'Bearer ' + opts.token } : {},
    body: opts.body === undefined ? (which === 'reward' ? { rewardId: REWARD_ID } : { target: 'subtotal' }) : opts.body,
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

for (const which of ['reward', 'platinum'] as Which[]) {
  test(`[${which}] no token: 401 and the database is not touched`, async () => {
    const { gateway, calls } = makeGateway(which);
    const res = await call(gateway, which);
    assert.equal(res.statusCode, 401);
    assert.equal(calls.length, 0);
  });

  test(`[${which}] token that is not valid: 401`, async () => {
    const { gateway, calls } = makeGateway(which);
    const res = await call(gateway, which, { token: 'garbage' });
    assert.equal(res.statusCode, 401);
    assert.equal(calls.length, 0);
  });

  test(`[${which}] identity lookup down: 503, never "allowed"`, async () => {
    const { gateway, calls } = makeGateway(which);
    const res = await quiet(() => call(gateway, which, { token: 'boom' }));
    assert.equal(res.statusCode, 503);
    assert.equal(calls.length, 0);
  });

  test(`[${which}] GET is refused: 405`, async () => {
    const { gateway } = makeGateway(which);
    const res = await call(gateway, which, { method: 'GET', token: 'owner-token' });
    assert.equal(res.statusCode, 405);
  });

  test(`[${which}] the customer id comes from the token only: ids in the body are ignored`, async () => {
    const { gateway, calls } = makeGateway(which);
    const base = which === 'reward' ? { rewardId: REWARD_ID } : { target: 'delivery' };
    const res = await call(gateway, which, { token: 'owner-token', body: { ...base, p_uid: 'u-employee', userId: 'u-employee', uid: 'u-employee' } });
    assert.equal(res.statusCode, 200);
    assert.equal(calls[0].args.p_uid, 'u-owner');
    assert.ok(!JSON.stringify(calls[0].args).includes('u-employee'));
  });

  test(`[${which}] an employee can claim as a customer (their own id)`, async () => {
    const { gateway, calls } = makeGateway(which);
    const res = await call(gateway, which, { token: 'employee-token' });
    assert.equal(res.statusCode, 200);
    assert.equal(calls[0].args.p_uid, 'u-employee');
  });

  test(`[${which}] the database says "Sign in required": 401`, async () => {
    const { gateway } = makeGateway(which, { error: { code: 'P0001', message: 'Sign in required' } });
    const res = await call(gateway, which, { token: 'owner-token' });
    assert.equal(res.statusCode, 401);
  });

  test(`[${which}] the database refuses on purpose: 400 with its message`, async () => {
    const { gateway } = makeGateway(which, { error: { code: 'P0001', message: 'Something the customer should read.' } });
    const res = await call(gateway, which, { token: 'owner-token' });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Something the customer should read.');
  });

  test(`[${which}] any other database error: 500, safe message, no internal detail`, async () => {
    const { gateway } = makeGateway(which, { error: { code: '42501', message: 'permission denied for function secret_detail' } });
    const res = await quiet(() => call(gateway, which, { token: 'owner-token' }));
    assert.equal(res.statusCode, 500);
    assert.ok(!JSON.stringify(res.body).includes('secret_detail'));
  });

  test(`[${which}] the database returns nothing or a strange answer: 500`, async () => {
    for (const data of [null, 'x', { promo_code: 'A' }]) {
      const { gateway } = makeGateway(which, { data });
      const res = await quiet(() => call(gateway, which, { token: 'owner-token' }));
      assert.equal(res.statusCode, 500);
    }
  });

  test(`[${which}] a normal refusal (success false) is a 200 with the message, like before`, async () => {
    const { gateway } = makeGateway(which, { data: { success: false, message: 'Reward already claimed' } });
    const res = await call(gateway, which, { token: 'owner-token' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.deepEqual(res.body.result, { success: false, message: 'Reward already claimed' });
  });

  test(`[${which}] fields the browser does not show are dropped from the answer`, async () => {
    const { gateway } = makeGateway(which, { data: { success: true, promo_code: 'RW-ABC123', internal_note: 'secret', user_id: 'u-owner' } });
    const res = await call(gateway, which, { token: 'owner-token' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.result, { success: true, promo_code: 'RW-ABC123' });
  });

  test(`[${which}] the route has its own limit: the 11th claim from one IP in a minute is 429`, async () => {
    const { gateway, calls } = makeGateway(which);
    let last: any;
    for (let i = 0; i < 11; i++) last = await call(gateway, which, { token: 'owner-token' });
    assert.equal(last.statusCode, 429);
    assert.equal(calls.length, 10);
  });

  test(`[${which}] the answer is never cached`, async () => {
    const { gateway } = makeGateway(which);
    const res = await call(gateway, which, { token: 'owner-token' });
    assert.equal(res.headers['Cache-Control'], 'no-store');
  });
}

// ---- claim-loyalty-reward only
test('[reward] a good claim: 200, the answer, and the database gets the right function and arguments', async () => {
  const { gateway, calls } = makeGateway('reward');
  const res = await call(gateway, 'reward', { token: 'owner-token' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, result: { success: true, promo_code: 'RW-ABC123', reward_type: '10%_off' } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fn, 'claim_loyalty_reward_for');
  assert.deepEqual(calls[0].args, { p_uid: 'u-owner', p_reward_id: REWARD_ID });
});

const BAD_REWARD: Array<[string, any]> = [
  ['no reward id', {}],
  ['reward id is not text', { rewardId: 12345 }],
  ['reward id is not a uuid', { rewardId: 'abc' }],
  ['reward id with extra text', { rewardId: REWARD_ID + '; drop table' }],
  ['reward id is an object', { rewardId: { id: REWARD_ID } }],
];
for (const [name, body] of BAD_REWARD) {
  test(`[reward] refused before the database: ${name}`, async () => {
    const { gateway, calls } = makeGateway('reward');
    const res = await call(gateway, 'reward', { token: 'owner-token', body });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
    assert.equal(calls.length, 0);
  });
}

test('[reward] a body that is too large: 413 and the database is not touched', async () => {
  const { gateway, calls } = makeGateway('reward');
  const res = await call(gateway, 'reward', { token: 'owner-token', body: { rewardId: REWARD_ID, pad: 'a'.repeat(3_000) } });
  assert.equal(res.statusCode, 413);
  assert.equal(calls.length, 0);
});

// ---- claim-platinum-discount only
test('[platinum] a good claim: 200, the answer, and the database gets the right function and arguments', async () => {
  const { gateway, calls } = makeGateway('platinum');
  const res = await call(gateway, 'platinum', { token: 'owner-token', body: { target: 'delivery' } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, result: { success: true, promo_code: 'PT-XYZ789', target: 'subtotal', claims_remaining: 2 } });
  assert.equal(calls[0].fn, 'claim_platinum_weekly_discount_for');
  assert.deepEqual(calls[0].args, { p_uid: 'u-owner', p_target: 'delivery' });
});

test('[platinum] no target means food (subtotal)', async () => {
  const { gateway, calls } = makeGateway('platinum');
  const res = await call(gateway, 'platinum', { token: 'owner-token', body: {} });
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].args.p_target, 'subtotal');
});

const BAD_TARGET: Array<[string, any]> = [
  ['unknown target', { target: 'everything' }],
  ['target is not text', { target: 5 }],
  ['target is an object', { target: { a: 1 } }],
  ['target in capitals', { target: 'DELIVERY' }],
];
for (const [name, body] of BAD_TARGET) {
  test(`[platinum] refused before the database: ${name}`, async () => {
    const { gateway, calls } = makeGateway('platinum');
    const res = await call(gateway, 'platinum', { token: 'owner-token', body });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
    assert.equal(calls.length, 0);
  });
}
