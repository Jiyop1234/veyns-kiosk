// Browser helper for GET /api/my-orders (Step 5E-3).
// "My Order History" used to read the orders table straight from the browser. It now asks the gateway, which
// checks the login and returns only this customer's orders, with only the columns the screen shows.
// Resolves with the list of order rows (newest first). Throws an Error if the call fails, so the caller can fall
// back to what it did before (the screen keeps its old fallback until Step 5E-4).
import { supabase } from '@/lib/supabase';

export async function fetchMyOrders(): Promise<any[]> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Please sign in again to see your orders.');

  let res: Response;
  try {
    res = await fetch('/api/my-orders', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    });
  } catch {
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }

  let json: any = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || !json?.ok || !Array.isArray(json.orders)) {
    throw new Error(String(json?.error || 'Your orders could not be loaded.'));
  }
  return json.orders;
}
