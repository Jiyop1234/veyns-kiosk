// VEYNS Admin, Ledger: the data hook (Step 6B-4).
// Reads the real entries from the database (admin-only by policy, voided entries left out) and writes
// through the gateway routes. The screens only use what this returns.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addLedgerEntry, updateLedgerEntry, voidLedgerEntry } from '@/lib/admin-ledger-api';
import type { LedgerWriteResult } from '@/lib/admin-ledger-api';
import type { LedgerEntry, LedgerEntryInput, LedgerKind } from './admin-ledger-types';

type Row = {
  id: string;
  kind: string;
  occurred_at: string;
  description: string;
  category: string;
  amount_centavos: number | string;
  notes: string | null;
};

const toEntry = (r: Row): LedgerEntry => ({
  id: r.id,
  kind: r.kind as LedgerKind,
  occurredAt: Date.parse(r.occurred_at),
  description: r.description,
  category: r.category,
  amountCentavos: Number(r.amount_centavos),
  notes: r.notes ?? '',
});

export function useAdminLedgerData() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const alive = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ledger_entries')
      .select('id, kind, occurred_at, description, category, amount_centavos, notes')
      .is('voided_at', null)
      .order('occurred_at', { ascending: false });
    if (!alive.current) return;
    if (error) {
      setLoadError(error.message || 'Could not load the ledger.');
    } else {
      setLoadError('');
      setEntries((data as Row[]).map(toEntry));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  // Each write goes to the gateway first; the list is read again only when the database accepted it.
  const finish = useCallback(
    async (result: LedgerWriteResult) => {
      if (result.ok) await reload();
      return result;
    },
    [reload],
  );

  const addEntry = useCallback(async (input: LedgerEntryInput) => finish(await addLedgerEntry(input)), [finish]);
  const updateEntry = useCallback(async (id: string, input: LedgerEntryInput) => finish(await updateLedgerEntry(id, input)), [finish]);
  const voidEntry = useCallback(async (id: string) => finish(await voidLedgerEntry(id)), [finish]);

  return { entries, loading, loadError, reload, addEntry, updateEntry, voidEntry };
}
