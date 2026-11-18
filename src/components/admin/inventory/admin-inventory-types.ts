// VEYNS Admin, Inventory: the shapes of the data shown on the Inventory screen (Step B12, sample data for now).

export type IngredientCategory = 'Protein' | 'Produce' | 'Sauce' | 'Dairy' | 'Grain' | 'Packaging';

export const INGREDIENT_CATEGORIES: IngredientCategory[] = ['Protein', 'Produce', 'Sauce', 'Dairy', 'Grain', 'Packaging'];

// g and ml are shown as kg and L from 1,000 up; pcs stays pcs.
export type StockUnit = 'g' | 'ml' | 'pcs';

export type Ingredient = {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: StockUnit;
  stock: number; // in the unit above
  par: number; // the level below which the ingredient needs restocking
  unitCost: number; // pesos per one unit (per g, per ml or per pcs)
};

export type RecipeLine = { ingredientId: string; qty: number }; // qty per one bowl, in the ingredient's unit

export type DishCategory = 'Rice Bowls' | 'Noodle Bowls';

export type Dish = {
  id: string;
  name: string;
  category: DishCategory;
  price: number; // selling price of one bowl
  description: string;
  recipe: RecipeLine[];
};

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

export type ShoppingItem = { ingredient: Ingredient; qty: number; cost: number };

export type InventoryStats = {
  totalValue: number;
  belowPar: number;
  out: number;
  cookable: number;
  dishCount: number;
  avgFoodCostPct: number;
};
