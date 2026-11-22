// The VEYNS API gateway: the single door for everything under /api.
// Order of checks for every request:
//   1 route exists (else 404)  2 method allowed (else 405)  3 rate limit (else 429)
//   4 login token + role for the route's access level (else 401 / 403); 'optional' routes accept anonymous callers
//   5 body size and JSON shape (else 413 / 400)  6 route validation (else 400)
//   7 route runs under a timeout (else 504)  8 safe error answers, one log line per request.
// Routes NEVER do their own token or role checks. They only declare `access`.
import { randomUUID } from 'node:crypto';
import { HttpError, TimeoutError } from './errors.js';
import { createRateLimiter } from './rateLimit.js';
import { defaultLog } from './requestLog.js';
import type { Access, GatewayDeps, Identity, RouteDef } from './types.js';

const ACCESS_LEVELS: Access[] = ['public', 'optional', 'customer', 'staff', 'admin'];
// Single segment only: on Vercel this catch-all file receives /api/<name> and nothing deeper (found on the 4B preview:
// /api/health worked, /api/health/staff never reached the gateway). Use flat names like /health-staff.
const PATH_RE = /^\/[a-z0-9_-]+$/;
const DEFAULT_TIMEOUT_MS = 8000;       // Free plan functions stop at about 10 s; stay under it
const AUTH_TIMEOUT_MS = 4000;
const DEFAULT_MAX_BODY = 100_000;      // bytes
const GLOBAL_LIMIT = { max: 120, windowSeconds: 60 }; // per caller IP, all routes together

function roleAllows(access: Access, identity: Identity | null): boolean {
  if (access === 'public' || access === 'optional') return true; // 'optional': the route itself decides what an anonymous caller may do
  if (!identity) return false;
  if (access === 'customer') return true;
  if (access === 'staff') return identity.role === 'employee' || identity.role === 'admin';
  return identity.role === 'admin';
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new TimeoutError()), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

function routePath(req: any): string | null {
  let pathname = '';
  try { pathname = new URL(String(req.url || '/'), 'http://gateway.local').pathname; } catch { return null; }
  let p: string;
  if (pathname.startsWith('/api/')) {
    p = pathname.slice(4);
  } else {
    // fallback if the platform rewrote the URL: use the catch-all segment(s)
    const q = req.query?.route;
    const joined = Array.isArray(q) ? q.join('/') : typeof q === 'string' ? q : '';
    if (!joined) return null;
    p = '/' + joined;
  }
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return PATH_RE.test(p) ? p : null;
}

function clientIp(req: any): string {
  const h = req.headers || {};
  const raw = String(h['x-vercel-forwarded-for'] || h['x-forwarded-for'] || h['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
  return raw.split(',')[0].trim().slice(0, 64) || 'unknown';
}

function readQuery(req: any): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const u = new URL(String(req.url || '/'), 'http://gateway.local');
    let n = 0;
    for (const [k, v] of u.searchParams) { if (n++ >= 20) break; out[k.slice(0, 50)] = v.slice(0, 200); }
  } catch { /* ignore */ }
  return out;
}

type BodyResult = { ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string };

function readBody(req: any, method: string, maxBytes: number): BodyResult {
  if (method !== 'POST') return { ok: true, body: {} };
  const declared = Number(req.headers?.['content-length'] || 0);
  if (declared > maxBytes) return { ok: false, status: 413, error: 'Request is too large.' };
  let raw: unknown = req.body;
  if (raw === undefined || raw === null || raw === '') return { ok: true, body: {} };
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) raw = (raw as any).toString('utf8');
  if (typeof raw === 'string') {
    if (raw.length > maxBytes) return { ok: false, status: 413, error: 'Request is too large.' };
    try { raw = JSON.parse(raw); } catch { return { ok: false, status: 400, error: 'Request body is not valid JSON.' }; }
  } else {
    try { if (JSON.stringify(raw).length > maxBytes) return { ok: false, status: 413, error: 'Request is too large.' }; }
    catch { return { ok: false, status: 400, error: 'Request body is not valid.' }; }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, status: 400, error: 'Request body must be a JSON object.' };
  return { ok: true, body: raw as Record<string, unknown> };
}

