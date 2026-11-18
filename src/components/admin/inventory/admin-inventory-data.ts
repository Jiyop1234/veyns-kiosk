// VEYNS Admin, Inventory: the data hook (Steps B12 and B12b). Sample data kept in memory: what you change is not saved, and a reload brings the sample back.
// The real tables replace this file later; the screen will not need to change.
import { useState } from 'react';
import { byIdMap, bowlsFor, consumptionFor, formatQty } from './admin-inventory-calc';
import { SAMPLE_DISHES, SAMPLE_INGREDIENTS, makeSampleLedger } from './admin-inventory-sample';
import type { Dish, Ingredient, IngredientInput, InventoryLedgerEntry, LedgerAction, RecipePatch } from './admin-inventory-types';

const freshIngredients = (): Ingredient[] => SAMPLE_INGREDIENTS.map((i) => ({ ...i }));
const freshDishes = (): Dish[] => SAMPLE_DISHES.map((d) => ({ ...d, lines: d.lines.map((l) => ({ ...l })) }));
const round2 = (n: number): number => Math.round(n * 100) / 100;
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

export function useAdminInventoryData() {
  const [ingredients, setIngredients] = useState<Ingredient[]>(freshIngredients);
  const [dishes, setDishes] = useState<Dish[]>(freshDishes);
  const [ledger, setLedger] = useState<InventoryLedgerEntry[]>(() => makeSampleLedger(Date.now()));

  const log = (action: LedgerAction, item: string, qtyLabel: string) => {
    const entry: InventoryLedgerEntry = { id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), action, item, qtyLabel, by: 'Admin' };
    setLedger((prev) => [entry, ...prev]);
  };

  const find = (id: string) => ingredients.find((i) => i.id === id);

  // Add any amount you really added (half a pack is fine). If you also type what you paid, the cost per unit follows this purchase.
  const restock = (id: string, amount: number, paid?: number): boolean => {
    const ing = find(id);
    if (!ing || !(amount > 0)) return false;
    setIngredients((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const next = { ...i, stock: round2(i.stock + amount) };
        return paid !== undefined && paid > 0 ? { ...next, price: paid, packs: 1, amount } : next;
      }),
    );
    log('Restock', ing.name, `+${formatQty(amount, ing.unit)}`);
    return true;
  };

  const waste = (id: string, amount: number): boolean => {
    const ing = find(id);
    if (!ing || !(amount > 0) || ing.stock <= 0) return false;
    const taken = Math.min(amount, ing.stock);
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, stock: round2(Math.max(0, i.stock - taken)) } : i)));
    log('Waste', ing.name, `-${formatQty(taken, ing.unit)}`);
    return true;
  };

  // id null = a new ingredient. Returns an error message, or null when saved.
  const saveIngredient = (input: IngredientInput, id: string | null): string | null => {
    const name = input.name.trim();
    if (ingredients.some((i) => i.id !== id && i.name.trim().toLowerCase() === name.toLowerCase())) return 'An ingredient with this name already exists.';
    const clean: IngredientInput = { ...input, name, unit: input.unit.trim() };
    if (id === null) {
      const newId = `${slug(name)}-${Date.now().toString(36)}`;
      setIngredients((prev) => [...prev, { id: newId, ...clean }]);
      log('Adjust', name, `added, ${formatQty(clean.stock, clean.unit)}`);
    } else {
      if (!find(id)) return 'This ingredient no longer exists.';
      setIngredients((prev) => prev.map((i) => (i.id === id ? { id, ...clean } : i)));
      log('Adjust', name, 'details edited');
    }
    return null;
  };

  // Cook: takes the ingredients of the bowls out of stock. Refused when any ingredient would run short.
  const cook = (dishId: string, count: number): boolean => {
    const dish = dishes.find((d) => d.id === dishId);
    if (!dish || !(count >= 1)) return false;
    if (bowlsFor(dish, byIdMap(ingredients)).bowls < count) return false;
    const use = consumptionFor(dish.lines, count);
    setIngredients((prev) => prev.map((i) => (use.has(i.id) ? { ...i, stock: round2(Math.max(0, i.stock - (use.get(i.id) ?? 0))) } : i)));
    log('Usage', dish.name, count === dish.bowls ? `-${count} bowls (1 batch)` : `-${count} bowl${count === 1 ? '' : 's'}`);
    return true;
  };

  const saveRecipe = (dishId: string, patch: RecipePatch) => {
    const dish = dishes.find((d) => d.id === dishId);
    setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, ...patch } : d)));
    if (dish) log('Adjust', dish.name, 'recipe saved');
  };

  const addDish = (name: string): string => {
    const id = `${slug(name)}-${Date.now().toString(36)}`;
    setDishes((prev) => [...prev, { id, name: name.trim(), bowls: 20, price: 0, lines: [] }]);
    log('Adjust', name.trim(), 'new recipe');
    return id;
  };

  const resetSample = () => {
    setIngredients(freshIngredients());
    setDishes(freshDishes());
    setLedger(makeSampleLedger(Date.now()));
  };

  return { ingredients, dishes, ledger, restock, waste, saveIngredient, cook, saveRecipe, addDish, resetSample };
}
