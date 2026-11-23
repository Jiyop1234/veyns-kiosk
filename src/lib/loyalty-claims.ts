// Browser helpers for POST /api/claim-loyalty-reward and POST /api/claim-platinum-discount (Step 5G-3).
// The loyalty card used to call the database functions claim_loyalty_reward and claim_platinum_weekly_discount straight
// from the browser. It now asks the gateway, which checks the login, limits the rate and then claims on the server.
// Both helpers answer in the same shape as supabase.rpc did, { data, error }, and never throw, so the two places that
// claim (loyalty-card-section.tsx and store-data.tsx) keep their messages and flow:
//   data  = { success, message?, promo_code?, reward_type?, target?, claims_remaining? }  (or null)
//   error = { message } safe to show to the customer (or null)
import { supabase } from '@/lib/supabase';

export interface LoyaltyClaimAnswer {
  data: any | null;
  error: { message: string } | null;
}

async function post(path: string, payload: Record<string, unknown>): Promise<LoyaltyClaimAnswer> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) return { data: null, error: { message: 'Please sign in again to claim your reward.' } };

  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload),
    });
  } catch {
    return { data: null, error: { message: 'Could not reach the server. Please check your connection and try again.' } };
  }

  let json: any = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || !json?.ok || !json.result) {
    return { data: null, error: { message: String(json?.error || 'Unable to complete the claim.') } };
  }
  return { data: json.result, error: null };
}

export function claimLoyaltyReward(rewardId: string): Promise<LoyaltyClaimAnswer> {
  return post('/api/claim-loyalty-reward', { rewardId });
}

export function claimPlatinumDiscount(target: 'subtotal' | 'delivery' = 'subtotal'): Promise<LoyaltyClaimAnswer> {
  return post('/api/claim-platinum-discount', { target });
}
