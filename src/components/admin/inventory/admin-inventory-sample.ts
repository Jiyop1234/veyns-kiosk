// VEYNS Admin, Inventory: the sample data (Step B12). Nothing here comes from the database.
import type { Dish, Ingredient, InventoryLedgerEntry } from './admin-inventory-types';

export const SAMPLE_INGREDIENTS: Ingredient[] = [
  { id: 'pork-belly', name: 'Pork Belly', category: 'Protein', unit: 'g', stock: 3600, par: 2000, unitCost: 0.32 },
  { id: 'cheese', name: 'Cheese', category: 'Dairy', unit: 'g', stock: 90, par: 200, unitCost: 0.8 },
  { id: 'eggs', name: 'Eggs', category: 'Protein', unit: 'pcs', stock: 12, par: 12, unitCost: 8 },
  { id: 'noodles', name: 'Noodles', category: 'Grain', unit: 'g', stock: 3600, par: 3000, unitCost: 0.12 },
  { id: 'green-onions', name: 'Green Onions', category: 'Produce', unit: 'g', stock: 250, par: 200, unitCost: 0.3 },
  { id: 'rice', name: 'Rice', category: 'Grain', unit: 'g', stock: 9000, par: 6000, unitCost: 0.04 },
  { id: 'chicken', name: 'Chicken Thigh', category: 'Protein', unit: 'g', stock: 2400, par: 1500, unitCost: 0.28 },
  { id: 'pork-cutlet', name: 'Pork Cutlet', category: 'Protein', unit: 'pcs', stock: 30, par: 20, unitCost: 18 },
  { id: 'soy', name: 'Soy Sauce', category: 'Sauce', unit: 'ml', stock: 1800, par: 1000, unitCost: 0.06 },
  { id: 'buldak-sauce', name: 'Buldak Sauce', category: 'Sauce', unit: 'ml', stock: 450, par: 500, unitCost: 0.45 },
  { id: 'broth', name: 'Ramen Broth', category: 'Sauce', unit: 'ml', stock: 9000, par: 4000, unitCost: 0.03 },
  { id: 'garlic', name: 'Garlic', category: 'Produce', unit: 'g', stock: 600, par: 300, unitCost: 0.12 },
  { id: 'kimchi', name: 'Kimchi', category: 'Produce', unit: 'g', stock: 0, par: 500, unitCost: 0.25 },
  { id: 'bowl', name: 'Takeaway Bowl', category: 'Packaging', unit: 'pcs', stock: 150, par: 100, unitCost: 4 },
];

export const SAMPLE_DISHES: Dish[] = [
  {
    id: 'pork-sugba', name: 'Pork Sugba', category: 'Rice Bowls', price: 149, description: 'Grilled pork with special sinugba sauce.',
    recipe: [{ ingredientId: 'pork-belly', qty: 120 }, { ingredientId: 'rice', qty: 180 }, { ingredientId: 'eggs', qty: 1 }, { ingredientId: 'soy', qty: 20 }, { ingredientId: 'garlic', qty: 5 }, { ingredientId: 'bowl', qty: 1 }],
  },
  {
    id: 'cheesy-buldak', name: 'Cheesy Buldak', category: 'Noodle Bowls', price: 159, description: 'Spicy buldak noodles topped with melted cheese.',
    recipe: [{ ingredientId: 'noodles', qty: 150 }, { ingredientId: 'buldak-sauce', qty: 40 }, { ingredientId: 'cheese', qty: 30 }, { ingredientId: 'green-onions', qty: 5 }, { ingredientId: 'bowl', qty: 1 }],
  },
  {
    id: 'katsu-don', name: 'Katsu Don', category: 'Rice Bowls', price: 155, description: 'Crispy pork cutlet and egg over steamed rice.',
    recipe: [{ ingredientId: 'rice', qty: 180 }, { ingredientId: 'pork-cutlet', qty: 1 }, { ingredientId: 'eggs', qty: 2 }, { ingredientId: 'soy', qty: 15 }, { ingredientId: 'bowl', qty: 1 }],
  },
  {
    id: 'ramen-bowl', name: 'Ramen Bowl', category: 'Noodle Bowls', price: 169, description: 'Rich pork broth, noodles and sliced belly.',
    recipe: [{ ingredientId: 'noodles', qty: 120 }, { ingredientId: 'broth', qty: 350 }, { ingredientId: 'pork-belly', qty: 60 }, { ingredientId: 'green-onions', qty: 8 }, { ingredientId: 'bowl', qty: 1 }],
  },
  {
    id: 'chicken-teriyaki', name: 'Chicken Teriyaki', category: 'Rice Bowls', price: 145, description: 'Glazed chicken thigh over steamed rice.',
    recipe: [{ ingredientId: 'chicken', qty: 150 }, { ingredientId: 'rice', qty: 180 }, { ingredientId: 'soy', qty: 25 }, { ingredientId: 'garlic', qty: 5 }, { ingredientId: 'bowl', qty: 1 }],
  },
  {
    id: 'kimchi-fried-rice', name: 'Kimchi Fried Rice', category: 'Rice Bowls', price: 135, description: 'Garlic fried rice with kimchi and a sunny egg.',
    recipe: [{ ingredientId: 'rice', qty: 180 }, { ingredientId: 'kimchi', qty: 60 }, { ingredientId: 'eggs', qty: 1 }, { ingredientId: 'garlic', qty: 5 }, { ingredientId: 'bowl', qty: 1 }],
  },
];

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export function makeSampleLedger(now: number): InventoryLedgerEntry[] {
  const rows: [number, InventoryLedgerEntry['action'], string, string, string][] = [
    [20 * MIN, 'Restock', 'Pork Belly', '+1 kg', 'Admin'],
    [55 * MIN, 'Usage', 'Pork Sugba', '-5 bowls', 'System'],
    [2 * HOUR, 'Waste', 'Cheese', '-50 g', 'Admin'],
    [5 * HOUR, 'Restock', 'Eggs', '+30 pcs', 'Admin'],
    [26 * HOUR, 'Usage', 'Ramen Bowl', '-8 bowls', 'System'],
    [29 * HOUR, 'Adjust', 'Green Onions', '+20 g', 'Admin'],
  ];
  return rows.map(([ago, action, item, qtyLabel, by], i) => ({ id: `sample-${i}`, at: now - ago, action, item, qtyLabel, by }));
}

// Six earlier days of each stat card number, for the small charts (sample). The last point of each chart is the live number.
export const SAMPLE_HISTORY = {
  value: [4380, 4520, 4310, 4700, 4580, 4490],
  belowPar: [1, 2, 2, 3, 2, 3],
  out: [0, 0, 1, 0, 1, 1],
  cookable: [6, 6, 5, 6, 5, 5],
  foodCost: [33.2, 33.8, 34.5, 34, 34.3, 34.1],
};
