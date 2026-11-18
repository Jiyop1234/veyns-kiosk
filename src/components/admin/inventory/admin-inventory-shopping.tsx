// VEYNS Admin, Inventory: the Auto Shopping List (Step B12): every ingredient at or under par, with a suggested quantity that brings it back to twice its par.
import type { RefObject } from 'react';
import { Download, ShoppingCart } from 'lucide-react';
import { formatQty, peso } from './admin-inventory-calc';
import type { ShoppingItem } from './admin-inventory-types';

type Props = {
  items: ShoppingItem[];
  unchecked: Set<string>;
  onToggle: (id: string) => void;
  onRestock: () => void;
  onExport: () => void;
  flash: boolean;
  sectionRef: RefObject<HTMLElement>;
  fill: boolean;
};

export function AdminInventoryShopping({ items, unchecked, onToggle, onRestock, onExport, flash, sectionRef, fill }: Props) {
  const chosen = items.filter((it) => !unchecked.has(it.ingredient.id));
  const total = chosen.reduce((s, it) => s + it.cost, 0);
  return (
    <section ref={sectionRef} className={`rounded-2xl bg-white/[0.04] p-4 ${fill ? 'flex h-full min-h-0 flex-col' : ''} ${flash ? 'ring-2 ring-lime-400' : ''}`}>
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          <ShoppingCart className="h-5 w-5 text-lime-400" aria-hidden="true" />
          Auto Shopping List
        </h3>
        <span className="text-[11px] text-zinc-400">{items.length} item{items.length === 1 ? '' : 's'} suggested</span>
      </div>
      <div className={fill ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-48 overflow-y-auto'}>
        {items.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-400">Nothing to buy: every ingredient is above its par level.</p>
        ) : (
          items.map((it) => (
            <label key={it.ingredient.id} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-zinc-200">
              <input type="checkbox" checked={!unchecked.has(it.ingredient.id)} onChange={() => onToggle(it.ingredient.id)} className="h-3.5 w-3.5 accent-lime-400" />
              <span className="min-w-0 flex-1 truncate font-bold text-white">{it.ingredient.name}</span>
              <span className="w-20 text-right">+{formatQty(it.qty, it.ingredient.unit)}</span>
              <span className="w-16 text-right text-zinc-300">{peso(it.cost)}</span>
            </label>
          ))
        )}
      </div>
      <div className="mt-2 flex shrink-0 items-center gap-2">
        <button type="button" disabled={chosen.length === 0} onClick={onRestock} className="flex-1 rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-extrabold text-black hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:opacity-35">
          Restock checked ({peso(total)})
        </button>
        <button type="button" disabled={chosen.length === 0} onClick={onExport} className="flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:opacity-35">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export CSV
        </button>
      </div>
    </section>
  );
}
