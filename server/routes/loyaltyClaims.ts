// Gateway routes: a signed-in customer claims a loyalty reward or the weekly Platinum voucher (Step 5G-3).
//   POST /api/claim-loyalty-reward      body: { rewardId }              -> public.claim_loyalty_reward_for
//   POST /api/claim-platinum-discount   body: { target?: 'subtotal' | 'delivery' } -> public.claim_platinum_weekly_discount_for
// The gateway already did: token check, "signed in with a profile" check, global rate limit, body size and JSON check,
// timeout, safe errors. These routes do two things only:
//   1. validate the body to the few fields the database function reads (anything else is dropped);
//   2. call the service-only database function (made in 5G-2) with the SERVICE key. The customer id comes from the
//      verified token (ctx.identity.userId), never from the body.
// The claim rules (reward belongs to the caller, single use, weekly limit, row locks, voucher creation) stay inside the
// existing database functions; the _for functions only set who the caller is and then run them.
// Answer: { ok: true, result: { success, message?, promo_code?, reward_type?, target?, claims_remaining? } }.
// A normal refusal such as "Reward already claimed" is success:false inside a 200, exactly what the browser got before.
// Server environment: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (used by server/db/client.ts).
import { HttpError } from '../gateway/errors.js';
import type { RouteContext, RouteDef, RouteResult, ValidationResult } from '../gateway/types.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TARGETS = ['subtotal', 'delivery'];

const bad = (msg: string): ValidationResult => ({ ok: false, error: msg });

export function validateClaimReward(body: Record<string, unknown>): ValidationResult {
  const id = body.rewardId;
  if (typeof id !== 'string' || !UUID.test(id)) return bad('Invalid reward.');
  return { ok: true, value: { rewardId: id } };
}

export function validateClaimPlatinum(body: Record<string, unknown>): ValidationResult {
  const target = body.target === undefined || body.target === null ? 'subtotal' : body.target;
  if (typeof target !== 'string' || !TARGETS.includes(target)) return bad('Choose Food or Delivery Fee.');
  return { ok: true, value: { target } };
}

// Keep only the fields the browser shows. Anything else the database might add is dropped.
function pickResult(data: any): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || typeof data.success !== 'boolean') return null;
  const out: Record<string, unknown> = { success: data.success };
  if (typeof data.message === 'string') out.message = data.message.slice(0, 300);
  if (typeof data.promo_code === 'string') out.promo_code = data.promo_code.slice(0, 40);
  if (typeof data.reward_type === 'string') out.reward_type = data.reward_type.slice(0, 40);
  if (typeof data.target === 'string') out.target = data.target.slice(0, 20);
  if (typeof data.claims_remaining === 'number') out.claims_remaining = data.claims_remaining;
  return out;
}

export function claimLoyaltyRewardRoute(getClient: () => any): RouteDef {
  return {
    method: 'POST',
    path: '/claim-loyalty-reward',
    access: 'customer',
    timeoutMs: 9000,
    maxBodyBytes: 2_000,
    rateLimit: { max: 10, windowSeconds: 60 },
    validate: validateClaimReward,
    handle: (ctx) => run(ctx, getClient(), 'claim_loyalty_reward_for', (b) => ({ p_reward_id: b.rewardId })),
  };
}

export function claimPlatinumDiscountRoute(getClient: () => any): RouteDef {
  return {
    method: 'POST',
    path: '/claim-platinum-discount',
    access: 'customer',
    timeoutMs: 9000,
    maxBodyBytes: 2_000,
    rateLimit: { max: 10, windowSeconds: 60 },
    validate: validateClaimPlatinum,
    handle: (ctx) => run(ctx, getClient(), 'claim_platinum_weekly_discount_for', (b) => ({ p_target: b.target })),
  };
}

async function run(
  ctx: RouteContext,
  admin: any,
  fn: string,
  extraArgs: (b: Record<string, any>) => Record<string, unknown>,
): Promise<RouteResult> {
  const caller = ctx.identity!; // 'customer' route: the gateway guarantees a verified identity
  const b = ctx.body as Record<string, any>;

  const { data, error } = await admin.rpc(fn, { p_uid: caller.userId, ...extraArgs(b) });
  if (error) {
    const code = String(error.code || '');
    const msg = String(error.message || '');
    // P0001 = a message the database raised on purpose for the customer.
    if (code === 'P0001') {
      if (/^sign.?in required$/i.test(msg)) throw new HttpError(401, 'Sign in required.');
      throw new HttpError(400, msg.slice(0, 300) || 'The claim could not be completed.');
    }
    // anything else: log a short line (no ids, no body) and give a safe answer
    console.error(`${fn} ${ctx.requestId}: database error ${code}: ${msg.slice(0, 200)}`);
    throw new HttpError(500, 'The claim could not be completed. Please try again.');
  }
  const result = pickResult(data);
  if (!result) {
    console.error(`${fn} ${ctx.requestId}: the database function returned an unexpected answer`);
    throw new HttpError(500, 'The claim could not be completed. Please try again.');
  }
  return { status: 200, body: { ok: true, result } };
}
