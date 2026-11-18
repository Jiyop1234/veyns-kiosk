// VEYNS Admin, Inventory: the data hook (Step B12). Sample data kept in memory: what you change is not saved, and a reload brings the sample back.
// B12b replaces this with real tables; the screen will not need to change, only this file.
import { useState } from 'react';
import { byIdMap, bowlsFor, formatQty } from './admin-inventory-calc';
import { SAMPLE_DISHES, SAMPLE_INGREDIENTS, makeSampleLedger } from './admin-inventory-sample';
import type { Dish, Ingredient, InventoryLedgerEntry, LedgerAction, RecipeLine } from './admin-inventory-types';

const freshIngredients = (): Ingredient[] => SAMPLE_INGREDIENTS.map((i) => ({ ...i }));
const freshDishes = (): Dish[] => SAMPLE_DISHES.map((d) => ({ ...d, recipe: d.recipe.map((r) => ({ ...r })) }));

export function useAdminInventoryData() {
  const [ingredients, setIngredients] = useState<Ingredient[]>(freshIngredients);
  const [dishes, setDishes] = useState<Dish[]>(freshDishes);
  const [ledger, setLedger] = useState<InventoryLedgerEntry[]>(() => makeSampleLedger(Date.now()));

  const log = (action: LedgerAction, item: string, qtyLabel: string, by: string) => {
    const entry: InventoryLedgerEntry = { id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), action, item, qtyLabel, by };
    setLedger((prev) => [entry, ...prev]);
  };

  const find = (id: string) => ingredients.find((i) => i.id === id);

  const restock = (id: string, amount: number): boolean => {
    const ing = find(id);
    if (!ing || !(amount > 0)) return false;
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, stock: i.stock + amount } : i)));
    log('Restock', ing.name, `+${formatQty(amount, ing.unit)}`, 'Admin');
    return true;
  };

  const waste = (id: string, amount: number): boolean => {
    const ing = find(id);
    if (!ing || !(amount > 0) || ing.stock <= 0) return false;
    const taken = Math.min(amount, ing.stock);
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, stock: Math.max(0, i.stock - taken) } : i)));
    log('Waste', ing.name, `-${formatQty(taken, ing.unit)}`, 'Admin');
    return true;
  };

  const updateIngredient = (id: string, par: number, unitCost: number): boolean => {
    const ing = find(id);
    if (!ing || !(par >= 0) || !(unitCost >= 0)) return false;
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, par, unitCost } : i)));
    log('Adjust', ing.name, `par ${formatQty(par, ing.unit)}`, 'Admin');
    return true;
  };

  // Cook: takes one bowl's ingredients per bowl out of stock. Refused when any ingredient would run short.
  const cook = (dishId: string, count: number): boolean => {
    const dish = dishes.find((d) => d.id === dishId);
    if (!dish || count < 1) return false;
    if (bowlsFor(dish, byIdMap(ingredients)).bowls < count) return false;
    setIngredients((prev) =>
      prev.map((i) => {
        const line = dish.recipe.find((r) => r.ingredientId === i.id);
        return line ? { ...i, stock: Math.max(0, i.stock - line.qty * count) } : i;
      }),
    );
    log('Usage', dish.name, `-${count} bowl${count === 1 ? '' : 's'}`, 'Admin');
    return true;
  };

  const updateRecipe = (dishId: string, recipe: RecipeLine[]) => {
    setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, recipe } : d)));
    const dish = dishes.find((d) => d.id === dishId);
    if (dish) log('Adjust', dish.name, 'recipe saved', 'Admin');
  };

  const resetSample = () => {
    setIngredients(freshIngredients());
    setDishes(freshDishes());
    setLedger(makeSampleLedger(Date.now()));
  };

  return { ingredients, dishes, ledger, restock, waste, updateIngredient, cook, updateRecipe, resetSample };
}
