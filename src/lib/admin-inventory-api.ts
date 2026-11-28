// VEYNS Admin, Inventory: browser helper for the six Inventory gateway routes (Step 6C-3).
// Same style as admin-ledger-api.ts: the staff member's session token goes in the Authorization header;
// the server takes the user id from the token, never from the body.

import { supabase } from '@/lib/supabase';
import type { IngredientInput, RecipePatch } from '@/components/admin/inventory/admin-inventory-types';

export type InventoryWriteResult = { ok: true; id?: string } | { ok: false; error: string };

async function callInventoryRoute(path: string, payload: Record<string, unknown>): Promise<InventoryWriteResult> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return { ok: false, error: 'Your session expired. Please sign in again.' };
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!body) return { ok: false, error: res.status === 404 ? `The Inventory service (${path}) is not deployed.` : 'Unexpected response from the Inventory service.' };
    if (!res.ok || !body.ok) return { ok: false, error: body.error || 'Request failed.' };
    return { ok: true, id: body.id };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

export const saveInventoryIngredient = (input: IngredientInput, id: string | null) =>
  callInventoryRoute('/api/admin-inventory-save-ingredient', { id, ...input });
export const restockInventoryIngredient = (id: string, amount: number, paid?: number) =>
  callInventoryRoute('/api/admin-inventory-restock', { id, amount, paid: paid ?? null });
export const wasteInventoryIngredient = (id: string, amount: number) =>
  callInventoryRoute('/api/admin-inventory-waste', { id, amount });
export const cookInventoryDish = (dishId: string, count: number) =>
  callInventoryRoute('/api/admin-inventory-cook', { dishId, count });
export const saveInventoryRecipe = (dishId: string, patch: RecipePatch) =>
  callInventoryRoute('/api/admin-inventory-save-recipe', { dishId, bowls: patch.bowls, price: patch.price, lines: patch.lines });
export const addInventoryDish = (name: string) =>
  callInventoryRoute('/api/admin-inventory-add-dish', { name });
