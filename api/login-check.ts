// Vercel serverless function: rate-limited "which field was wrong?" check for the customer login page.
/// <reference types="node" />
//
// WHY THIS EXISTS
//   Supabase answers every failed sign-in with the same "Invalid login credentials" on purpose (so that
//   attackers cannot learn which emails have accounts). The shop owner wants the login page to say
//   "Incorrect email." / "Incorrect password." So the browser may ask this endpoint, and ONLY after a
//   sign-in has just failed. The endpoint is the single place where that knowledge is released, and it is
//   protected like a professional service would protect it:
//     * the database function login_email_exists() is no longer callable from the browser at all
//     * per-IP and per-email rate limits (stored in Postgres, so they hold across serverless instances)
//     * IPs and emails are stored only as keyed hashes (HMAC), never in clear text
//     * same-origin requests only, POST only, no caching, no detail in error responses
//     * when throttled or on any error the answer is "unavailable" and the UI falls back to the generic
//       "Invalid credentials." with both fields highlighted, so throttling never leaks anything
//   Supabase Auth's own sign-in rate limiting stays in force (this endpoint never signs anyone in).
//   Staff sign-in does NOT use this endpoint and keeps its generic message.
//
// Required Vercel environment variables (same as admin-create-customer.ts):
//   SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY (SECRET, server only)
//   SITE_URL  optional, e.g. https://your-site.vercel.app (extra allowed origin)
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const IP_LIMIT = 10;        // checks per IP per window
const EMAIL_LIMIT = 5;      // checks per email per window
const WINDOW_SECONDS = 900; // 15 minutes

function send(res: any, status: number, result: 'email_found' | 'email_not_found' | 'rate_limited' | 'unavailable') {
  res.status(status).setHeader('Cache-Control', 'no-store').json({ ok: result === 'email_found' || result === 'email_not_found', result });
}

function clientIp(req: any): string {
  const h = req.headers || {};
  const raw = String(h['x-vercel-forwarded-for'] || h['x-forwarded-for'] || h['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
  return raw.split(',')[0].trim().slice(0, 64) || 'unknown';
}

function sameOrigin(req: any): boolean {
  const origin = String(req.headers?.origin || '');
  if (!origin) return true; // non-browser callers carry no Origin; they are still rate limited below
  try {
    const host = new URL(origin).host;
    const allowed = new Set<string>([String(req.headers?.host || '')]);
    if (process.env.SITE_URL) { try { allowed.add(new URL(process.env.SITE_URL).host); } catch { /* ignore */ } }
    return allowed.has(host);
  } catch { return false; }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return send(res, 405, 'unavailable');

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('login-check: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return send(res, 500, 'unavailable');
  }
  if (!sameOrigin(req)) return send(res, 403, 'unavailable');

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return send(res, 400, 'unavailable');

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const hash = (v: string) => createHmac('sha256', serviceKey).update(v).digest('hex');

  try {
    const { data: allowed, error: limitErr } = await admin.rpc('login_check_allow', {
      p_ip_hash: hash('ip:' + clientIp(req)),
      p_email_hash: hash('email:' + email),
      p_ip_limit: IP_LIMIT,
      p_email_limit: EMAIL_LIMIT,
      p_window_seconds: WINDOW_SECONDS,
    });
    if (limitErr) { console.error('login-check: rate limiter failed:', limitErr.message); return send(res, 503, 'unavailable'); }
    if (allowed !== true) return send(res, 429, 'rate_limited');

    const { data: exists, error } = await admin.rpc('login_email_exists', { p_email: email });
    if (error || typeof exists !== 'boolean') { console.error('login-check: lookup failed:', error?.message); return send(res, 503, 'unavailable'); }
    return send(res, 200, exists ? 'email_found' : 'email_not_found');
  } catch (e: any) {
    console.error('login-check: unexpected error:', e?.message);
    return send(res, 500, 'unavailable');
  }
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}
