// Vercel serverless function: staff-only customer account creation.
/// <reference types="node" />
//
// Required Vercel environment variables (Project Settings -> Environment Variables):
//   SUPABASE_URL                (or the existing VITE_SUPABASE_URL is used as a fallback)
//   SUPABASE_SERVICE_ROLE_KEY   SECRET. Server only. Never prefix with VITE_.
//   SITE_URL                    optional, e.g. https://your-site.vercel.app (activation link target)
//
// Flow ("create"):
//   1. Verify the caller's Supabase access token and that the caller is an employee/admin.
//   2. Validate input and refuse duplicates (existing profile OR existing auth user).
//   3. Create the auth user WITHOUT a password (nobody, including staff, ever sees a credential).
//   4. Create the linked profile row (auth_user_id = the new auth user). If this fails the auth user is
//      deleted again, so no orphaned auth account is left behind.
//   5. Send a password-setup email (Supabase recovery link). The app already handles PASSWORD_RECOVERY.
// Flow ("resend"): re-sends the password-setup email for an existing regular customer.
import { createClient } from '@supabase/supabase-js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

function json(res: any, status: number, body: Record<string, unknown>) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('admin-create-customer: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return json(res, 500, { ok: false, error: 'Server is not configured for account creation.' });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---- 1. authenticate + authorise the caller (never trust role values from the browser) ----
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(res, 401, { ok: false, error: 'Sign in required.' });
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) return json(res, 401, { ok: false, error: 'Your session is invalid or expired. Please sign in again.' });
  const { data: staffRow } = await admin
    .from('profiles').select('role').eq('auth_user_id', caller.user.id).in('role', ['employee', 'admin']).maybeSingle();
  if (!staffRow) return json(res, 403, { ok: false, error: 'Only staff can create customer accounts.' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const action = body.action === 'resend' ? 'resend' : 'create';
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return json(res, 400, { ok: false, code: 'invalid_email', error: 'Enter a valid email address.' });

  const siteUrl = (process.env.SITE_URL || req.headers.origin || '').toString().replace(/\/+$/, '') || undefined;
  const sendSetupEmail = async () => {
    const { error } = await admin.auth.resetPasswordForEmail(email, siteUrl ? { redirectTo: siteUrl } : undefined);
    return error ? error.message : null;
  };

  // ---- resend password-setup email ----
  if (action === 'resend') {
    const { data: prof } = await admin.from('profiles').select('role,auth_user_id').eq('identifier', email).maybeSingle();
    if (!prof?.auth_user_id || (prof.role || 'regular') !== 'regular') {
      return json(res, 404, { ok: false, error: 'No customer account found for that email.' });
    }
    const mailErr = await sendSetupEmail();
    return mailErr
      ? json(res, 502, { ok: false, error: 'The activation email could not be sent: ' + mailErr })
      : json(res, 200, { ok: true, activationEmailSent: true });
  }

  // ---- 2. validate input ----
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const phone = String(body.phone || '').trim();
  if (name.length < 2 || name.length > 80) return json(res, 400, { ok: false, code: 'invalid_name', error: 'Enter the customer\'s full name (2-80 characters).' });
  if (phone && !PHONE_RE.test(phone)) return json(res, 400, { ok: false, code: 'invalid_phone', error: 'Enter a valid contact number.' });

  // ---- duplicate check (profile row) ----
  const { data: existingProfile } = await admin.from('profiles').select('identifier').eq('identifier', email).maybeSingle();
  if (existingProfile) {
    return json(res, 409, { ok: false, code: 'duplicate_email', error: 'A customer account with this email already exists. Search for them under "Existing Customer" instead.' });
  }

  // ---- 3. create auth user (no password, unconfirmed until they use the setup link) ----
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { name, contact_number: phone || null, created_by_staff: caller.user.id },
  });
  if (createErr || !created?.user) {
    const msg = String(createErr?.message || '');
    if ((createErr as any)?.code === 'email_exists' || /already|registered|exists/i.test(msg)) {
      return json(res, 409, { ok: false, code: 'duplicate_email', error: 'An account with this email already exists. Search for them under "Existing Customer" instead.' });
    }
    console.error('admin-create-customer: createUser failed:', msg);
    return json(res, 500, { ok: false, error: 'The account could not be created. Nothing was saved. Please try again.' });
  }
  const authUserId = created.user.id;

  // ---- 4. create the linked profile; compensate (delete auth user) on failure ----
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .insert({ auth_user_id: authUserId, identifier: email, name, role: 'regular', status: 'ACTIVE', tier: null, current_stamp_count: 1 })
    .select('id,name,identifier,auth_user_id')
    .single();
  if (profileErr || !profile) {
    console.error('admin-create-customer: profile insert failed:', profileErr?.message);
    const { error: rollbackErr } = await admin.auth.admin.deleteUser(authUserId);
    if (rollbackErr) console.error('admin-create-customer: ROLLBACK FAILED, orphan auth user', authUserId, rollbackErr.message);
    const dup = (profileErr as any)?.code === '23505';
    return json(res, dup ? 409 : 500, {
      ok: false, code: dup ? 'duplicate_email' : 'profile_failed',
      error: dup ? 'A customer account with this email already exists.' : 'The customer profile could not be created, so the account was not kept. Please try again.',
    });
  }

  // ---- 5. password-setup email (account exists either way) ----
  const mailErr = await sendSetupEmail();
  return json(res, 201, {
    ok: true,
    customer: { id: profile.id, authUserId: profile.auth_user_id, name: profile.name, identifier: profile.identifier },
    activationEmailSent: !mailErr,
    activationError: mailErr || undefined,
  });
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}
