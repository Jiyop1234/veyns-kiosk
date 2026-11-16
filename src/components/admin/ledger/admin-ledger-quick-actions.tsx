// VEYNS Admin, Ledger: Quick Actions tiles (Step B10a).
// Only Export Report works in this step. The other two are marked "Soon" and are disabled.

import { BarChart3, Download, LayoutGrid } from 'lucide-react';

type Props = { onExport: () => void; exportDisabled: boolean };

const tile =
  'flex flex-col items-center gap-2 rounded-xl bg-white/[0.04] px-2 py-3 text-center text-xs text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400';

export function AdminLedgerQuickActions({ onExport, exportDisabled }: Props) {
  return (
    <section className="rounded-2xl bg-white/[0.04] p-4">
      <h3 className="mb-3 text-base font-semibold text-white">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onExport} disabled={exportDisabled} className={`${tile} enabled:hover:bg-white/[0.08] disabled:opacity-50`}>
          <Download className="h-5 w-5 text-lime-300" aria-hidden="true" />
          Export Report
        </button>
        <button type="button" disabled title="Coming in a later step" className={`${tile} opacity-50`}>
          <BarChart3 className="h-5 w-5 text-lime-300" aria-hidden="true" />
          View Reports
          <span className="text-[10px] uppercase tracking-wide text-zinc-400">Soon</span>
        </button>
        <button type="button" disabled title="Coming in a later step" className={`${tile} opacity-50`}>
          <LayoutGrid className="h-5 w-5 text-lime-300" aria-hidden="true" />
          Manage Categories
          <span className="text-[10px] uppercase tracking-wide text-zinc-400">Soon</span>
        </button>
      </div>
    </section>
  );
}
