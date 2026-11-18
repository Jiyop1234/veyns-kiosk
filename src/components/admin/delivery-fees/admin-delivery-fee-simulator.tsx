// @ts-nocheck
// Simulator controls of the Delivery Fee screen: set the distance and the order amount, randomize the pin,
// ask the database for the live fee of the same pin (admin_preview_delivery_fee, read only), and save the draft as a test scenario.
// Step B11a: new file. Saving a scenario only writes to this browser.
import { useState } from 'react';
import { Gauge, Minus, Plus, Shuffle, Database, Bookmark, Loader2 } from 'lucide-react';
import { FeeNumberBox } from '@/components/admin/delivery-fees/admin-delivery-fee-controls';

const BTN = 'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

export function AdminDeliveryFeeSimulator({ rawKm, subtotal, onDistance, onSubtotal, onRandomize, dbCheck, onCheck, onSaveScenario }: any) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');

  const submitName = () => {
    const error = onSaveScenario(name);
    if (error) { setNameError(error); return; }
    setNaming(false);
    setName('');
    setNameError('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-3xl bg-white/[0.04] p-4">
      <h2 className="mb-3 flex shrink-0 items-center gap-2 font-display text-base font-extrabold text-white"><Gauge className="size-5 text-lime-400" /> Simulator controls</h2>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">Distance</span>
            <FeeNumberBox value={Number(rawKm.toFixed(2))} onChange={onDistance} min={0} max={15} step={0.1} suffix="km" label="Distance" />
          </div>
          <input type="range" aria-label="Distance slider" min={0} max={15} step={0.1} value={Math.min(15, rawKm)} onChange={(e) => onDistance(parseFloat(e.target.value))} className="mt-1 h-1.5 w-full cursor-pointer accent-lime-400" />
          <p className="text-[10px] text-white/40">You can also click the map or drag the pin.</p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white">Order subtotal</span>
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="₱50 less" onClick={() => onSubtotal(Math.max(0, subtotal - 50))} className="grid size-9 cursor-pointer place-items-center rounded-xl bg-white/[0.06] text-white/70 hover:text-lime-400"><Minus className="size-4" /></button>
            <FeeNumberBox value={subtotal} onChange={(v: number) => onSubtotal(Math.max(0, v))} min={0} max={5000} step={10} prefix="₱" label="Order subtotal" width="w-24" />
            <button type="button" aria-label="₱50 more" onClick={() => onSubtotal(subtotal + 50)} className="grid size-9 cursor-pointer place-items-center rounded-xl bg-white/[0.06] text-white/70 hover:text-lime-400"><Plus className="size-4" /></button>
          </div>
        </div>

        <button type="button" onClick={onRandomize} className={BTN}><Shuffle className="size-4" /> Randomize pin</button>

        <div>
          <button type="button" disabled={dbCheck.status === 'loading'} onClick={onCheck} className={BTN}>
            {dbCheck.status === 'loading' ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />} Check live fee with the database
          </button>
          {dbCheck.status === 'ok' && <p className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${dbCheck.match ? 'bg-lime-400/15 text-lime-300' : 'bg-red-500/15 text-red-300'}`}>{dbCheck.text}</p>}
          {dbCheck.status === 'error' && <p className="mt-1.5 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-red-300">{dbCheck.text}</p>}
        </div>

        {!naming ? (
          <button type="button" onClick={() => setNaming(true)} className={BTN}><Bookmark className="size-4" /> Save as test scenario</button>
        ) : (
          <div className="space-y-1.5 rounded-xl bg-white/[0.06] p-2.5">
            <input
              autoFocus
              value={name}
              maxLength={40}
              placeholder="Scenario name"
              aria-label="Scenario name"
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitName(); if (e.key === 'Escape') { setNaming(false); setName(''); setNameError(''); } }}
              className="w-full rounded-lg bg-black/30 px-3 py-2 text-xs font-semibold text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-lime-400/70"
            />
            {nameError ? <p className="text-[11px] font-semibold text-red-300">{nameError}</p> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setNaming(false); setName(''); setNameError(''); }} className="flex-1 cursor-pointer rounded-lg bg-white/[0.06] py-1.5 text-xs font-bold text-white hover:bg-white/10">Cancel</button>
              <button type="button" onClick={submitName} className="flex-1 cursor-pointer rounded-lg bg-lime-400 py-1.5 text-xs font-extrabold text-black hover:bg-lime-300">Save</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
