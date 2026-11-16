// VEYNS Admin, Ledger: the Ledger screen (Steps B10a and B10b).
// Two layouts share the same panels:
// - fit (large screen, set by the dashboard): the page does not scroll. Heading and summary cards on top; below them three
//   columns: Transaction History | Add Transaction form | Cash Flow, Top Categories and Quick Actions.
// - normal (smaller screens): the stacked layout of Step B10a; the page scrolls.
// Data comes from useAdminLedgerData (sample data for now).

import { useMemo, useRef, useState } from 'react';
import { ChevronRight, RefreshCw, Wallet } from 'lucide-react';
import { AdminLedgerCashFlowChart, AdminLedgerCategoryDonut } from './admin-ledger-charts';
import { categoryBreakdown, dailySeries, totalsFor } from './admin-ledger-calc';
import { useAdminLedgerData } from './admin-ledger-data';
import { AdminLedgerForm } from './admin-ledger-form';
import { DAY_MS, entriesToCsv, inRange, manilaStartOfDay, manilaStartOfWeek, periodRange, previousPeriodRange, toInputValue } from './admin-ledger-format';
import { AdminLedgerHistory } from './admin-ledger-history';
import { AdminLedgerQuickActions } from './admin-ledger-quick-actions';
import { AdminLedgerSummaryCards } from './admin-ledger-summary-cards';
import { LEDGER_PERIODS } from './admin-ledger-types';
import type { LedgerEntry, LedgerEntryInput, LedgerPeriod } from './admin-ledger-types';

type Props = { active?: boolean; fit?: boolean };

