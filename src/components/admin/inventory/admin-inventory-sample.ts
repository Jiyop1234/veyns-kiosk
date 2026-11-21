// VEYNS Admin, Inventory: the sample data (Steps B12 and B12b). Nothing here comes from the database.
// Prices, amounts, "used" and the 20-bowl batch are the owner's Excel sheet for Pork Sugba. The stock levels are invented.
import type { Dish, Ingredient, InventoryLedgerEntry, RecipeLine, Section } from './admin-inventory-types';

const ing = (id: string, name: string, category: Section, unit: string, price: number, packs: number, amount: number, stock: number, par: number): Ingredient => ({
  id, name, category, unit, price, packs, amount, stock, par,
});

//                id              name              category     unit      price packs amount  stock  par
export const SAMPLE_INGREDIENTS: Ingredient[] = [
  ing('pork-belly', 'Pork Belly', 'Marinade', 'g', 560, 1, 2000, 1500, 500),
  ing('oyster-sauce', 'Oyster Sauce', 'Marinade', 'g', 196, 1, 765, 500, 150),
  ing('brown-sugar', 'Brown Sugar', 'Marinade', 'g', 18, 1, 250, 150, 50),
  ing('magic-sarap', 'Magic Sarap', 'Marinade', 'sachet', 6, 3, 3, 3, 3),
  ing('garlic', 'Garlic', 'Marinade', 'cloves', 7, 2, 20, 14, 6),
  ing('calamansi', 'Calamansi', 'Marinade', 'pcs', 45, 1, 26, 6, 6),
  ing('cucumber', 'Cucumber', 'Garnish', 'g', 22, 2, 550, 300, 100),
  ing('green-onion', 'Green Onion', 'Garnish', 'g', 45, 2, 64, 40, 20),
  ing('chili', 'Chili', 'Garnish', 'pcs', 10, 1, 48, 30, 10),
  ing('soy-sauce', 'Soy Sauce', 'Sauce', 'ml', 57, 1, 1000, 600, 250),
  ing('vinegar', 'Vinegar', 'Sauce', 'ml', 47, 1, 1000, 700, 250),
  ing('onion', 'Onion', 'Sauce', 'g', 14, 2, 154, 240, 60),
  ing('paper-bowl', 'Paper Bowl', 'Packaging', 'pcs', 10, 1, 1, 40, 20),
  ing('spork', 'Spork', 'Packaging', 'pcs', 2, 1, 1, 60, 20),
  ing('sauce-cup', 'Sauce Cup', 'Packaging', 'pcs', 2, 1, 1, 45, 20),
  ing('paper-bag', 'Paper Bag', 'Packaging', 'pcs', 1, 1, 1, 38, 20),
  ing('rice', 'Rice', 'Utilities', 'g', 114, 1, 2000, 2640, 1000),
  ing('charcoal', 'Charcoal', 'Utilities', 'bag', 20, 2, 2, 3, 2),
  ing('butane', 'Butane', 'Utilities', 'pcs', 0, 1, 1, 0, 1), // no price in the sheet yet
];

const line = (ingredientId: string, section: Section, used: number, serves: number): RecipeLine => ({ ingredientId, section, used, serves });

// serves 1 = per bowl; 20 = per batch of 20 bowls; 50 = the sauce batch (1,000 ml = 50 sauce cups of 20 g).
export const SAMPLE_DISHES: Dish[] = [
  {
    id: 'pork-sugba',
    name: 'Pork Sugba',
    bowls: 20,
    price: 99,
    lines: [
      line('pork-belly', 'Marinade', 100, 1),
      line('soy-sauce', 'Marinade', 285, 20),
      line('oyster-sauce', 'Marinade', 90, 20),
      line('brown-sugar', 'Marinade', 40, 20),
      line('magic-sarap', 'Marinade', 3, 20),
      line('garlic', 'Marinade', 12, 20),
      line('calamansi', 'Marinade', 6, 20),
      line('cucumber', 'Garnish', 4, 1),
      line('green-onion', 'Garnish', 4, 1),
      line('chili', 'Garnish', 1, 1),
      line('soy-sauce', 'Sauce', 526, 50),
      line('vinegar', 'Sauce', 474, 50),
      line('onion', 'Sauce', 20, 1),
      line('paper-bowl', 'Packaging', 1, 1),
      line('spork', 'Packaging', 1, 1),
      line('sauce-cup', 'Packaging', 1, 1),
      line('paper-bag', 'Packaging', 1, 1),
      line('rice', 'Utilities', 220, 1),
      line('charcoal', 'Utilities', 2, 20), // charcoal is costed by batch
    ],
  },
];

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export function makeSampleLedger(now: number): InventoryLedgerEntry[] {
  const rows: [number, InventoryLedgerEntry['action'], string, string, string][] = [
    [20 * MIN, 'Restock', 'Pork Belly', '+1,000 g', 'Admin'],
    [55 * MIN, 'Usage', 'Pork Sugba', '-5 bowls', 'Admin'],
    [2 * HOUR, 'Waste', 'Calamansi', '-4 pcs', 'Admin'],
    [5 * HOUR, 'Restock', 'Rice', '+2,000 g', 'Admin'],
    [26 * HOUR, 'Usage', 'Pork Sugba', '-20 bowls (1 batch)', 'Admin'],
  ];
  return rows.map(([ago, action, item, qtyLabel, by], i) => ({ id: `sample-${i}`, at: now - ago, action, item, qtyLabel, by }));
}

// Six earlier days of each stat card number, for the small charts (sample). The last point of each chart is the live number.
export const SAMPLE_HISTORY = {
  value: [1480, 1590, 1530, 1650, 1560, 1610],
  belowPar: [1, 1, 2, 3, 2, 2],
  out: [0, 0, 1, 1, 1, 1],
  cookable: [1, 1, 1, 1, 1, 1],
  foodCost: [72.8, 72.1, 73, 72.6, 73.4, 72.9],
};
