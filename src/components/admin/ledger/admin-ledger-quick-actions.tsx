// VEYNS Admin, Ledger: Quick Actions tiles (Steps B10a and B10b).
// Only Export Report works in this step. The other two are marked "Soon" and are disabled.
// compact (large screen, no page scroll): smaller tiles so the panel is about 50 px shorter.

import { BarChart3, Download, LayoutGrid } from 'lucide-react';

type Props = { onExport: () => void; exportDisabled: boolean; compact?: boolean };

export function AdminLedgerQuickActions({ onExport, exportDisabled, compact = false }: Props) {
  const tile = `flex flex-col items-center rounded-xl bg-white/[0.04] text-center text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${
    compact ? 'gap-1 px-2 py-2 text-[11px] leading-tight' : 'gap-2 px-2 py-3 text-xs'
  }`;
  const icon = compact ? 'h-4 w-4 text-lime-300' : 'h-5 w-5 text-lime-300';
  const soon = compact ? 'text-[9px] uppercase tracking-wide text-zinc-400' : 'text-[10px] uppercase tracking-wide text-zinc-400';

  return (
    <section className={`rounded-2xl bg-white/[0.04] ${compact ? 'shrink-0 p-3' : 'p-4'}`}>
      <h3 className={`font-semibold text-white ${compact ? 'mb-2 text-sm' : 'mb-3 text-base'}`}>Quick Actions</h3>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onExport} disabled={exportDisabled} className={`${tile} enabled:hover:bg-white/[0.08] disabled:opacity-50`}>
          <Download className={icon} aria-hidden="true" />
          Export Report
        </button>
        <button type="button" disabled title="Coming in a later step" className={`${tile} opacity-50`}>
          <BarChart3 className={icon} aria-hidden="true" />
          View Reports
          <span className={soon}>Soon</span>
        </button>
        <button type="button" disabled title="Coming in a later step" className={`${tile} opacity-50`}>
          <LayoutGrid className={icon} aria-hidden="true" />
          Manage Categories
          <span className={soon}>Soon</span>
        </button>
      </div>
    </section>
  );
}
