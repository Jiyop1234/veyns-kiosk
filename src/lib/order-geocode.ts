// Small browser helpers for /api/order-geocode. They never receive the generated map address:
// the server writes it to a staff-only table, and staff read it from there.
import { supabase } from '@/lib/supabase';

// Customer checkout: ask the server to generate the admin-only map address for the order just placed.
export async function requestCustomerGeocode(orderId: string, idempotencyKey: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    await fetch('/api/order-geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ orderId, idempotencyKey }),
    });
  } catch { /* best effort: staff can generate it later from the dashboard */ }
}

// Staff dashboard: generate (or retry) map addresses for up to 3 orders. Resolves true when the call succeeded.
export async function requestStaffGeocode(orderIds: string[], force = false): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token || orderIds.length === 0) return false;
    const res = await fetch('/api/order-geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ orderIds, force }),
    });
    return res.ok;
  } catch { return false; }
}
