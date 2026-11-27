// VEYNS Admin, Inventory: the Recipe costing sheet (Steps B12b, 6C-3), laid out like the owner's Excel sheet for Pork Sugba.
// Lines are grouped Marinade / Garnish / Sauce / Packaging / Utilities. For each line: price, what was bought, how much is used,
// and "for (bowls)": the amount used is enough for that many bowls (1 = per bowl, 20 = per batch, 50 = the sauce batch).
// Cost per bowl of a line = overall cost x used / unit bought / bowls served. Bowls yielded and selling price are edited at the bottom.
// The outer component picks the recipe and cooks; the sheet below it is keyed so its draft always starts from the saved recipe.
import { Fragment, useState } from 'react';
import { Flame, Plus, UtensilsCrossed, X } from 'lucide-react';
import type { InventoryWriteResult } from '@/lib/admin-inventory-api';
import { bowlsFor, byIdMap, costPerBowl, formatQty, lineCost, overallCost, peso2, sectionTotals } from './admin-inventory-calc';
import { SECTIONS } from './admin-inventory-types';
import type { Dish, Ingredient, RecipeLine, RecipePatch, Section } from './admin-inventory-types';

const num = (s: string): number => (s.trim() === '' ? NaN : Number(s));
const input = 'h-7 rounded-md bg-white/[0.08] px-1.5 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400';

type DraftLine = { ingredientId: string; section: Section; used: string; serves: string };

