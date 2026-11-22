// Shared types for the VEYNS API gateway.
// Access levels, from open to strict:
//   public   anyone (no token needed)
//   optional anyone may call. A valid token, if sent, gives the route an identity; no token (or a token that is
//            not valid) gives the route identity = null. The ROUTE must then prove the caller another way and
//            must treat a null identity as an anonymous visitor. Use only where a guest needs the route (4C-3).
//   customer any signed-in user that has a profile (regular, employee or admin)
//   staff    employee or admin
//   admin    admin only
export type Access = 'public' | 'optional' | 'customer' | 'staff' | 'admin';
export type Role = 'regular' | 'employee' | 'admin';

export interface Identity {
  userId: string; // Supabase auth user id (from the verified token, never from the browser body)
  role: Role;     // read from the database, never from the browser
}

export interface RouteContext {
  requestId: string;
  method: string;
  path: string;
  query: Record<string, string>;
  body: Record<string, unknown>; // already parsed, size-limited and validated
  identity: Identity | null;     // null only on 'public' routes, and on 'optional' routes when the caller is anonymous
  ip?: string;                   // caller IP as the gateway read it (5F-2). Pass it on only where a database limit needs it; never log it.
}

export interface RouteResult {
  status: number;
  body: Record<string, unknown>;
}

export type ValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

export interface RouteDef {
  method: 'GET' | 'POST';
  path: string;          // e.g. '/health' (the gateway strips the '/api' prefix)
  access: Access;        // REQUIRED. A route without it is refused when the gateway starts.
  timeoutMs?: number;    // default 8000
  maxBodyBytes?: number; // default 100000
  rateLimit?: { max: number; windowSeconds: number }; // extra, stricter limit for this route (per caller IP)
  validate?: (body: Record<string, unknown>) => ValidationResult;
  handle: (ctx: RouteContext) => Promise<RouteResult>;
}

export interface GatewayDeps {
  routes: RouteDef[];
  // Verifies the access token and returns who the caller is, or null if the token is not valid.
  // Throws if the lookup itself failed (the gateway then answers 503, never "allowed").
  resolveIdentity: (token: string) => Promise<Identity | null>;
  now?: () => number;                       // injectable for tests
  log?: (line: Record<string, unknown>) => void; // injectable for tests
}
