// VEYNS Admin, Inventory: the Recipe Editor of the selected dish (Step B12): quantity per bowl, line cost, bowls each ingredient allows, food cost and margin.
// The parent gives this component a key that changes when the saved recipe changes, so the draft below always starts from the saved recipe.
import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { bowlsFromLine, byIdMap, peso } from './admin-inventory-calc';
import type { Dish, Ingredient, RecipeLine } from './admin-inventory-types';

type Props = {
  dish: Dish;
  ingredients: Ingredient[];
  fill: boolean;
  onSave: (dishId: string, recipe: RecipeLine[]) => void;
};

export function AdminInventoryRecipe({ dish, ingredients, fill, onSave }: Props) {
  const byId = byIdMap(ingredients);
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(dish.recipe.map((r) => [r.ingredientId, String(r.qty)])));

  const qtyOf = (line: RecipeLine): number => {
    const n = Number(draft[line.ingredientId]);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  };
  const valid = dish.recipe.every((l) => !Number.isNaN(qtyOf(l)));
  const changed = dish.recipe.some((l) => qtyOf(l) !== l.qty);
  const lines = dish.recipe.map((l) => ({ ...l, qty: Number.isNaN(qtyOf(l)) ? l.qty : qtyOf(l) }));

  const capacities = lines.map((l) => {
    const ing = byId.get(l.ingredientId);
    return ing ? bowlsFromLine(ing.stock, l.qty) : 0;
  });
  const minCap = capacities.length ? Math.min(...capacities) : 0;
  const maxCap = Math.max(1, ...capacities);
  const cost = lines.reduce((s, l) => s + l.qty * (byId.get(l.ingredientId)?.unitCost ?? 0), 0);
  const margin = dish.price - cost;
  const pct = dish.price > 0 ? (cost / dish.price) * 100 : 0;

  const reset = () => setDraft(Object.fromEntries(dish.recipe.map((r) => [r.ingredientId, String(r.qty)])));

  return (
    <section className={`rounded-2xl bg-white/[0.04] p-4 ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <h3 className="mb-3 flex shrink-0 items-center gap-2 text-base font-semibold text-white">
        <UtensilsCrossed className="h-5 w-5 text-lime-400" aria-hidden="true" />
        Recipe Editor – {dish.name}
      </h3>
      <div className={`flex gap-3 ${fill ? 'min-h-0 flex-1' : ''}`}>
        <div className={`min-w-0 flex-1 ${fill ? 'overflow-auto' : 'overflow-x-auto'}`}>
          <table className="w-full min-w-[430px] text-left text-xs text-zinc-200">
            <thead className="sticky top-0 z-10 bg-[#171c1a] text-[10px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="p-2">Ingredient</th>
                <th className="p-2">Qty / bowl</th>
                <th className="p-2 text-right">Unit cost</th>
                <th className="p-2 text-right">Line cost</th>
                <th className="p-2">Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {lines.map((l, idx) => {
                const ing = byId.get(l.ingredientId);
                if (!ing) return null;
                const limiting = capacities[idx] === minCap;
                return (
                  <tr key={l.ingredientId} className={limiting ? 'bg-red-400/10' : ''}>
                    <td className="p-2 font-bold text-white">{ing.name}</td>
                    <td className="p-2">
                      <span className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={draft[l.ingredientId] ?? ''}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [l.ingredientId]: e.target.value }))}
                          aria-label={`${ing.name} per bowl`}
                          className="h-7 w-16 rounded-md bg-white/[0.08] px-1.5 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
                        />
                        <span className="text-zinc-400">{ing.unit}</span>
                      </span>
                    </td>
                    <td className="p-2 text-right">{peso(ing.unitCost)}/{ing.unit}</td>
                    <td className="p-2 text-right">{peso(l.qty * ing.unitCost)}</td>
                    <td className="p-2">
                      <span className="block text-[11px] font-bold text-white">{capacities[idx]} bowls</span>
                      <span className="block h-1 w-16 overflow-hidden rounded-full bg-white/[0.08]">
                        <span className={`block h-full rounded-full ${limiting ? 'bg-red-400' : 'bg-lime-400'}`} style={{ width: `${(capacities[idx] / maxCap) * 100}%` }} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <aside className="hidden w-44 shrink-0 flex-col items-center justify-center rounded-xl bg-white/[0.04] p-3 text-center 2xl:flex">
          <span className="mb-2 rounded-md bg-lime-400 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-black">LIVE PREVIEW</span>
          <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15 text-amber-300"><UtensilsCrossed className="h-7 w-7" aria-hidden="true" /></span>
          <p className="text-sm font-extrabold text-white">{dish.name}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">{dish.description}</p>
          <p className="mt-2 font-display text-xl font-extrabold text-lime-300">{peso(dish.price)}</p>
        </aside>
      </div>
      <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-zinc-300">
          Food cost: <strong className="text-white">{peso(cost)}</strong> · Margin: <strong className="text-white">{peso(margin)}</strong> · Food-cost: <strong className="text-lime-300">{pct.toFixed(1)}%</strong>
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={!changed} onClick={reset} className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:opacity-35">Cancel</button>
          <button type="button" disabled={!changed || !valid} onClick={() => onSave(dish.id, lines)} className="rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-extrabold text-black hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:opacity-35">Save Recipe</button>
        </div>
      </div>
    </section>
  );
}
