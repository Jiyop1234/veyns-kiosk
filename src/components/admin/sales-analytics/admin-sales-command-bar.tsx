// @ts-nocheck
// Step B9: the filter bar of Sales Analytics. Everything you change here recalculates every section on the page.
import React from 'react';
import { RefreshCw, Download } from 'lucide-react';

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400';
const PRESETS = [{ id: 'today', label: 'Today' }, { id: '7d', label: '7D' }, { id: '30d', label: '30D' }, { id: '90d', label: '90D' }, { id: 'all', label: 'All' }, { id: 'custom', label: 'Custom' }];
const STATUS_OPTIONS = [{ id: 'all', label: 'All statuses' }, { id: 'completed', label: 'Completed' }, { id: 'pending', label: 'Pending' }, { id: 'rescheduled', label: 'Rescheduled' }, { id: 'cancelled', label: 'Cancelled' }];

export function AdminSalesCommandBar({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, compare, setCompare, canCompare, fulfillment, setFulfillment, fulfillmentOptions, status, setStatus, onExport, onRefresh, refreshing, exportCount }: any) {
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${FOCUS} ${on ? 'bg-lime-400 text-black' : 'bg-white/[0.06] text-emerald-100/80 hover:bg-white/[0.12]'}`;
  const field = `rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 [color-scheme:dark]`;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Date range" className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => <button key={p.id} role="tab" aria-selected={preset === p.id} type="button" onClick={() => setPreset(p.id)} className={chip(preset === p.id)}>{p.label}</button>)}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-100/70">
            <input type="date" aria-label="From date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className={field} />
            to
            <input type="date" aria-label="To date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className={field} />
          </div>
        )}
        <label className={`flex items-center gap-2 text-[11px] font-bold ${canCompare ? 'cursor-pointer text-emerald-100/80' : 'cursor-not-allowed text-emerald-100/35'}`} title={canCompare ? '' : 'All time has no previous period'}>
          <input type="checkbox" checked={compare && canCompare} disabled={!canCompare} onChange={(e) => setCompare(e.target.checked)} className="size-4 accent-lime-400" />
          Compare to previous period
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onRefresh} aria-label="Refresh data" title="Refresh data" className={`flex size-9 items-center justify-center rounded-xl bg-white/[0.06] text-emerald-100 transition-colors hover:bg-white/[0.12] hover:text-lime-400 cursor-pointer ${FOCUS}`}><RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} /></button>
          <button type="button" onClick={onExport} disabled={exportCount === 0} className={`flex items-center gap-1.5 rounded-xl bg-lime-400 px-3.5 py-2 text-xs font-extrabold text-black transition-colors hover:bg-lime-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${FOCUS}`}><Download className="size-4" /> Export CSV</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Fulfillment" className="flex flex-wrap gap-1.5">
          {fulfillmentOptions.map((f) => <button key={f.id} role="tab" aria-selected={fulfillment === f.id} type="button" onClick={() => setFulfillment(f.id)} className={chip(fulfillment === f.id)}>{f.label}</button>)}
        </div>
        <select aria-label="Order status" value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
          {STATUS_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}
