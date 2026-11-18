// VEYNS Admin, Inventory: the Pantry table (Step B12): search, category chips, sort, 5 rows per page, and the add / waste / edit buttons.
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Leaf, Minus, Pencil, Plus, Search } from 'lucide-react';
import { formatQty, peso, stockStatus } from './admin-inventory-calc';
import { INGREDIENT_CATEGORIES } from './admin-inventory-types';
import type { Ingredient, IngredientCategory, StockStatus } from './admin-inventory-types';

const PAGE_SIZE = 5;

const CATEGORY_CLS: Record<IngredientCategory, string> = {
  Protein: 'bg-red-400/15 text-red-300',
  Produce: 'bg-emerald-400/15 text-emerald-300',
  Sauce: 'bg-orange-400/15 text-orange-300',
  Dairy: 'bg-violet-400/15 text-violet-300',
  Grain: 'bg-amber-400/15 text-amber-300',
  Packaging: 'bg-slate-400/15 text-slate-300',
};

const STATUS_CLS: Record<StockStatus, string> = {
  OK: 'bg-lime-400/15 text-lime-300',
  LOW: 'bg-amber-400/15 text-amber-300',
  CRITICAL: 'bg-red-400/20 text-red-300',
  OUT: 'bg-red-500/30 text-red-200',
};

type SortKey = 'list' | 'pct' | 'value';

type Props = {
  ingredients: Ingredient[];
  fill: boolean;
  onAdd: (id: string) => void;
  onWaste: (id: string) => void;
  onEdit: (id: string) => void;
};

const iconBtn = 'flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.08] text-zinc-200 hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400';

export function AdminInventoryPantry({ ingredients, fill, onAdd, onWaste, onEdit }: Props) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<'All' | IngredientCategory>('All');
  const [sort, setSort] = useState<SortKey>('list');
  const [page, setPage] = useState(1);

  const q = search.trim().toLowerCase();
  const filtered = ingredients.filter((i) => (cat === 'All' || i.category === cat) && (!q || i.name.toLowerCase().includes(q)));
  const sorted = [...filtered];
  if (sort === 'pct') sorted.sort((a, b) => a.stock / (a.par || 1) - b.stock / (b.par || 1));
  if (sort === 'value') sorted.sort((a, b) => b.stock * b.unitCost - a.stock * a.unitCost);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount);
  const rows = sorted.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const first = sorted.length === 0 ? 0 : (cur - 1) * PAGE_SIZE + 1;
  const last = (cur - 1) * PAGE_SIZE + rows.length;

  const chip = (active: boolean) => `rounded-lg px-2.5 py-1 text-[11px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${active ? 'bg-lime-400 text-black' : 'bg-white/[0.08] text-zinc-200 hover:bg-white/[0.14]'}`;

  return (
    <section className={`rounded-2xl bg-white/[0.04] p-4 ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          <Leaf className="h-5 w-5 text-lime-400" aria-hidden="true" />
          Pantry (Ingredient Stock)
        </h3>
        <div className="relative ml-auto w-44">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search ingredient..."
            aria-label="Search ingredient"
            className="h-8 w-full rounded-lg bg-white/[0.06] pl-8 pr-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
          />
        </div>
        <select
          aria-label="Sort ingredients"
          value={sort}
          onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
          className="h-8 rounded-lg bg-white/[0.06] px-2 text-xs font-bold text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 [color-scheme:dark]"
        >
          <option value="list" className="bg-[#141817]">List order</option>
          <option value="pct" className="bg-[#141817]">Stock % (low first)</option>
          <option value="value" className="bg-[#141817]">Value (high first)</option>
        </select>
      </div>
      <div className="mb-2 flex shrink-0 flex-wrap gap-1.5">
        <button type="button" onClick={() => { setCat('All'); setPage(1); }} className={chip(cat === 'All')}>All</button>
        {INGREDIENT_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => { setCat(c); setPage(1); }} className={chip(cat === c)}>{c}</button>
        ))}
      </div>
      <div className={fill ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto'}>
        <table className="w-full min-w-[620px] text-left text-xs text-zinc-200">
          <thead className="sticky top-0 z-10 bg-[#171c1a] text-[10px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="p-2">Ingredient</th>
              <th className="p-2">Category</th>
              <th className="p-2">Stock</th>
              <th className="p-2">Par level</th>
              <th className="p-2">Value</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="py-6 text-center text-zinc-400">No ingredient matches.</td></tr>
            ) : (
              rows.map((i) => {
                const st = stockStatus(i);
                return (
                  <tr key={i.id}>
                    <td className="p-2 font-bold text-white">
                      <span className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${CATEGORY_CLS[i.category]}`}>{i.name.charAt(0)}</span>
                        {i.name}
                      </span>
                    </td>
                    <td className="p-2"><span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${CATEGORY_CLS[i.category]}`}>{i.category}</span></td>
                    <td className="p-2 font-bold text-white">{formatQty(i.stock, i.unit)}</td>
                    <td className="p-2">{formatQty(i.par, i.unit)}</td>
                    <td className="p-2">{peso(i.stock * i.unitCost)}</td>
                    <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${STATUS_CLS[st]}`}>{st}</span></td>
                    <td className="p-2">
                      <span className="flex justify-end gap-1">
                        <button type="button" aria-label={`Add stock to ${i.name}`} title="Add stock" onClick={() => onAdd(i.id)} className={iconBtn}><Plus className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label={`Record waste for ${i.name}`} title="Record waste" onClick={() => onWaste(i.id)} className={iconBtn}><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label={`Edit ${i.name}`} title="Edit par level and unit cost" onClick={() => onEdit(i.id)} className={iconBtn}><Pencil className="h-3.5 w-3.5" /></button>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex shrink-0 items-center justify-between gap-3 text-[11px] text-zinc-300">
        <span>Showing {first}–{last} of {sorted.length} ingredients</span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous page" className={`${iconBtn} disabled:opacity-30`}><ChevronLeft className="h-4 w-4" /></button>
          {Array.from({ length: pageCount }, (_, n) => n + 1).map((n) => (
            <button key={n} type="button" onClick={() => setPage(n)} className={`h-6 min-w-6 rounded-md px-1.5 text-[11px] font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${n === cur ? 'bg-lime-400 text-black' : 'bg-white/[0.08] text-zinc-200 hover:bg-white/[0.16]'}`}>{n}</button>
          ))}
          <button type="button" disabled={cur >= pageCount} onClick={() => setPage(cur + 1)} aria-label="Next page" className={`${iconBtn} disabled:opacity-30`}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  );
}
