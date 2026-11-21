// Gateway route: a signed-in customer reads their own order history (Step 5E-3).
// GET /api/my-orders  ->  { ok: true, orders: [ ...newest first... ] }
// The gateway already did: token check, "signed in with a profile" check, global rate limit, timeout, safe errors.
// This file does two things only:
//   1. read the orders whose user_id is the caller's id. The id comes from the verified token (ctx.identity.userId),
//      never from the query string or a body, so a customer can only ever read their own orders;
//   2. return ONLY the columns the "My Order History" screen shows. Everything else on the order row (for example
//      the saved map pin, internal notes, discount reasons, anything added to the table later) is dropped here, on
//      the server, so it can never leak by accident.
// The server uses the service key, which skips row security, so the user_id filter below IS the protection.
// Server environment: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (used by server/db/client.ts).
import { HttpError } from '../gateway/errors.js';
import type { RouteContext, RouteDef, RouteResult } from '../gateway/types.js';

const MAX_ORDERS = 200; // a safety cap; a customer's history is far smaller

// The only fields that leave the server. Same names the browser has always read from the orders row.
export function projectOrder(o: Record<string, any>): Record<string, unknown> {
  return {
    customer_name: o.customer_name ?? null,
    account_nickname: o.account_nickname ?? null,
    email: o.email ?? null,
    phone: o.phone ?? null,
    fulfillment: o.fulfillment ?? null,
    location: o.location ?? null,
    address: o.address ?? null,
    landmark: o.landmark ?? null,
    items: Array.isArray(o.items) ? o.items : [],
    total: o.total ?? 0,
    order_number: o.order_number ?? null,
    created_at: o.created_at ?? null,
    promo_code: o.promo_code ?? null,
    order_type: o.order_type ?? null,
    schedule_info: o.schedule_info ?? null,
    status: o.status ?? null,
    last_edited_at: o.last_edited_at ?? null,
  };
}

export function myOrdersRoute(getClient: () => any): RouteDef {
  return {
    method: 'GET',
    path: '/my-orders',
    access: 'customer',                          // any signed-in user with a profile
    timeoutMs: 9000,                             // just under the Free plan limit of about 10 s
    rateLimit: { max: 30, windowSeconds: 60 },   // the screen refreshes on open and on live updates
    handle: (ctx) => handle(ctx, getClient()),
  };
}

async function handle(ctx: RouteContext, admin: any): Promise<RouteResult> {
  const caller = ctx.identity!; // 'customer' route: the gateway guarantees a verified identity

  const { data, error } = await admin
    .from('orders')
    .select('*') // read on the server, then cut down to the safe fields below
    .eq('user_id', caller.userId)
    .order('created_at', { ascending: false })
    .limit(MAX_ORDERS);

  if (error) {
    console.error(`my-orders ${ctx.requestId}: database error ${String(error.code || '')}: ${String(error.message || '').slice(0, 200)}`);
    throw new HttpError(500, 'Your orders could not be loaded. Please try again.');
  }

  const orders = (Array.isArray(data) ? data : []).map(projectOrder);
  return { status: 200, body: { ok: true, orders } };
}
