// Production identity lookup: verifies the Supabase access token, then reads the role from the database.
// The role is NEVER taken from the browser. Same rule as the three existing api/ functions.
import { getServiceClient } from '../db/client.js';
import type { Identity, Role } from './types.js';

const ROLES: Role[] = ['regular', 'employee', 'admin'];

export async function resolveIdentity(token: string): Promise<Identity | null> {
  const admin = getServiceClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null; // bad or expired token
  const { data: prof, error: profErr } = await admin
    .from('profiles').select('role').eq('auth_user_id', data.user.id).maybeSingle();
  if (profErr) throw new Error('profile lookup failed'); // lookup problem is NOT "not allowed": gateway answers 503
  if (!prof) return null; // signed in but no profile: no access
  const role = (prof.role || 'regular') as Role;
  if (!ROLES.includes(role)) return null;
  return { userId: data.user.id, role };
}
