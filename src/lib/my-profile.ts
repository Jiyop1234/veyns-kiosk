// Browser helper for GET /api/my-profile (Step 5D).
// The customer screens used to read public.profiles straight from the browser. They now ask the gateway,
// which looks the row up from the login token. Returns { name, created_at, stamps_data, penalty_data },
// or null when the visitor is not signed in or anything goes wrong (callers keep their old fallbacks).
// Calls made at the same moment share one request (one page load asks for the profile from several places).
import { supabase } from '@/lib/supabase';

export interface MyProfile {
  name: string | null;
  created_at: string | null;
  stamps_data: any[] | null;
  penalty_data: any | null;
}

let inFlight: Promise<MyProfile | null> | null = null;

async function request(): Promise<MyProfile | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return null;
    const res = await fetch('/api/my-profile', { method: 'GET', headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.profile ?? null;
  } catch {
    return null;
  }
}

export function fetchMyProfile(): Promise<MyProfile | null> {
  if (inFlight) return inFlight;
  const p = request();
  inFlight = p;
  void p.finally(() => { if (inFlight === p) inFlight = null; });
  return p;
}
