// Gateway route: staff-only customer account creation (moved from api/admin-create-customer.ts, Step 4C-1).
// The gateway already did: token check, staff-or-admin role check, rate limit, body size and JSON check, timeout,
// safe errors. This file keeps ONLY the business rules, with the same URL, method, request body and answers
// as the old function, so the website needs no change.
//
// Actions (body.action): 'create' (default), 'resend', 'update_email' (admin only), 'send_reset'.
// Required environment variables (server only): SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or VITE_SUPABASE_URL);
// SITE_URL (activation link target, set in Production, Preview and Development).
import { HttpError } from '../gateway/errors.js';
import type { RouteContext, RouteDef, RouteResult } from '../gateway/types.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;
const ACTIONS = ['resend', 'update_email', 'send_reset'];

export function adminCreateCustomerRoute(getClient: () => any): RouteDef {
  return {
    method: 'POST',
    path: '/admin-create-customer',
    access: 'staff',
    timeoutMs: 9000,                              // just under the Free plan limit of about 10 s
    rateLimit: { max: 20, windowSeconds: 60 },    // new: the old function had no rate limit (finding F31a)
    handle: (ctx) => handle(ctx, getClient()),
  };
}

async function handle(ctx: RouteContext, admin: any): Promise<RouteResult> {
  const caller = ctx.identity!; // staff route: the gateway guarantees an employee or admin identity
  const body = ctx.body as Record<string, any>;
  const action = ACTIONS.includes(body.action) ? (body.action as string) : 'create';
  const email = String(body.email || '').trim().toLowerCase();
  if (action !== 'send_reset' && (!EMAIL_RE.test(email) || email.length > 254)) {
    throw new HttpError(400, 'Enter a valid email address.', 'invalid_email');
  }

  // Activation link target comes ONLY from the server setting SITE_URL (the old code also trusted the browser's Origin header).
  const siteUrl = (process.env.SITE_URL || '').toString().replace(/\/+$/, '') || undefined;
  const sendSetupEmail = async (to: string): Promise<string | null> => {
    const { error } = await admin.auth.resetPasswordForEmail(to, siteUrl ? { redirectTo: siteUrl } : undefined);
    return error ? error.message : null;
  };

  // ---- resend password-setup email ----
  if (action === 'resend') {
    const { data: prof } = await admin.from('profiles').select('role,auth_user_id').eq('identifier', email).maybeSingle();
    if (!prof?.auth_user_id || (prof.role || 'regular') !== 'regular') throw new HttpError(404, 'No customer account found for that email.');
    const mailErr = await sendSetupEmail(email);
    if (mailErr) throw new HttpError(502, 'The activation email could not be sent: ' + mailErr);
    return { status: 200, body: { ok: true, activationEmailSent: true } };
  }

  // ---- staff: change a customer's email / send a password-reset email ----
  // The admin never sees or types a password. The customer sets it through the emailed link.
  if (action === 'update_email' || action === 'send_reset') {
    // Changed order: the admin-only rule is checked first, so an employee learns nothing about which ids exist.
    if (action === 'update_email' && caller.role !== 'admin') throw new HttpError(403, 'Only administrators can change a customer email.');

    const { data: target } = await admin.from('profiles').select('id,auth_user_id,role').eq('id', String(body.profileId || '')).maybeSingle();
    if (!target?.auth_user_id || (target.role || 'regular') !== 'regular') throw new HttpError(404, 'Customer account not found.');
    const { data: au } = await admin.auth.admin.getUserById(target.auth_user_id);
    const current: string | undefined = au?.user?.email;

    if (action === 'send_reset') {
      if (!current) throw new HttpError(400, 'This account has no email address.');
      const mailErr = await sendSetupEmail(current);
      if (mailErr) throw new HttpError(502, 'Could not send the email: ' + mailErr);
      return { status: 200, body: { ok: true } };
    }

    // update_email (administrators only, checked above)
    if (current && current.toLowerCase() === email) throw new HttpError(400, 'That is already the current email.');
    const { data: dup } = await admin.from('profiles').select('id').eq('identifier', email).neq('id', target.id).maybeSingle();
    if (dup) throw new HttpError(409, 'That email is already used by another account.');
    const { error: upErr } = await admin.auth.admin.updateUserById(target.auth_user_id, { email, email_confirm: false });
    if (upErr) throw new HttpError(400, upErr.message);
    await admin.from('profiles').update({ identifier: email }).eq('id', target.id);
    const mailErr = await sendSetupEmail(email); // sent to the NEW address
    return { status: 200, body: { ok: true, activationEmailSent: !mailErr, activationError: mailErr || undefined } };
  }

  // ---- create: validate input ----
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const phone = String(body.phone || '').trim();
  if (name.length < 2 || name.length > 80) throw new HttpError(400, "Enter the customer's full name (2-80 characters).", 'invalid_name');
  if (phone && !PHONE_RE.test(phone)) throw new HttpError(400, 'Enter a valid contact number.', 'invalid_phone');

  // ---- duplicate check (profile row) ----
  const { data: existingProfile } = await admin.from('profiles').select('identifier').eq('identifier', email).maybeSingle();
  if (existingProfile) {
    throw new HttpError(409, 'A customer account with this email already exists. Search for them under "Existing Customer" instead.', 'duplicate_email');
  }

  // ---- create auth user (no password, unconfirmed until they use the setup link) ----
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { name, contact_number: phone || null, created_by_staff: caller.userId },
  });
  if (createErr || !created?.user) {
    const msg = String(createErr?.message || '');
    if (createErr?.code === 'email_exists' || /already|registered|exists/i.test(msg)) {
      throw new HttpError(409, 'An account with this email already exists. Search for them under "Existing Customer" instead.', 'duplicate_email');
    }
    console.error('admin-create-customer: createUser failed:', msg);
    throw new HttpError(500, 'The account could not be created. Nothing was saved. Please try again.');
  }
  const authUserId: string = created.user.id;

  // ---- create the linked profile; compensate (delete the auth user) on failure ----
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .insert({ auth_user_id: authUserId, identifier: email, name, role: 'regular', status: 'ACTIVE', tier: null, current_stamp_count: 1 })
    .select('id,name,identifier,auth_user_id')
    .single();
  if (profileErr || !profile) {
    console.error('admin-create-customer: profile insert failed:', profileErr?.message);
    const { error: rollbackErr } = await admin.auth.admin.deleteUser(authUserId);
    if (rollbackErr) console.error('admin-create-customer: ROLLBACK FAILED, orphan auth user', authUserId, rollbackErr.message);
    const dup = profileErr?.code === '23505';
    throw dup
      ? new HttpError(409, 'A customer account with this email already exists.', 'duplicate_email')
      : new HttpError(500, 'The customer profile could not be created, so the account was not kept. Please try again.', 'profile_failed');
  }

  // ---- password-setup email (the account exists either way) ----
  const mailErr = await sendSetupEmail(email);
  return {
    status: 201,
    body: {
      ok: true,
      customer: { id: profile.id, authUserId: profile.auth_user_id, name: profile.name, identifier: profile.identifier },
      activationEmailSent: !mailErr,
      activationError: mailErr || undefined,
    },
  };
}
