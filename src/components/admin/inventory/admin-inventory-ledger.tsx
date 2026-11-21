// VEYNS Admin, Inventory: a short panel with the latest stock movements (Step B12b), newest first, times in Manila.
import { Clock } from 'lucide-react';
import type { InventoryLedgerEntry, LedgerAction } from './admin-inventory-types';

const ACTION_CLS: Record<LedgerAction, string> = {
  Restock: 'text-lime-300',
  Usage: 'text-sky-300',
  Waste: 'text-red-300',
  Adjust: 'text-amber-300',
};

const fmtDate = (ms: number): string =>
  new Date(ms).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function AdminInventoryLedger({ entries, fill }: { entries: InventoryLedgerEntry[]; fill: boolean }) {
  return (
    <section className={`rounded-2xl bg-white/[0.04] px-4 py-3 ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <h3 className="mb-1 flex shrink-0 items-center gap-2 text-sm font-semibold text-white">
        <Clock className="h-4 w-4 text-lime-400" aria-hidden="true" />
        Recent stock movements
      </h3>
      <ul className={`text-[11px] text-zinc-300 ${fill ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-40 overflow-y-auto'}`}>
        {entries.length === 0 ? (
          <li className="py-2 text-zinc-500">No stock movements yet.</li>
        ) : (
          entries.slice(0, 20).map((e) => (
            <li key={e.id} className="flex items-baseline gap-2 py-0.5">
              <span className="w-24 shrink-0 text-zinc-500">{fmtDate(e.at)}</span>
              <span className={`w-14 shrink-0 font-bold ${ACTION_CLS[e.action]}`}>{e.action}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-white">{e.item}</span>
              <span className="shrink-0">{e.qtyLabel}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
