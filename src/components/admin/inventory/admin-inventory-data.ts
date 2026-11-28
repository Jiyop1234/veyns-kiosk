// VEYNS Admin, Inventory: the data hook (Step 6C-3). Real data, no sample.
// Reading: straight from the four inventory tables (staff only, by policy).
// Writing: only through the gateway routes (src/lib/admin-inventory-api.ts). The database keeps the rules
// (duplicate names, stock limits, recipe rules) and writes the stock movements itself.
// After every write the data is read again, so the screen always shows what the database holds.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  addInventoryDish,
  cookInventoryDish,
  restockInventoryIngredient,
  saveInventoryIngredient,
  saveInventoryRecipe,
  wasteInventoryIngredient,
} from '@/lib/admin-inventory-api';
import type { InventoryWriteResult } from '@/lib/admin-inventory-api';
import { SECTIONS } from './admin-inventory-types';
import type { Dish, Ingredient, IngredientInput, InventoryLedgerEntry, LedgerAction, RecipeLine, RecipePatch, Section } from './admin-inventory-types';

const ACTIONS: LedgerAction[] = ['Restock', 'Usage', 'Waste', 'Adjust'];
const asSection = (s: unknown): Section => (SECTIONS.includes(s as Section) ? (s as Section) : 'Marinade');
const asAction = (s: unknown): LedgerAction => (ACTIONS.includes(s as LedgerAction) ? (s as LedgerAction) : 'Adjust');

export function useAdminInventoryData() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ledger, setLedger] = useState<InventoryLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    const [items, dishRows, lineRows, moves] = await Promise.all([
      supabase.from('inventory_items').select('id,name,category,unit,stock,par,price,packs,amount').order('name'),
      supabase.from('inventory_dishes').select('id,name,bowls,price').order('created_at'),
      supabase.from('inventory_recipe_lines').select('dish_id,ingredient_id,section,used,serves'),
      supabase.from('inventory_movements').select('id,at,action,item_name,qty_label').order('at', { ascending: false }).limit(20),
    ]);
    const failed = items.error || dishRows.error || lineRows.error || moves.error;
    if (failed) {
      setLoadError('The inventory could not be loaded. Press the refresh button to try again.');
      setLoading(false);
      return;
    }
    const linesByDish = new Map<string, RecipeLine[]>();
    (lineRows.data ?? []).forEach((l) => {
      const list = linesByDish.get(l.dish_id) ?? [];
      list.push({ ingredientId: l.ingredient_id, section: asSection(l.section), used: Number(l.used), serves: Number(l.serves) });
      linesByDish.set(l.dish_id, list);
    });
    setIngredients(
      (items.data ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        category: asSection(i.category),
        unit: i.unit,
        stock: Number(i.stock),
        par: Number(i.par),
        price: Number(i.price),
        packs: Number(i.packs),
        amount: Number(i.amount),
      })),
    );
    setDishes((dishRows.data ?? []).map((d) => ({ id: d.id, name: d.name, bowls: Number(d.bowls), price: Number(d.price), lines: linesByDish.get(d.id) ?? [] })));
    setLedger((moves.data ?? []).map((m) => ({ id: m.id, at: new Date(m.at).getTime(), action: asAction(m.action), item: m.item_name, qtyLabel: m.qty_label, by: '' })));
    setLoadError('');
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Every write: send it, then read again (also after a refusal, so the screen never stays out of date).
  const write = async (send: () => Promise<InventoryWriteResult>): Promise<InventoryWriteResult> => {
    const result = await send();
    await reload();
    return result;
  };

  const restock = (id: string, amount: number, paid?: number) => write(() => restockInventoryIngredient(id, amount, paid));
  const waste = (id: string, amount: number) => write(() => wasteInventoryIngredient(id, amount));
  const saveIngredient = (input: IngredientInput, id: string | null) => write(() => saveInventoryIngredient(input, id));
  const cook = (dishId: string, count: number) => write(() => cookInventoryDish(dishId, count));
  const saveRecipe = (dishId: string, patch: RecipePatch) => write(() => saveInventoryRecipe(dishId, patch));
  const addDish = (name: string) => write(() => addInventoryDish(name));

  return { ingredients, dishes, ledger, loading, loadError, reload, restock, waste, saveIngredient, cook, saveRecipe, addDish };
}
