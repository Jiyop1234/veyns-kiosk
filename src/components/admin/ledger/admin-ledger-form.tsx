// VEYNS Admin, Ledger: Add / Edit Transaction form (Step B10a).

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowDown, ArrowUp, Save, X } from 'lucide-react';
import { centavosToInput, fromInputValue, parsePesoToCentavos, toInputValue } from './admin-ledger-format';
import { LEDGER_EXPENSE_CATEGORIES, LEDGER_INCOME_CATEGORIES } from './admin-ledger-types';
import type { LedgerEntry, LedgerEntryInput, LedgerKind } from './admin-ledger-types';

type Props = {
  editing: LedgerEntry | null;
  onSubmit: (input: LedgerEntryInput, editingId: string | null) => void;
  onCancelEdit: () => void;
};

const field =
  'w-full rounded-xl bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400';
const label = 'mb-1.5 block text-sm text-zinc-300';

export function AdminLedgerForm({ editing, onSubmit, onCancelEdit }: Props) {
  const [kind, setKind] = useState<LedgerKind>('income');
  const [when, setWhen] = useState(() => toInputValue(Date.now()));
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const resetFields = () => {
    setKind('income');
    setWhen(toInputValue(Date.now()));
    setDescription('');
    setCategory('');
    setAmount('');
    setNotes('');
  };

  // Load the entry being edited, or return to an empty form.
  useEffect(() => {
    setError('');
    if (editing) {
      setKind(editing.kind);
      setWhen(toInputValue(editing.occurredAt));
      setDescription(editing.description);
      setCategory(editing.category);
      setAmount(centavosToInput(editing.amountCentavos));
      setNotes(editing.notes);
    } else {
      resetFields();
    }
  }, [editing]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const categories = kind === 'income' ? LEDGER_INCOME_CATEGORIES : LEDGER_EXPENSE_CATEGORIES;

  const handleKind = (next: LedgerKind) => {
    setKind(next);
    const list = next === 'income' ? LEDGER_INCOME_CATEGORIES : LEDGER_EXPENSE_CATEGORIES;
    if (!list.includes(category)) setCategory('');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const occurredAt = fromInputValue(when);
    const centavos = parsePesoToCentavos(amount);
    if (occurredAt === null) return setError('Choose a valid date and time.');
    if (!description.trim()) return setError('Enter a description.');
    if (!category) return setError('Select a category.');
    if (centavos === null) return setError('Enter an amount greater than 0 (up to 2 decimals).');

    setError('');
    onSubmit({ kind, occurredAt, description: description.trim(), category, amountCentavos: centavos, notes: notes.trim() }, editing ? editing.id : null);
    setNotice(editing ? 'Transaction updated.' : 'Transaction added.');
    if (!editing) resetFields();
  };

  const kindButton = (value: LedgerKind, active: boolean) =>
    `flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${
      active
        ? value === 'income'
          ? 'bg-emerald-500/20 text-emerald-300'
          : 'bg-red-500/20 text-red-300'
        : 'bg-white/[0.05] text-zinc-300 hover:bg-white/[0.09]'
    }`;

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white/[0.04] p-4 sm:p-5" noValidate>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{editing ? 'Edit Transaction' : 'Add Transaction'}</h3>
          <p className="text-xs text-zinc-400">{editing ? 'Change the details and save.' : 'Record a new income or expense.'}</p>
        </div>
        {editing ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex items-center gap-1 rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Cancel
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Transaction type">
        <button type="button" aria-pressed={kind === 'income'} onClick={() => handleKind('income')} className={kindButton('income', kind === 'income')}>
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
          Income
        </button>
        <button type="button" aria-pressed={kind === 'expense'} onClick={() => handleKind('expense')} className={kindButton('expense', kind === 'expense')}>
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
          Expense
        </button>
      </div>

      <div className="mt-4 space-y-3.5">
        <div>
          <label htmlFor="ledger-when" className={label}>
            Date &amp; Time
          </label>
          <input id="ledger-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${field} [color-scheme:dark]`} />
        </div>
        <div>
          <label htmlFor="ledger-description" className={label}>
            Description
          </label>
          <input id="ledger-description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="Enter description..." className={field} />
        </div>
        <div>
          <label htmlFor="ledger-category" className={label}>
            Category
          </label>
          <select id="ledger-category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} [color-scheme:dark]`}>
            <option value="" className="bg-[#141817]">
              Select category
            </option>
            {categories.map((c) => (
              <option key={c} value={c} className="bg-[#141817]">
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ledger-amount" className={label}>
            Amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400" aria-hidden="true">
              ₱
            </span>
            <input id="ledger-amount" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount..." className={`${field} pl-8`} />
          </div>
        </div>
        <div>
          <label htmlFor="ledger-notes" className={label}>
            Notes (Optional)
          </label>
          <textarea id="ledger-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} rows={2} placeholder="Add notes..." className={`${field} resize-none`} />
        </div>
      </div>

      <div aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm">
        {error ? <p className="text-red-400">{error}</p> : notice ? <p className="text-emerald-400">{notice}</p> : null}
      </div>

      <button
        type="submit"
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {editing ? 'Save Changes' : 'Save Transaction'}
      </button>
    </form>
  );
}
