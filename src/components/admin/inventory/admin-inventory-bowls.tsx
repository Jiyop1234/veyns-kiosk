// VEYNS Admin, Inventory: "Bowls Left Right Now" (Step B12). One card per dish: how many bowls the stock allows and which ingredient limits it.
import { ChefHat, Flame, UtensilsCrossed, Zap } from 'lucide-react';
import { bowlsFor, byIdMap, formatQty, peso } from './admin-inventory-calc';
import type { Dish, Ingredient } from './admin-inventory-types';

type Props = {
  dishes: Dish[];
  ingredients: Ingredient[];
  selectedId: string;
  onSelect: (id: string) => void;
  rush: boolean;
  onToggleRush: () => void;
  onCook: (id: string, count: number) => void;
};

export function AdminInventoryBowls({ dishes, ingredients, selectedId, onSelect, rush, onToggleRush, onCook }: Props) {
  const byId = byIdMap(ingredients);
  const count = rush ? 5 : 1;
  return (
    <section className="shrink-0 rounded-2xl bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          <ChefHat className="h-5 w-5 text-lime-400" aria-hidden="true" />
          Bowls Left Right Now
        </h3>
        <button
          type="button"
          aria-pressed={rush}
          onClick={onToggleRush}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${rush ? 'bg-lime-400 text-black' : 'bg-white/[0.08] text-lime-300 hover:bg-white/[0.14]'}`}
        >
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          Service Rush ×5
        </button>
      </div>
      <div className="grid auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1">
        {dishes.map((d) => {
          const { bowls, limitId } = bowlsFor(d, byId);
          const limit = limitId ? byId.get(limitId) : undefined;
          const tone = bowls <= 3 ? { text: 'text-red-400', bar: 'bg-red-400' } : bowls <= 8 ? { text: 'text-amber-300', bar: 'bg-amber-300' } : { text: 'text-lime-400', bar: 'bg-lime-400' };
          const tile = d.category === 'Rice Bowls' ? 'bg-amber-400/15 text-amber-300' : 'bg-rose-400/15 text-rose-300';
          return (
            <div key={d.id} className={`flex gap-3 rounded-xl bg-white/[0.04] p-3 ${d.id === selectedId ? 'ring-2 ring-lime-400' : ''}`}>
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${tile}`}>
                <UtensilsCrossed className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <button type="button" aria-pressed={d.id === selectedId} onClick={() => onSelect(d.id)} className="truncate text-left text-sm font-extrabold text-white hover:text-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
                    {d.name}
                  </button>
                  <span className="shrink-0 rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-zinc-300">{d.category}</span>
                </div>
                <p className="flex items-baseline gap-1.5">
                  <span className={`font-display text-3xl font-extrabold leading-none ${tone.text}`}>{bowls}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Bowls left</span>
                </p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, (bowls / 30) * 100)}%` }} />
                </div>
                <p className="mt-1 truncate text-[11px] text-zinc-400">{limit ? `Limited by: ${limit.name} (${formatQty(limit.stock, limit.unit)} left)` : 'No recipe yet'}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">{peso(d.price)} / bowl</span>
                  <button
                    type="button"
                    disabled={bowls < count}
                    onClick={() => onCook(d.id, count)}
                    className="flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1 text-xs font-extrabold text-black hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                    Cook {count}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
