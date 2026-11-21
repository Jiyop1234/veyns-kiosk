// Browser helper for POST /api/place-order (Step 5E-2).
// Checkout used to call the database function place_order straight from the browser. It now asks the gateway,
// which checks the login, limits the rate and the size, and then places the order on the server.
// Resolves with the saved order row (the same row the database used to return). Throws an Error whose message
// is safe to show to the customer (for example "Time slot is fully booked.").
import { supabase } from '@/lib/supabase';

export async function placeOrder(order: Record<string, any>): Promise<any> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Please sign in again to place your order.');

  let res: Response;
  try {
    res = await fetch('/api/place-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ order }),
    });
  } catch {
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }

  let json: any = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || !json?.ok || !json.order) {
    throw new Error(String(json?.error || 'Order could not be saved.'));
  }
  return json.order;
}
