// VEYNS Admin, Inventory: one small dialog for the three stock actions (Step B12): add stock, record waste, edit par level and unit cost.
// The parent renders it only while it is open, so the fields below always start from the chosen ingredient.
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatQty } from './admin-inventory-calc';
import type { Ingredient } from './admin-inventory-types';

export type InventoryDialogMode = 'restock' | 'waste' | 'edit';

type Props = {
  mode: InventoryDialogMode;
  ingredients: Ingredient[];
  ingredientId: string | null; // null = opened from the top Restock Items button: the ingredient is chosen here
  onClose: () => void;
  onRestock: (id: string, amount: number) => boolean;
  onWaste: (id: string, amount: number) => boolean;
  onEdit: (id: string, par: number, unitCost: number) => boolean;
};

const TITLES: Record<InventoryDialogMode, string> = { restock: 'Add stock', waste: 'Record waste', edit: 'Edit ingredient' };

export function AdminInventoryDialog({ mode, ingredients, ingredientId, onClose, onRestock, onWaste, onEdit }: Props) {
  const [id, setId] = useState<string>(ingredientId ?? ingredients[0]?.id ?? '');
  const start = ingredients.find((i) => i.id === (ingredientId ?? ''));
  const [amount, setAmount] = useState('');
  const [par, setPar] = useState(start ? String(start.par) : '');
  const [cost, setCost] = useState(start ? String(start.unitCost) : '');
  const [error, setError] = useState('');

  const ing = ingredients.find((i) => i.id === id);
  const field = 'h-9 w-full rounded-lg bg-white/[0.08] px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 [color-scheme:dark]';

  const submit = () => {
    if (!ing) return;
    let ok = false;
    if (mode === 'edit') {
      const p = Number(par), c = Number(cost);
      if (!(p >= 0) || !(c >= 0) || par.trim() === '' || cost.trim() === '') { setError('Enter a par level and a unit cost of 0 or more.'); return; }
      ok = onEdit(ing.id, p, c);
    } else {
      const n = Number(amount);
      if (!(n > 0)) { setError('Enter an amount greater than 0.'); return; }
      ok = mode === 'restock' ? onRestock(ing.id, n) : onWaste(ing.id, n);
      if (!ok) { setError(mode === 'waste' ? 'There is no stock of this ingredient to remove.' : 'This could not be saved.'); return; }
    }
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <DialogContent className="w-full max-w-sm rounded-3xl bg-[#141817] p-5 text-white">
        <DialogTitle className="font-display text-lg font-extrabold text-white">{TITLES[mode]}</DialogTitle>
        <DialogDescription className="text-xs text-zinc-400">Sample data: this is not saved to the database yet.</DialogDescription>
        <div className="space-y-3 text-xs">
          <label className="block space-y-1">
            <span className="font-bold uppercase tracking-wider text-lime-400">Ingredient</span>
            <select value={id} disabled={ingredientId !== null} onChange={(e) => { setId(e.target.value); setError(''); }} className={field}>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id} className="bg-[#141817]">{i.name} ({formatQty(i.stock, i.unit)} in stock)</option>
              ))}
            </select>
          </label>
          {mode === 'edit' ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="font-bold uppercase tracking-wider text-lime-400">Par level ({ing?.unit})</span>
                <input type="number" min="0" step="any" value={par} onChange={(e) => setPar(e.target.value)} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="font-bold uppercase tracking-wider text-lime-400">Cost per {ing?.unit} (₱)</span>
                <input type="number" min="0" step="any" value={cost} onChange={(e) => setCost(e.target.value)} className={field} />
              </label>
            </div>
          ) : (
            <label className="block space-y-1">
              <span className="font-bold uppercase tracking-wider text-lime-400">Amount to {mode === 'restock' ? 'add' : 'remove'} ({ing?.unit})</span>
              <input type="number" min="0" step="any" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
            </label>
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
