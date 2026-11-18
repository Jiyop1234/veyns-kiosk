// VEYNS Admin, Inventory: the calculations (unit cost, cost per bowl, bowls left, status, stats). Pure functions, no database.
// They follow the owner's Excel costing sheet: cost per bowl of a line = overall cost x used / unit bought / bowls served.
import type { Dish, Ingredient, InventoryStats, RecipeLine, Section, StockStatus } from './admin-inventory-types';

export const byIdMap = (ingredients: Ingredient[]): Map<string, Ingredient> => new Map(ingredients.map((i) => [i.id, i]));

export function formatQty(n: number, unit: string): string {
  return `${Number(n.toFixed(2)).toLocaleString('en-PH')} ${unit}`;
}

// ₱ with 2 decimals only when needed (stat cards, pantry) ...
export function peso(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
}

// ... and always 2 decimals (recipe sheet, like the Excel).
export function peso2(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// OVERALL COST of the last purchase, and the cost of one unit (one g, one ml, one piece).
export const overallCost = (i: Ingredient): number => i.price * i.packs;
export const unitCost = (i: Ingredient): number => (i.amount > 0 ? overallCost(i) / i.amount : 0);

// COST USED PER BOWL of one recipe line.
export function lineCost(line: RecipeLine, ing: Ingredient | undefined): number {
  return ing && line.serves > 0 ? (line.used * unitCost(ing)) / line.serves : 0;
}

export function sectionTotals(lines: RecipeLine[], byId: Map<string, Ingredient>): Record<Section, number> {
  const totals: Record<Section, number> = { Marinade: 0, Garnish: 0, Sauce: 0, Packaging: 0, Utilities: 0 };
  lines.forEach((l) => {
    totals[l.section] += lineCost(l, byId.get(l.ingredientId));
  });
  return totals;
}

export const costPerBowl = (lines: RecipeLine[], byId: Map<string, Ingredient>): number =>
  lines.reduce((sum, l) => sum + lineCost(l, byId.get(l.ingredientId)), 0);

// How much of each ingredient the given number of bowls takes out of stock (an ingredient used in two sections is added up).
export function consumptionFor(lines: RecipeLine[], bowls: number): Map<string, number> {
  const use = new Map<string, number>();
  lines.forEach((l) => {
    if (l.serves > 0 && l.used > 0) use.set(l.ingredientId, (use.get(l.ingredientId) ?? 0) + (l.used / l.serves) * bowls);
  });
  return use;
}

export function bowlsFor(dish: Dish, byId: Map<string, Ingredient>): { bowls: number; limitId: string | null } {
  let best = Infinity;
  let limitId: string | null = null;
  consumptionFor(dish.lines, 1).forEach((perBowl, id) => {
    const ing = byId.get(id);
    if (!ing) return;
    const n = Math.max(0, Math.floor(ing.stock / perBowl + 1e-9));
    if (n < best) {
      best = n;
      limitId = id;
    }
  });
  return { bowls: best === Infinity ? 0 : best, limitId };
}

// OUT: nothing left. CRITICAL: under half of par. LOW: at or under par. OK: above par.
export function stockStatus(i: Ingredient): StockStatus {
  if (i.stock <= 0) return 'OUT';
  if (i.stock < i.par * 0.5) return 'CRITICAL';
  if (i.stock <= i.par) return 'LOW';
  return 'OK';
}

export function inventoryStats(ingredients: Ingredient[], dishes: Dish[]): InventoryStats {
  const byId = byIdMap(ingredients);
  const priced = dishes.filter((d) => d.price > 0 && d.lines.length > 0);
  const pcts = priced.map((d) => (costPerBowl(d.lines, byId) / d.price) * 100);
  return {
    totalValue: ingredients.reduce((s, i) => s + i.stock * unitCost(i), 0),
    belowPar: ingredients.filter((i) => i.stock > 0 && i.stock <= i.par).length,
    out: ingredients.filter((i) => i.stock <= 0).length,
    cookable: dishes.filter((d) => bowlsFor(d, byId).bowls > 0).length,
    dishCount: dishes.length,
    avgFoodCostPct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0,
  };
}
