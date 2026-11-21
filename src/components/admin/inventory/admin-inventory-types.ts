// VEYNS Admin, Inventory: the shapes of the data on the Inventory screen (Steps B12 and B12b, sample data for now).
// The model follows the owner's Excel costing sheet (Pork Sugba): ingredients are bought in packs, recipes are costed by batch.

// The CATEGORY column of the sheet. The same five names group the pantry and the lines of a recipe.
export type Section = 'Marinade' | 'Garnish' | 'Sauce' | 'Packaging' | 'Utilities';

export const SECTIONS: Section[] = ['Marinade', 'Garnish', 'Sauce', 'Packaging', 'Utilities'];

export type Ingredient = {
  id: string;
  name: string; // DESCRIPTION
  category: Section;
  unit: string; // g, ml, pcs, cloves, sachet, bag...
  stock: number; // what is on the shelf now, in the unit above
  par: number; // low-stock level
  // The last purchase, as in the sheet:
  price: number; // PRICE: one pack
  packs: number; // QTY BOUGHT: number of packs
  amount: number; // UNIT BOUGHT: total amount of all those packs, in the unit above
};

export type IngredientInput = Omit<Ingredient, 'id'>;

// One row of a recipe. "used" is the amount that is enough for "serves" bowls:
// 100 g of pork belly for 1 bowl; 285 ml of soy sauce for the whole 20-bowl batch; 2 bags of charcoal for the batch.
export type RecipeLine = { ingredientId: string; section: Section; used: number; serves: number };

export type Dish = {
  id: string;
  name: string;
  bowls: number; // BOWLS YIELDED by one batch
  price: number; // SELLING PRICE of one bowl
  lines: RecipeLine[];
};

export type RecipePatch = { lines: RecipeLine[]; bowls: number; price: number };

export type LedgerAction = 'Restock' | 'Usage' | 'Waste' | 'Adjust';

export type InventoryLedgerEntry = {
  id: string;
  at: number; // milliseconds
  action: LedgerAction;
  item: string;
  qtyLabel: string;
  by: string;
};

export type StockStatus = 'OK' | 'LOW' | 'CRITICAL' | 'OUT';

export type InventoryStats = {
  totalValue: number;
  belowPar: number;
  out: number;
  cookable: number;
  dishCount: number;
  avgFoodCostPct: number;
};