export function AdminLedgerTab({ active = true, fit = false }: Props) {
  const { entries, addEntry, updateEntry, deleteEntry, resetSample } = useAdminLedgerData();
  const [period, setPeriod] = useState<LedgerPeriod>('month');
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const formAnchor = useRef<HTMLDivElement>(null);

  // "Now" is taken again whenever the data or the period changes.
  const now = useMemo(() => Date.now(), [entries, period]);

  const sorted = useMemo(() => [...entries].sort((a, b) => b.occurredAt - a.occurredAt), [entries]);
  const periodInfo = LEDGER_PERIODS.find((p) => p.id === period) ?? LEDGER_PERIODS[2];

  const current = useMemo(() => {
    const range = periodRange(period, now);
    return sorted.filter((e) => inRange(e.occurredAt, range));
  }, [sorted, period, now]);

  const previousTotals = useMemo(() => {
    const range = previousPeriodRange(period, now);
    return range ? totalsFor(sorted.filter((e) => inRange(e.occurredAt, range))) : null;
  }, [sorted, period, now]);

  const totals = useMemo(() => totalsFor(current), [current]);
  const balance = useMemo(() => totalsFor(sorted).net, [sorted]);
  const spark = useMemo(() => dailySeries(sorted, manilaStartOfDay(now) - 6 * DAY_MS, 7), [sorted, now]);
  const week = useMemo(() => dailySeries(sorted, manilaStartOfWeek(now), 7), [sorted, now]);
  const incomeShares = useMemo(() => categoryBreakdown(current, 'income'), [current]);

  // In the fit layout the form is always on screen, so the page must not scroll: the cursor goes to the form instead.
  const showForm = () => {
    if (fit) {
      const el = document.getElementById('ledger-description');
      if (el) el.focus({ preventScroll: true });
    } else {
      formAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNew = () => {
    setEditing(null);
    showForm();
  };

  const handleEdit = (entry: LedgerEntry) => {
    setEditing(entry);
    showForm();
  };

  const handleSubmit = (input: LedgerEntryInput, editingId: string | null) => {
    if (editingId) updateEntry(editingId, input);
    else addEntry(input);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    deleteEntry(id);
    if (editing && editing.id === id) setEditing(null);
  };

  const handleExport = () => {
    const blob = new Blob([entriesToCsv(current)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `veyns-ledger-${period}-${toInputValue(now).slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // The panels, placed differently by the two layouts below.
  const historyPanel = (
    <AdminLedgerHistory fill={fit} entries={current} editingId={editing ? editing.id : null} onNew={handleNew} onEdit={handleEdit} onDelete={handleDelete} />
  );

  const formPanel = <AdminLedgerForm fill={fit} editing={editing} onSubmit={handleSubmit} onCancelEdit={() => setEditing(null)} />;

  const cashFlowHeader = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-base font-semibold text-white">Cash Flow Overview</h3>
      <div className="flex items-center gap-3 text-xs text-zinc-300">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" aria-hidden="true" />
          Expenses
        </span>
      </div>
    </div>
  );

  const cashFlowPanel = (
    <section className={`rounded-2xl bg-white/[0.04] p-4 ${fit ? 'flex min-h-0 flex-1 flex-col' : 'sm:p-5'}`}>
      {cashFlowHeader}
      {fit ? (
        <div className="relative min-h-[7.5rem] flex-1">
          <AdminLedgerCashFlowChart fill income={week.income} expense={week.expense} />
        </div>
      ) : (
        <AdminLedgerCashFlowChart income={week.income} expense={week.expense} />
      )}
      <p className="mt-1 text-xs text-zinc-500">This week, Monday to Sunday.</p>
    </section>
  );

  const categoriesPanel = (
    <section className={`rounded-2xl bg-white/[0.04] p-4 ${fit ? 'shrink-0' : 'sm:p-5'}`}>
      <h3 className="mb-3 text-base font-semibold text-white">Top Categories</h3>
      <AdminLedgerCategoryDonut compact={fit} shares={incomeShares} total={totals.income} />
      <p className={`text-center text-xs text-zinc-500 ${fit ? 'mt-2' : 'mt-3'}`}>Income by category, {periodInfo.label.toLowerCase()}.</p>
    </section>
  );

  const quickActionsPanel = <AdminLedgerQuickActions compact={fit} onExport={handleExport} exportDisabled={current.length === 0} />;

  return (
    <div className={!active ? 'hidden' : fit ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-4'}>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        {/* Heading: breadcrumb, title and subtitle (tablet and desktop; on phones the top bar already shows the title) */}
        <div className="hidden md:block">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-lime-400 text-black">
              <Wallet className="h-3 w-3" aria-hidden="true" />
            </span>
            <ChevronRight className="h-3 w-3 text-zinc-400" aria-hidden="true" />
            Ledger
          </p>
          <h1 className="font-display text-3xl font-extrabold leading-tight text-white">Ledger</h1>
          <p className="text-xs text-zinc-400">Track all your business transactions in one place.</p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mx-auto w-fit max-w-full rounded-xl bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200">
            Sample data: this screen is not connected to the database yet. What you add or change here is not saved, and a reload brings the sample back.
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label>
            <span className="sr-only">Period</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as LedgerPeriod)}
              className="rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 [color-scheme:dark]"
            >
              {LEDGER_PERIODS.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#141817]">
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              resetSample();
              setEditing(null);
            }}
            aria-label="Reset sample data"
            title="Reset sample data"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="shrink-0">
        <AdminLedgerSummaryCards
          income={totals.income}
          expense={totals.expense}
          net={totals.net}
          balance={balance}
          previous={previousTotals}
          compareLabel={periodInfo.compareLabel}
          spark={{ income: spark.income, expense: spark.expense, net: spark.net, balance: spark.balance }}
        />
      </div>

      {fit ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px_380px] grid-rows-[minmax(0,1fr)] gap-3">
          <div className="min-h-0 min-w-0">{historyPanel}</div>
          <div className="min-h-0">{formPanel}</div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            {cashFlowPanel}
            {categoriesPanel}
            {quickActionsPanel}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            {historyPanel}
            <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              {cashFlowPanel}
              {categoriesPanel}
            </div>
          </div>
          <div className="space-y-4">
            <div ref={formAnchor} className="scroll-mt-4">
              {formPanel}
            </div>
            {quickActionsPanel}
          </div>
        </div>
      )}
    </div>
  );
}
