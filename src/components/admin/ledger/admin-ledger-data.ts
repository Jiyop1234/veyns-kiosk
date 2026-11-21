// VEYNS Admin, Ledger: the data hook (Step B10a).
// For now it keeps sample entries in memory only (nothing is saved, a reload restores the sample).
// The database step replaces the inside of this file; the screens only use what it returns.

import { useCallback, useRef, useState } from 'react';
import { createSampleLedgerEntries } from './admin-ledger-sample-data';
import type { LedgerEntry, LedgerEntryInput } from './admin-ledger-types';

export function useAdminLedgerData() {
  const [entries, setEntries] = useState<LedgerEntry[]>(() => createSampleLedgerEntries(Date.now()));
  const counter = useRef(0);

  const addEntry = useCallback((input: LedgerEntryInput) => {
    counter.current += 1;
    const entry: LedgerEntry = { ...input, id: `local-${Date.now()}-${counter.current}` };
    setEntries((prev) => [entry, ...prev]);
  }, []);

  const updateEntry = useCallback((id: string, input: LedgerEntryInput) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...input, id } : e)));
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const resetSample = useCallback(() => {
    setEntries(createSampleLedgerEntries(Date.now()));
  }, []);

  return { entries, addEntry, updateEntry, deleteEntry, resetSample, isSample: true as const };
}
