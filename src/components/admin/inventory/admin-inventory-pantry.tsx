// VEYNS Admin, Inventory: Ingredient Stock (Step B12b), laid out like the owner's Excel sheet:
// ingredient, category, price of a pack, what was bought (packs and total amount), and what is on the shelf now.
// Row buttons: + add what you actually added (any amount), - waste, pencil edit the purchase details.
import { useState } from 'react';
import { Leaf, Minus, Pencil, Plus, Search } from 'lucide-react';
import { formatQty, peso, stockStatus } from './admin-inventory-calc';
import { SECTIONS } from './admin-inventory-types';
import type { Ingredient, Section, StockStatus } from './admin-inventory-types';

const STATUS_CLS: Record<StockStatus, string> = {
  OK: 'bg-lime-400/15 text-lime-300',
  LOW: 'bg-amber-400/15 text-amber-300',
  CRITICAL: 'bg-red-400/20 text-red-300',
  OUT: 'bg-red-500/30 text-red-200',
};

type Props = {
  ingredients: Ingredient[];
  fill: boolean;
  onAdd: (id: string) => void;
  onWaste: (id: string) => void;
  onEdit: (id: string) => void;
  onNew: () => void;
};

const iconBtn = 'flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.08] text-zinc-200 hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400';

export function AdminInventoryPantry({ ingredients, fill, onAdd, onWaste, onEdit, onNew }: Props) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<'All' | Section>('All');

  const q = search.trim().toLowerCase();
  const rows = ingredients.filter((i) => (cat === 'All' || i.category === cat) && (!q || i.name.toLowerCase().includes(q)));
  const chip = (active: boolean) => `rounded-lg px-2.5 py-1 text-[11px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${active ? 'bg-lime-400 text-black' : 'bg-white/[0.08] text-zinc-200 hover:bg-white/[0.14]'}`;

  return (
    <section className={`rounded-2xl bg-white/[0.04] p-4 ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          <Leaf className="h-5 w-5 text-lime-400" aria-hidden="true" />
          Ingredient Stock
        </h3>
        <div className="relative ml-auto w-40">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ingredient..."
            aria-label="Search ingredient"
            className="h-8 w-full rounded-lg bg-white/[0.06] pl-8 pr-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
          />
        </div>
        <button type="button" onClick={onNew} className="flex h-8 items-center gap-1 rounded-lg bg-lime-400 px-3 text-xs font-extrabold text-black hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New ingredient
        </button>
      </div>
      <div className="mb-2 flex shrink-0 flex-wrap gap-1.5">
        <button type="button" onClick={() => setCat('All')} className={chip(cat === 'All')}>All</button>
        {SECTIONS.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={chip(cat === c)}>{c}</button>
        ))}
      </div>
      <div className={fill ? 'min-h-0 flex-1 overflow-auto' : 'max-h-[28rem] overflow-auto'}>
        <table className="w-full min-w-[500px] text-left text-xs text-zinc-200">
          <thead className="sticky top-0 z-10 bg-[#171c1a] text-[10px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="p-2">Ingredient</th>
              <th className="p-2 text-right">Price</th>
              <th className="p-2">Bought</th>
              <th className="p-2">Stock now</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-zinc-400">No ingredient matches.</td></tr>
            ) : (
              rows.map((i) => {
                const st = stockStatus(i);
                return (
                  <tr key={i.id}>
                    <td className="p-2">
                      <span className="block font-bold text-white">{i.name}</span>
                      <span className="block text-[10px] uppercase tracking-wider text-zinc-500">{i.category}</span>
                    </td>
                    <td className="p-2 text-right">{peso(i.price)}</td>
                    <td className="p-2 text-zinc-300">{i.packs} · {formatQty(i.amount, i.unit)}</td>
                    <td className="p-2">
                      <span className="block font-bold text-white">{formatQty(i.stock, i.unit)}</span>
                      <span className="block text-[10px] text-zinc-500">par {formatQty(i.par, i.unit)}</span>
                    </td>
                    <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${STATUS_CLS[st]}`}>{st}</span></td>
                    <td className="p-2">
                      <span className="flex justify-end gap-1">
                        <button type="button" aria-label={`Add stock to ${i.name}`} title="Add stock (any amount)" onClick={() => onAdd(i.id)} className={iconBtn}><Plus className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label={`Record waste for ${i.name}`} title="Record waste" onClick={() => onWaste(i.id)} className={iconBtn}><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label={`Edit ${i.name}`} title="Edit details" onClick={() => onEdit(i.id)} className={iconBtn}><Pencil className="h-3.5 w-3.5" /></button>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 shrink-0 text-[11px] text-zinc-500">{rows.length} of {ingredients.length} ingredients</p>
    </section>
  );
}
