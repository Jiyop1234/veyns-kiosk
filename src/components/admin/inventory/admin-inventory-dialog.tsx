// VEYNS Admin, Inventory: one dialog for the stock actions (Step B12b): add stock, record waste, edit an ingredient, new ingredient.
// Amounts are typed freely: add only what you really added (half a pack is fine). No lists to choose from.
// The parent renders it only while it is open, so the fields always start from the chosen ingredient.
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatQty } from './admin-inventory-calc';
import { SECTIONS } from './admin-inventory-types';
import type { Ingredient, IngredientInput, Section } from './admin-inventory-types';

export type InventoryDialogState = { mode: 'restock' | 'waste' | 'edit'; id: string } | { mode: 'new' };

type Props = {
  state: InventoryDialogState;
  ingredients: Ingredient[];
  onClose: () => void;
  onRestock: (id: string, amount: number, paid?: number) => boolean;
  onWaste: (id: string, amount: number) => boolean;
  onSave: (input: IngredientInput, id: string | null) => string | null;
};

const num = (s: string): number => (s.trim() === '' ? NaN : Number(s));
const field = 'h-9 w-full rounded-lg bg-white/[0.08] px-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 [color-scheme:dark]';
const label = 'font-bold uppercase tracking-wider text-lime-400';

export function AdminInventoryDialog({ state, ingredients, onClose, onRestock, onWaste, onSave }: Props) {
  const ing = state.mode === 'new' ? undefined : ingredients.find((i) => i.id === state.id);
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState('');
  const [name, setName] = useState(ing?.name ?? '');
  const [category, setCategory] = useState<Section>(ing?.category ?? 'Marinade');
  const [unit, setUnit] = useState(ing?.unit ?? 'g');
  const [price, setPrice] = useState(ing ? String(ing.price) : '');
  const [packs, setPacks] = useState(ing ? String(ing.packs) : '1');
  const [bought, setBought] = useState(ing ? String(ing.amount) : '');
  const [stock, setStock] = useState(ing ? String(ing.stock) : '');
  const [par, setPar] = useState(ing ? String(ing.par) : '');
  const [error, setError] = useState('');

  const editing = state.mode === 'edit' || state.mode === 'new';
  const typed = num(amount);

  const submit = () => {
    if (state.mode === 'restock' || state.mode === 'waste') {
      if (!ing) return;
      if (!(typed > 0)) { setError('Type an amount greater than 0.'); return; }
      if (state.mode === 'restock') {
        const p = paid.trim() === '' ? undefined : num(paid);
        if (p !== undefined && !(p >= 0)) { setError('The amount paid must be 0 or more, or left empty.'); return; }
        if (onRestock(ing.id, typed, p)) onClose();
        else setError('This could not be saved.');
      } else if (onWaste(ing.id, typed)) onClose();
      else setError('There is no stock of this ingredient to remove.');
      return;
    }
    const p = num(price), k = num(packs), b = num(bought);
    const s = stock.trim() === '' && state.mode === 'new' ? b : num(stock);
    const pr = par.trim() === '' ? 0 : num(par);
    if (!name.trim()) { setError('Type the ingredient name.'); return; }
    if (!unit.trim()) { setError('Type the unit (g, ml, pcs, cloves, sachet...).'); return; }
    if (!(p >= 0)) { setError('Type the price of one pack (0 if not priced yet).'); return; }
    if (!(k > 0)) { setError('Type how many packs were bought.'); return; }
    if (!(b > 0)) { setError('Type the total amount bought, in the unit above.'); return; }
    if (!(s >= 0)) { setError('Type the stock on hand (0 or more).'); return; }
    if (!(pr >= 0)) { setError('The par level must be 0 or more.'); return; }
    const err = onSave({ name, category, unit, stock: s, par: pr, price: p, packs: k, amount: b }, state.mode === 'edit' ? state.id : null);
    if (err) setError(err);
    else onClose();
  };

  const title = state.mode === 'new' ? 'New ingredient' : !ing ? 'Ingredient' : state.mode === 'restock' ? `Add stock: ${ing.name}` : state.mode === 'waste' ? `Record waste: ${ing.name}` : `Edit ${ing.name}`;

  return (
    <Dialog open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <DialogContent className={`w-full rounded-3xl bg-[#141817] p-5 text-white ${editing ? 'max-w-md' : 'max-w-sm'}`}>
        <DialogTitle className="font-display text-lg font-extrabold text-white">{title}</DialogTitle>
        <DialogDescription className="text-xs text-zinc-400">Sample data: this is not saved to the database yet.</DialogDescription>
        <div className="space-y-3 text-xs">
          {(state.mode === 'restock' || state.mode === 'waste') && ing && (
            <>
              <p className="rounded-lg bg-white/[0.06] px-3 py-2 text-zinc-300">
                Stock now: <strong className="text-white">{formatQty(ing.stock, ing.unit)}</strong>
                {typed > 0 && <> → <strong className="text-lime-300">{formatQty(state.mode === 'restock' ? ing.stock + typed : Math.max(0, ing.stock - typed), ing.unit)}</strong></>}
              </p>
              <label className="block space-y-1">
                <span className={label}>{state.mode === 'restock' ? 'Amount added' : 'Amount removed'} ({ing.unit})</span>
                <input type="number" min="0" step="any" autoFocus value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} placeholder={state.mode === 'restock' ? 'Only what you really added, e.g. half a pack' : ''} className={field} />
              </label>
              {state.mode === 'restock' && (
                <label className="block space-y-1">
                  <span className={label}>Total paid ₱ (optional)</span>
                  <input type="number" min="0" step="any" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="If typed, the cost per unit follows this purchase" className={field} />
                </label>
              )}
            </>
          )}
          {editing && (
            <>
              <label className="block space-y-1">
                <span className={label}>Ingredient</span>
                <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="e.g. Pork Belly" autoFocus={state.mode === 'new'} className={field} />
              </label>
              <div className="space-y-1">
                <span className={label}>Category</span>
                <div className="flex flex-wrap gap-1.5">
                  {SECTIONS.map((c) => (
                    <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${category === c ? 'bg-lime-400 text-black' : 'bg-white/[0.08] text-zinc-200 hover:bg-white/[0.14]'}`}>{c}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className={label}>Unit</span>
                  <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g, ml, pcs" className={field} />
                </label>
                <label className="block space-y-1">
                  <span className={label}>Price (pack)</span>
                  <input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
                </label>
                <label className="block space-y-1">
                  <span className={label}>Qty bought</span>
                  <input type="number" min="0" step="any" value={packs} onChange={(e) => setPacks(e.target.value)} className={field} />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className={label}>Unit bought</span>
                  <input type="number" min="0" step="any" value={bought} onChange={(e) => setBought(e.target.value)} placeholder="Total amount" className={field} />
                </label>
                <label className="block space-y-1">
                  <span className={label}>Stock now</span>
                  <input type="number" min="0" step="any" value={stock} onChange={(e) => setStock(e.target.value)} placeholder={state.mode === 'new' ? 'Same as bought' : ''} className={field} />
                </label>
                <label className="block space-y-1">
                  <span className={label}>Par level</span>
                  <input type="number" min="0" step="any" value={par} onChange={(e) => setPar(e.target.value)} placeholder="Low stock at" className={field} />
                </label>
              </div>
              <p className="text-zinc-500">Price × qty bought is the overall cost. Unit bought is the total amount of all the packs, as in your sheet.</p>
            </>
          )}
          {error && <p className="rounded-lg bg-red-400/10 px-3 py-2 text-red-300">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-white/[0.08] py-2 text-xs font-bold text-zinc-200 hover:bg-white/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">Cancel</button>
            <button type="button" onClick={submit} className="flex-1 rounded-xl bg-lime-400 py-2 text-xs font-extrabold text-black hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">Save</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
