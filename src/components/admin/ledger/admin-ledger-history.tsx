// VEYNS Admin, Ledger: Transaction History table with search, filters, paging, edit and delete (Step B10a).

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { formatDateTime, formatPeso } from './admin-ledger-format';
import {
  LEDGER_EXPENSE_CATEGORIES,
  LEDGER_FALLBACK_CATEGORY_CLASS,
  LEDGER_CATEGORY_CLASS,
  LEDGER_INCOME_CATEGORIES,
  LEDGER_PAGE_SIZE,
} from './admin-ledger-types';
import type { LedgerEntry, LedgerKind } from './admin-ledger-types';

type Props = {
  entries: LedgerEntry[]; // already limited to the chosen period and sorted newest first
  editingId: string | null;
  onNew: () => void;
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (id: string) => void | Promise<void>; // voids the entry
  fill?: boolean; // true on a large screen: the panel fills its parent and shows as many rows as fit, without a page scroll
};

type KindFilter = 'all' | LedgerKind;

const ALL_CATEGORIES = [...LEDGER_INCOME_CATEGORIES, ...LEDGER_EXPENSE_CATEGORIES];

// Fill mode: every table row is 52 px high plus 6 px of spacing; the table head and the spacing around it take 36 px.
const FILL_ROW_PX = 58;
const FILL_HEAD_PX = 36;
const FILL_MIN_ROWS = 3;
const FILL_MAX_ROWS = 30;

const field =
  'rounded-xl bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400';
const iconButton =
  'flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400';

