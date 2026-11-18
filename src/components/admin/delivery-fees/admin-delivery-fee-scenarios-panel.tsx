// @ts-nocheck
// Test Scenarios panel of the Delivery Fee screen: the live rule, and the scenarios you saved in this browser.
// Step B11a: new file. Choosing one loads its draft rule, pin and order amount into the screen.
import { Bookmark, Trash2 } from 'lucide-react';

export function AdminDeliveryFeeScenariosPanel({ scenarios, activeId, onApply, onDelete, message }: any) {
  const items = [{ id: 'live', name: 'Current VEYNS (live rule)' }, ...scenarios];
  return (
    <div className="shrink-0 rounded-3xl bg-white/[0.04] p-4">
      <h2 className="mb-2 flex items-center gap-2 font-display text-base font-extrabold text-white"><Bookmark className="size-5 text-lime-400" /> Test scenarios</h2>
      <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
        {items.map((s: any) => {
          const active = activeId === s.id;
          return (
            <div key={s.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${active ? 'bg-lime-400/10' : 'bg-white/[0.04] hover:bg-white/[0.06]'}`}>
              <button type="button" onClick={() => onApply(s.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left" aria-pressed={active}>
                <span className={`size-3.5 shrink-0 rounded-full ${active ? 'bg-lime-400 ring-2 ring-lime-400/30' : 'bg-white/20'}`} />
                <span className={`truncate text-sm font-semibold ${active ? 'text-lime-300' : 'text-white'}`}>{s.name}</span>
              </button>
              {s.id !== 'live' && (
                <button type="button" aria-label={`Delete ${s.name}`} onClick={() => onDelete(s.id)} className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-white/40 hover:text-red-300"><Trash2 className="size-4" /></button>
              )}
            </div>
          );
        })}
      </div>
      {message ? <p className="mt-1.5 text-[11px] font-semibold text-amber-300">{message}</p> : null}
      <p className="mt-1.5 text-[10px] text-white/40">Saved in this browser only.</p>
    </div>
  );
}
