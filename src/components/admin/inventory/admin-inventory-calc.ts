// VEYNS Admin, Inventory: the calculations (bowls left, status, food cost, shopping list). Pure functions, no database.
import type { Dish, Ingredient, InventoryStats, ShoppingItem, StockStatus, StockUnit } from './admin-inventory-types';

export const byIdMap = (ingredients: Ingredient[]): Map<string, Ingredient> => new Map(ingredients.map((i) => [i.id, i]));

const trimNum = (n: number): string => String(Number(n.toFixed(2)));

export function formatQty(n: number, unit: StockUnit): string {
  if (unit === 'g') return n >= 1000 ? `${trimNum(n / 1000)} kg` : `${trimNum(n)} g`;
  if (unit === 'ml') return n >= 1000 ? `${trimNum(n / 1000)} L` : `${trimNum(n)} ml`;
  return `${trimNum(n)} pcs`;
}

export function peso(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
}

// OUT: nothing left. CRITICAL: under half of par. LOW: at or under par. OK: above par.
export function stockStatus(i: Ingredient): StockStatus {
  if (i.stock <= 0) return 'OUT';
  if (i.stock < i.par * 0.5) return 'CRITICAL';
  if (i.stock <= i.par) return 'LOW';
  return 'OK';
}

// How many bowls this one ingredient allows, and which ingredient allows the fewest.
export const bowlsFromLine = (stock: number, qty: number): number => (qty > 0 ? Math.max(0, Math.floor(stock / qty + 1e-9)) : 0);

export function bowlsFor(dish: Dish, byId: Map<string, Ingredient>): { bowls: number; limitId: string | null } {
  let best = Infinity;
  let limitId: string | null = null;
  dish.recipe.forEach((line) => {
    const ing = byId.get(line.ingredientId);
    if (!ing || line.qty <= 0) return;
    const n = bowlsFromLine(ing.stock, line.qty);
    if (n < best) {
      best = n;
      limitId = ing.id;
    }
  });
  return { bowls: best === Infinity ? 0 : best, limitId };
}

export function dishCost(dish: Dish, byId: Map<string, Ingredient>): number {
  return dish.recipe.reduce((sum, line) => sum + line.qty * (byId.get(line.ingredientId)?.unitCost ?? 0), 0);
}

export function inventoryStats(ingredients: Ingredient[], dishes: Dish[]): InventoryStats {
  const byId = byIdMap(ingredients);
  const pcts = dishes.filter((d) => d.price > 0).map((d) => (dishCost(d, byId) / d.price) * 100);
  return {
    totalValue: ingredients.reduce((s, i) => s + i.stock * i.unitCost, 0),
    belowPar: ingredients.filter((i) => i.stock > 0 && i.stock <= i.par).length,
    out: ingredients.filter((i) => i.stock <= 0).length,
    cookable: dishes.filter((d) => bowlsFor(d, byId).bowls > 0).length,
    dishCount: dishes.length,
    avgFoodCostPct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0,
  };
}

// Suggested purchase: bring every ingredient at or under par back up to twice its par, in steps of 50 (g, ml) or 1 (pcs).
export function shoppingList(ingredients: Ingredient[]): ShoppingItem[] {
  return ingredients
    .filter((i) => i.stock <= i.par)
    .map((ingredient) => {
      const step = ingredient.unit === 'pcs' ? 1 : 50;
      const qty = Math.ceil((ingredient.par * 2 - ingredient.stock) / step) * step;
      return { ingredient, qty, cost: qty * ingredient.unitCost };
    })
    .sort((a, b) => a.ingredient.stock / a.ingredient.par - b.ingredient.stock / b.ingredient.par);
}

export function shoppingCsv(items: ShoppingItem[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = items.map((it) => [q(it.ingredient.name), String(it.qty), it.ingredient.unit, it.cost.toFixed(2)].join(','));
  return ['Ingredient,Quantity,Unit,Estimated cost (PHP)', ...lines].join('\r\n');
}