export function AdminLedgerHistory({ entries, editingId, onNew, onEdit, onDelete, fill = false }: Props) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [fillRows, setFillRows] = useState(LEDGER_PAGE_SIZE);

  // Fill mode: count how many rows fit in the table area now, and again whenever that area changes size.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!fill || !el) return undefined;
    const measure = () => {
      const rows = Math.floor((el.clientHeight - FILL_HEAD_PX) / FILL_ROW_PX);
      setFillRows(Math.max(FILL_MIN_ROWS, Math.min(FILL_MAX_ROWS, rows)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fill]);

  const pageSize = fill ? fillRows : LEDGER_PAGE_SIZE;
  const cellY = fill ? 'py-2' : 'py-3';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (kind !== 'all' && e.kind !== kind) return false;
      if (category !== 'all' && e.category !== category) return false;
      if (!q) return true;
      return e.description.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
    });
  }, [entries, search, kind, category]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * pageSize;
  const visible = filtered.slice(startIndex, startIndex + pageSize);

  const firstPage = Math.max(1, Math.min(safePage - 2, pageCount - 4));
  const lastPage = Math.min(pageCount, firstPage + 4);
  const pageNumbers: number[] = [];
  for (let p = firstPage; p <= lastPage; p += 1) pageNumbers.push(p);

  const chip = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${
      active ? 'bg-lime-400 font-semibold text-black' : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'
    }`;

  return (
    <section className={`rounded-2xl bg-white/[0.04] ${fill ? 'flex h-full min-h-0 flex-col p-4' : 'p-4 sm:p-5'}`}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-white">Transaction History</h3>
            <p className="text-xs text-zinc-400">View and manage your income and expenses.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search transactions</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search transactions..."
              className={`${field} w-52 pl-9`}
            />
          </label>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-lime-400 px-3.5 py-2 text-sm font-semibold text-black hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Transaction
          </button>
        </div>
      </div>

      <div className={`flex shrink-0 flex-wrap items-center gap-2 ${fill ? 'mt-3' : 'mt-4'}`}>
        {(['all', 'income', 'expense'] as KindFilter[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setPage(1);
            }}
            className={chip(kind === k)}
          >
            {k === 'all' ? 'All' : k === 'income' ? 'Income' : 'Expense'}
          </button>
        ))}
        <label className="ml-auto">
          <span className="sr-only">Filter by category</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className={`${field} [color-scheme:dark]`}
          >
            <option value="all" className="bg-[#141817]">
              All Categories
            </option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-[#141817]">
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div ref={bodyRef} className={fill ? 'mt-1 min-h-0 flex-1 overflow-x-auto overflow-y-hidden' : 'mt-3 overflow-x-auto'}>
        <table className="w-full min-w-[680px] border-separate border-spacing-y-1.5 text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-400">
              <th className="px-3 py-1 font-medium">Date &amp; Time</th>
              <th className="px-3 py-1 font-medium">Type</th>
              <th className="px-3 py-1 font-medium">Description</th>
              <th className="px-3 py-1 font-medium">Category</th>
              <th className="px-3 py-1 text-right font-medium">Amount</th>
              <th className="px-3 py-1 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => {
              const isIncome = e.kind === 'income';
              const rowTone = e.id === editingId ? 'bg-lime-400/10' : 'bg-white/[0.03]';
              return (
                <tr key={e.id} className={`text-zinc-100 ${fill ? 'h-[52px]' : ''}`}>
                  <td className={`${rowTone} whitespace-nowrap rounded-l-xl px-3 ${cellY}`}>{formatDateTime(e.occurredAt)}</td>
                  <td className={`${rowTone} px-3 ${cellY}`}>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        isIncome ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                      }`}
                    >
                      {isIncome ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
                      {isIncome ? 'Income' : 'Expense'}
                    </span>
                  </td>
                  <td className={`${rowTone} px-3 ${cellY}`}>
                    <p className="font-medium">{e.description}</p>
                    {e.notes ? <p className="max-w-[16rem] truncate text-xs text-zinc-400">{e.notes}</p> : null}
                  </td>
                  <td className={`${rowTone} px-3 ${cellY}`}>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${LEDGER_CATEGORY_CLASS[e.category] ?? LEDGER_FALLBACK_CATEGORY_CLASS}`}>
                      {e.category}
                    </span>
                  </td>
                  <td className={`${rowTone} whitespace-nowrap px-3 ${cellY} text-right font-bold ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isIncome ? '+' : '-'}
                    {formatPeso(e.amountCentavos)}
                  </td>
                  <td className={`${rowTone} rounded-r-xl px-3 ${cellY}`}>
                    {confirmId === e.id ? (
                      <div className="flex items-center justify-end gap-1.5 text-xs">
                        <span className="text-zinc-300">Void?</span>
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(e.id);
                            setConfirmId(null);
                          }}
                          className="rounded-lg bg-red-500/80 px-2.5 py-1.5 font-semibold text-white hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          Yes
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} className="rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-zinc-200 hover:bg-white/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => onEdit(e)} aria-label={`Edit ${e.description}`} title="Edit" className={iconButton}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => setConfirmId(e.id)} aria-label={`Void ${e.description}`} title="Void (remove from the ledger)" className={iconButton}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">No transactions match.</p> : null}
      </div>

      <div className={`flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm text-zinc-300 ${fill ? 'mt-2' : 'mt-3'}`}>
        <p>
          {filtered.length === 0
            ? 'Showing 0 transactions'
            : `Showing ${startIndex + 1}-${Math.min(startIndex + pageSize, filtered.length)} of ${filtered.length} transactions`}
        </p>
        <nav className="flex items-center gap-1.5" aria-label="Transaction pages">
          <button type="button" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className={`${iconButton} disabled:opacity-40`}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {pageNumbers.map((p) => (
            <button
              key={p}
              type="button"
              aria-current={p === safePage ? 'page' : undefined}
              onClick={() => setPage(p)}
              className={`h-8 min-w-[2rem] rounded-lg px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${
                p === safePage ? 'bg-lime-400 font-semibold text-black' : 'text-zinc-200 hover:bg-white/[0.1]'
              }`}
            >
              {p}
            </button>
          ))}
          <button type="button" aria-label="Next page" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} className={`${iconButton} disabled:opacity-40`}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </section>
  );
}