export function createGateway(deps: GatewayDeps) {
  const now = deps.now || Date.now;
  const log = deps.log || defaultLog;
  const hit = createRateLimiter(now);

  // ---- deny by default: refuse to start with a badly declared route ----
  const table = new Map<string, Map<string, RouteDef>>(); // path -> method -> route
  for (const r of deps.routes) {
    if (!ACCESS_LEVELS.includes(r.access)) throw new Error(`gateway: route ${r.method} ${r.path} has no valid access level`);
    if (!PATH_RE.test(r.path)) throw new Error(`gateway: route path "${r.path}" is not allowed (one lowercase segment only, e.g. /health-staff)`);
    if (typeof r.handle !== 'function') throw new Error(`gateway: route ${r.method} ${r.path} has no handler`);
    const methods = table.get(r.path) || new Map<string, RouteDef>();
    if (methods.has(r.method)) throw new Error(`gateway: duplicate route ${r.method} ${r.path}`);
    methods.set(r.method, r);
    table.set(r.path, methods);
  }

  return async function gateway(req: any, res: any): Promise<void> {
    const started = now();
    const requestId = randomUUID();
    const method = String(req.method || 'GET').toUpperCase();
    let path = '(unmatched)';
    let access: string = '-';
    let role: string = '-';
    let status = 500;

    const send = (code: number, body: Record<string, unknown>, headers: Record<string, string> = {}) => {
      status = code;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Request-Id', requestId);
      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      res.status(code).json(body);
    };

    try {
      const p = routePath(req);
      const methods = p ? table.get(p) : undefined;

      // global flood guard first, so scanners probing unknown paths are slowed too
      const ip = clientIp(req);
      const g = hit('g:' + ip, GLOBAL_LIMIT.max, GLOBAL_LIMIT.windowSeconds);
      if (!g.allowed) return send(429, { ok: false, error: 'Too many requests. Please wait a moment.' }, { 'Retry-After': String(g.retryAfterSeconds) });

      if (!p || !methods) return send(404, { ok: false, error: 'Not found.' });
      const route = methods.get(method);
      if (!route) return send(405, { ok: false, error: 'Method not allowed.' }, { Allow: [...methods.keys()].join(', ') });
      path = route.path;
      access = route.access;

      if (route.rateLimit) {
        const r = hit(`r:${route.method}:${route.path}:${ip}`, route.rateLimit.max, route.rateLimit.windowSeconds);
        if (!r.allowed) return send(429, { ok: false, error: 'Too many requests. Please wait a moment.' }, { 'Retry-After': String(r.retryAfterSeconds) });
      }

      // ---- who is calling, and are they allowed here ----
      let identity: Identity | null = null;
      if (route.access !== 'public') {
        const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
        const optional = route.access === 'optional';
        if (!token && !optional) return send(401, { ok: false, error: 'Sign in required.' });
        if (token) {
          try {
            identity = await withTimeout(deps.resolveIdentity(token), AUTH_TIMEOUT_MS);
          } catch (e: any) {
            console.error(`gateway ${requestId}: identity lookup failed:`, e?.message);
            return send(503, { ok: false, error: 'Service temporarily unavailable.' });
          }
          // 'optional' routes treat a token that is not valid like no token (anonymous); the route decides what that may do.
          if (!identity && !optional) return send(401, { ok: false, error: 'Your session is invalid or expired. Please sign in again.' });
        }
        if (identity) role = identity.role;
        if (!optional && !roleAllows(route.access, identity)) return send(403, { ok: false, error: 'You are not allowed to do that.' });
      }

      // ---- body, validation ----
      const parsed = readBody(req, method, route.maxBodyBytes ?? DEFAULT_MAX_BODY);
      if (!parsed.ok) return send(parsed.status, { ok: false, error: parsed.error });
      let body = parsed.body;
      if (route.validate) {
        const v = route.validate(body);
        if (!v.ok) return send(400, { ok: false, error: v.error });
        body = v.value;
      }

      // ---- run the route under a timeout ----
      const result = await withTimeout(
        route.handle({ requestId, method, path: route.path, query: readQuery(req), body, identity, ip }),
        route.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      return send(result.status, result.body);
    } catch (e: any) {
      if (e instanceof HttpError) return send(e.status, { ok: false, error: e.publicMessage, ...(e.code ? { code: e.code } : {}) });
      if (e instanceof TimeoutError) return send(504, { ok: false, error: 'The request took too long.' });
      console.error(`gateway ${requestId}: unexpected error:`, e?.message);
      return send(500, { ok: false, error: 'Something went wrong. Please try again.', requestId });
    } finally {
      log({ t: new Date(started).toISOString(), requestId, method, path, access, role, status, ms: now() - started });
    }
  };
}
