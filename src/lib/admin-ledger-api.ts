// VEYNS Admin, Ledger: browser helper for the three Ledger gateway routes (Step 6B-4).
// Same style as the other gateway helpers: the admin's session token goes in the Authorization header;
// the server takes the user id from the token, never from the body.

import { supabase } from '@/lib/supabase';
import type { LedgerEntryInput } from '@/components/admin/ledger/admin-ledger-types';

export type LedgerWriteResult = { ok: true; id?: string } | { ok: false; error: string };

async function callLedgerRoute(path: string, payload: Record<string, unknown>): Promise<LedgerWriteResult> {
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
    if (!body) return { ok: false, error: res.status === 404 ? `The Ledger service (${path}) is not deployed.` : 'Unexpected response from the Ledger service.' };
    if (!res.ok || !body.ok) return { ok: false, error: body.error || 'Request failed.' };
    return { ok: true, id: body.id };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

const bodyOf = (input: LedgerEntryInput) => ({
  kind: input.kind,
  occurredAt: new Date(input.occurredAt).toISOString(),
  description: input.description,
  category: input.category,
  amountCentavos: input.amountCentavos,
  notes: input.notes,
});

export const addLedgerEntry = (input: LedgerEntryInput) => callLedgerRoute('/api/admin-ledger-add', bodyOf(input));
export const updateLedgerEntry = (id: string, input: LedgerEntryInput) => callLedgerRoute('/api/admin-ledger-update', { id, ...bodyOf(input) });
export const voidLedgerEntry = (id: string) => callLedgerRoute('/api/admin-ledger-void', { id });
