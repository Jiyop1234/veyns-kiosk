// VEYNS Admin, Inventory: the Stock Ledger (Step B12): the latest stock movements, newest first (times in Manila).
import { Clock } from 'lucide-react';
import type { InventoryLedgerEntry, LedgerAction } from './admin-inventory-types';

const ACTION_CLS: Record<LedgerAction, string> = {
  Restock: 'text-lime-300',
  Usage: 'text-sky-300',
  Waste: 'text-red-300',
  Adjust: 'text-amber-300',
};

const fmtDate = (ms: number): string =>
  new Date(ms).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function AdminInventoryLedger({ entries, fill }: { entries: InventoryLedgerEntry[]; fill: boolean }) {
  return (
    <section className={`rounded-2xl bg-white/[0.04] p-4 ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <h3 className="mb-1 flex shrink-0 items-center gap-2 text-base font-semibold text-white">
        <Clock className="h-5 w-5 text-lime-400" aria-hidden="true" />
        Stock Ledger
      </h3>
      <div className={fill ? 'min-h-0 flex-1 overflow-auto' : 'max-h-56 overflow-auto'}>
        <table className="w-full min-w-[460px] text-left text-xs text-zinc-200">
          <thead className="sticky top-0 z-10 bg-[#171c1a] text-[10px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="p-1.5">Date &amp; time</th>
              <th className="p-1.5">Action</th>
              <th className="p-1.5">Item</th>
              <th className="p-1.5">Qty</th>
              <th className="p-1.5">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {entries.length === 0 ? (
              <tr><td colSpan={5} className="py-4 text-center text-zinc-400">No stock movements yet.</td></tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap p-1.5">{fmtDate(e.at)}</td>
                  <td className={`p-1.5 font-bold ${ACTION_CLS[e.action]}`}>{e.action}</td>
                  <td className="p-1.5 font-bold text-white">{e.item}</td>
                  <td className="p-1.5">{e.qtyLabel}</td>
                  <td className="p-1.5">{e.by}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