function RecipeSheet({ dish, ingredients, limitId, fill, onSave }: { dish: Dish; ingredients: Ingredient[]; limitId: string | null; fill: boolean; onSave: (dishId: string, patch: RecipePatch) => Promise<InventoryWriteResult> }) {
  const byId = byIdMap(ingredients);
  const fromSaved = (): DraftLine[] => dish.lines.map((l) => ({ ingredientId: l.ingredientId, section: l.section, used: String(l.used), serves: String(l.serves) }));
  const [lines, setLines] = useState<DraftLine[]>(fromSaved);
  const [bowls, setBowls] = useState(String(dish.bowls));
  const [price, setPrice] = useState(String(dish.price));
  const [adding, setAdding] = useState<Section | null>(null);
  const [addName, setAddName] = useState('');
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const nums: RecipeLine[] = lines.map((l) => ({ ingredientId: l.ingredientId, section: l.section, used: num(l.used), serves: num(l.serves) }));
  const bowlsN = num(bowls);
  const priceN = num(price);
  const valid = nums.every((l) => l.used > 0 && l.serves > 0) && bowlsN > 0 && priceN >= 0;
  const sig = (ls: RecipeLine[], b: number, p: number): string => JSON.stringify([ls.map((l) => [l.ingredientId, l.section, l.used, l.serves]), b, p]);
  const changed = sig(nums, bowlsN, priceN) !== sig(dish.lines, dish.bowls, dish.price);

  // Costs use the draft numbers; a field that is empty or invalid counts as 0.
  const costLines: RecipeLine[] = nums.map((l) => ({ ...l, used: Number.isFinite(l.used) ? l.used : 0, serves: Number.isFinite(l.serves) ? l.serves : 0 }));
  const totals = sectionTotals(costLines, byId);
  const cost = costPerBowl(costLines, byId);
  const sell = Number.isFinite(priceN) ? priceN : 0;
  const profit = sell - cost;
  const pct = sell > 0 ? (cost / sell) * 100 : 0;
  const batchCost = Number.isFinite(bowlsN) ? cost * bowlsN : 0;

  const setLine = (idx: number, patch: Partial<DraftLine>) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));
  const reset = () => {
    setLines(fromSaved());
    setBowls(String(dish.bowls));
    setPrice(String(dish.price));
    setAdding(null);
    setAddError('');
    setSaveError('');
  };
  const addLine = () => {
    const sec = adding;
    if (sec === null) return;
    const target = ingredients.find((i) => i.name.trim().toLowerCase() === addName.trim().toLowerCase());
    if (!target) { setAddError('Pick an ingredient from the list (add new ones in Ingredient Stock).'); return; }
    if (lines.some((l) => l.section === sec && l.ingredientId === target.id)) { setAddError('This ingredient is already in this section.'); return; }
    setLines((prev) => [...prev, { ingredientId: target.id, section: sec, used: '1', serves: '1' }]);
    setAddName('');
    setAddError('');
    setAdding(null);
  };
  // The sheet is rebuilt from the database after a good save (it is keyed by the saved recipe); a refusal shows its message here.
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    const r = await onSave(dish.id, { lines: nums, bowls: bowlsN, price: priceN });
    setSaving(false);
    if (!r.ok) setSaveError(r.error);
  };

  return (
    <>
      <div className={fill ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto'}>
        <table className="w-full min-w-[720px] text-left text-xs text-zinc-200">
          <thead className="sticky top-0 z-10 bg-[#171c1a] text-[10px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="p-2">Description</th>
              <th className="p-2 text-right">Price</th>
              <th className="p-2">Bought</th>
              <th className="p-2">Used</th>
              <th className="p-2" title="The amount used is enough for this many bowls: 1 = per bowl, 20 = per batch of 20 bowls">For (bowls)</th>
              <th className="p-2 text-right">Overall cost</th>
              <th className="p-2 text-right">Per bowl</th>
              <th className="p-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((sec) => (
              <Fragment key={sec}>
                <tr className="bg-white/[0.06]">
                  <td colSpan={6} className="p-2 text-[10px] font-extrabold uppercase tracking-wider text-lime-300">{sec}</td>
                  <td className="p-2 text-right font-extrabold text-lime-300">{peso2(totals[sec])}</td>
                  <td className="p-2 text-right">
                    <button type="button" aria-label={`Add an ingredient to ${sec}`} title={`Add an ingredient to ${sec}`} onClick={() => { setAdding(adding === sec ? null : sec); setAddName(''); setAddError(''); }} className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.08] text-zinc-200 hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
                {adding === sec && (
                  <tr className="bg-white/[0.03]">
                    <td colSpan={8} className="p-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <input type="text" list="inventory-ingredient-names" value={addName} onChange={(e) => { setAddName(e.target.value); setAddError(''); }} placeholder="Type an ingredient from your stock..." aria-label={`Ingredient to add to ${sec}`} autoFocus className={`${input} w-64`} />
                        <button type="button" onClick={addLine} className="rounded-md bg-lime-400 px-3 py-1 text-[11px] font-extrabold text-black hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">Add</button>
                        <button type="button" onClick={() => setAdding(null)} className="rounded-md bg-white/[0.08] px-3 py-1 text-[11px] font-bold text-zinc-200 hover:bg-white/[0.14]">Cancel</button>
                        {addError && <span className="text-red-300">{addError}</span>}
                      </span>
                    </td>
                  </tr>
                )}
                {lines.map((l, idx) => {
                  if (l.section !== sec) return null;
                  const ing = byId.get(l.ingredientId);
                  const lineNum = costLines[idx];
                  return (
                    <tr key={`${l.section}:${l.ingredientId}`} className={`border-b border-white/[0.05] ${l.ingredientId === limitId ? 'bg-red-400/10' : ''}`}>
                      <td className="p-2 font-bold text-white">{ing ? ing.name : 'Unknown ingredient'}</td>
                      <td className="p-2 text-right text-zinc-400">{ing ? peso2(ing.price) : ''}</td>
                      <td className="p-2 text-zinc-400">{ing ? `${ing.packs} · ${formatQty(ing.amount, ing.unit)}` : ''}</td>
                      <td className="p-2">
                        <span className="flex items-center gap-1">
                          <input type="number" min="0" step="any" value={l.used} onChange={(e) => setLine(idx, { used: e.target.value })} aria-label={`${ing ? ing.name : 'Ingredient'} used`} className={`${input} w-16`} />
                          <span className="text-zinc-500">{ing ? ing.unit : ''}</span>
                        </span>
                      </td>
                      <td className="p-2">
                        <input type="number" min="0" step="any" value={l.serves} onChange={(e) => setLine(idx, { serves: e.target.value })} aria-label={`${ing ? ing.name : 'Ingredient'} serves how many bowls`} className={`${input} w-14`} />
                      </td>
                      <td className="p-2 text-right text-zinc-400">{ing ? peso2(overallCost(ing)) : ''}</td>
                      <td className="p-2 text-right font-bold text-white">{peso2(lineCost(lineNum, ing))}</td>
                      <td className="p-2 text-right">
                        <button type="button" aria-label={`Remove ${ing ? ing.name : 'ingredient'} from ${sec}`} title="Remove this line" onClick={() => removeLine(idx)} className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-white/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
        <datalist id="inventory-ingredient-names">
          {ingredients.map((i) => (
            <option key={i.id} value={i.name} />
          ))}
        </datalist>
      </div>

      <div className="mt-2 grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <label className="rounded-lg bg-amber-400/15 p-2">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-200">Bowls yielded (batch)</span>
          <input type="number" min="0" step="any" value={bowls} onChange={(e) => setBowls(e.target.value)} className={`${input} mt-0.5 w-full`} />
        </label>
        <div className="rounded-lg bg-red-400/15 p-2">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-red-200">Cost per bowl</span>
          <span className="block text-lg font-extrabold leading-8 text-white">{peso2(cost)}</span>
        </div>
        <label className="rounded-lg bg-violet-400/15 p-2">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-violet-200">Selling price</span>
          <input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} className={`${input} mt-0.5 w-full`} />
        </label>
        <div className={`rounded-lg p-2 ${profit >= 0 ? 'bg-emerald-400/15' : 'bg-red-500/25'}`}>
          <span className={`block text-[9px] font-bold uppercase tracking-wider ${profit >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>Profit per bowl</span>
          <span className="block text-lg font-extrabold leading-8 text-white">{peso2(profit)}</span>
        </div>
      </div>
      {saveError && <p className="mt-2 shrink-0 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-300">{saveError}</p>}
      <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-zinc-400">
          Food cost <strong className="text-lime-300">{pct.toFixed(1)}%</strong> · cost of one batch <strong className="text-white">{peso2(batchCost)}</strong>
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={!changed} onClick={reset} className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:opacity-35">Cancel</button>
          <button type="button" disabled={!changed || !valid || saving} onClick={() => void save()} className="rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-extrabold text-black hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:opacity-35">{saving ? 'Saving...' : 'Save Recipe'}</button>
        </div>
      </div>
    </>
  );
}

type Props = {
  dishes: Dish[];
  selectedId: string;
  onSelect: (id: string) => void;
  ingredients: Ingredient[];
  fill: boolean;
  onSave: (dishId: string, patch: RecipePatch) => Promise<InventoryWriteResult>;
  onCook: (dishId: string, count: number) => Promise<InventoryWriteResult>;
  onAddDish: (name: string) => Promise<InventoryWriteResult>;
};

export function AdminInventoryRecipe({ dishes, selectedId, onSelect, ingredients, fill, onSave, onCook, onAddDish }: Props) {
  const byId = byIdMap(ingredients);
  const dish = dishes.find((d) => d.id === selectedId);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const info = dish ? bowlsFor(dish, byId) : { bowls: 0, limitId: null as string | null };
  const limit = info.limitId ? byId.get(info.limitId) : undefined;
  const batch = dish ? Math.max(1, Math.round(dish.bowls)) : 1;

  const addNew = async () => {
    const n = newName.trim();
    if (!n || busy) return;
    setBusy(true);
    setActionError('');
    const r = await onAddDish(n);
    setBusy(false);
    if (!r.ok) { setActionError(r.error); return; }
    if (r.id) onSelect(r.id);
    setNewName('');
    setNewOpen(false);
  };

  const cookNow = async (count: number) => {
    if (!dish || busy) return;
    setBusy(true);
    setActionError('');
    const r = await onCook(dish.id, count);
    setBusy(false);
    if (!r.ok) setActionError(r.error);
  };

  const cookBtn = 'flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-black hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:cursor-not-allowed disabled:opacity-35';

  return (
    <section className={`rounded-2xl bg-white/[0.04] p-4 ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
        <h3 className="mr-1 flex items-center gap-2 text-base font-semibold text-white">
          <UtensilsCrossed className="h-5 w-5 text-lime-400" aria-hidden="true" />
          Recipe costing (by batch)
        </h3>
        {dishes.map((d) => (
          <button key={d.id} type="button" aria-pressed={d.id === selectedId} onClick={() => onSelect(d.id)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${d.id === selectedId ? 'bg-lime-400 text-black' : 'bg-white/[0.08] text-zinc-200 hover:bg-white/[0.14]'}`}>
            {d.name} · {bowlsFor(d, byId).bowls} left
          </button>
        ))}
        <button type="button" onClick={() => setNewOpen((o) => !o)} className="flex items-center gap-1 rounded-lg bg-white/[0.08] px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-white/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
          <Plus className="h-3 w-3" aria-hidden="true" />
          New recipe
        </button>
      </div>
      {newOpen && (
        <div className="mb-2 flex shrink-0 items-center gap-2">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Recipe name, e.g. Pork Sisig" aria-label="New recipe name" autoFocus className={`${input} w-56`} />
          <button type="button" disabled={busy} onClick={() => void addNew()} className="rounded-md bg-lime-400 px-3 py-1 text-[11px] font-extrabold text-black hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:opacity-50">{busy ? 'Saving...' : 'Create'}</button>
        </div>
      )}
      {actionError && <p className="mb-2 shrink-0 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-300">{actionError}</p>}
      {dish ? (
        <>
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
            <p className="text-xs text-zinc-300">
              <strong className={`text-base ${info.bowls <= 3 ? 'text-red-400' : info.bowls <= 8 ? 'text-amber-300' : 'text-lime-400'}`}>{info.bowls}</strong> bowls left
              {limit && <> · limited by <strong className="text-white">{limit.name}</strong> ({formatQty(limit.stock, limit.unit)} left)</>}
              {dish.lines.length === 0 && <> · add ingredients below</>}
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={info.bowls < 1 || busy} onClick={() => void cookNow(1)} className={cookBtn}><Flame className="h-3.5 w-3.5" aria-hidden="true" />Cook 1 bowl</button>
              <button type="button" disabled={info.bowls < batch || busy} onClick={() => void cookNow(batch)} className={cookBtn}><Flame className="h-3.5 w-3.5" aria-hidden="true" />Cook 1 batch ({batch})</button>
            </div>
          </div>
          <RecipeSheet
            key={`${dish.id}:${JSON.stringify([dish.bowls, dish.price, dish.lines.map((l) => [l.ingredientId, l.section, l.used, l.serves])])}`}
            dish={dish}
            ingredients={ingredients}
            limitId={info.limitId}
            fill={fill}
            onSave={onSave}
          />
        </>
      ) : (
        <p className="py-6 text-center text-xs text-zinc-400">No recipe yet. Press New recipe.</p>
      )}
    </section>
  );
}
