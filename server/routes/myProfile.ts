// Gateway route: the signed-in customer's own profile (Step 5D).
// GET /api/my-profile. It replaces the direct browser reads of public.profiles on the customer screens
// (welcome greeting, stamp data, "Member since").
//
// The gateway already did: token check, "signed in with a profile" check, global rate limit, safe errors, timeout.
// This route ONLY looks up the row of the caller. The row is chosen by the verified token (identity.userId),
// never by anything in the URL or body, so nobody can ask for someone else's profile.
// It answers with four fields and nothing else: name, created_at, stamps_data, penalty_data.
// Not returned on purpose: id, identifier (email), role, tier, status, auth_user_id.
import { HttpError } from '../gateway/errors.js';
import type { RouteContext, RouteDef, RouteResult } from '../gateway/types.js';

const COLUMNS = 'name,created_at,stamps_data,penalty_data';

export function myProfileRoute(getClient: () => any): RouteDef {
  return {
    method: 'GET',
    path: '/my-profile',
    access: 'customer', // any signed-in user that has a profile (customers, and staff using the store)
    handle: (ctx) => handle(ctx, getClient()),
  };
}

async function handle(ctx: RouteContext, admin: any): Promise<RouteResult> {
  const caller = ctx.identity!; // 'customer' route: the gateway guarantees a verified identity
  const { data, error } = await admin.from('profiles').select(COLUMNS).eq('auth_user_id', caller.userId).maybeSingle();
  if (error) {
    console.error(`my-profile ${ctx.requestId}: could not read the profile: ${error.message}`);
    throw new HttpError(500, 'Could not load your profile. Please try again.');
  }
  if (!data) throw new HttpError(404, 'Profile not found.');
  return {
    status: 200,
    body: {
      ok: true,
      profile: {
        name: data.name ?? null,
        created_at: data.created_at ?? null,
        stamps_data: data.stamps_data ?? null,
        penalty_data: data.penalty_data ?? null,
      },
    },
  };
}
