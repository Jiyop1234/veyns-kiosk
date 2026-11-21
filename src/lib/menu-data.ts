// @ts-nocheck
// SECTION 1: Types for selectable menu options, option groups, and menu items.
export interface MenuOption {
  id: string;
  name: string;
  price: number;
  active?: boolean;
  display_order?: number;
}

export interface OptionDependency {
  id?: string;
  dependentGroupId: string;
  parentOptionId: string;
}

export interface MenuOptionGroup {
  id: string;
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  minSelections?: number;
  maxSelections?: number;
  options: MenuOption[];
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  parentOptionIds?: string[];
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  bestSeller?: boolean;
  sortOrder?: number;
  isCustomizable?: boolean;
  hasBrothEggOption?: boolean;
  discountPercent?: number;
  isAvailable?: boolean;
  optionGroups?: MenuOptionGroup[];
}

// SECTION 2: Type describing promo codes used by the menu and ordering flow.
export interface PromoCode {
  code: string;
  discountPercent: number;
}

// SECTION 3: Currency formatting helper for Philippine peso amounts.
export const formatPeso = (amount: number) => {
  return `₱${amount.toFixed(2)}`;
};

// SECTION 4: Category names used to organize and filter the menu.
export const menuCategories = [
  'All items',
  'Rice Bowls',
  'Noodle Bowls',
  'Sides',
  'Apparel'
];

export const CATEGORIES = menuCategories;

// SECTION 8: Read promo codes saved in browser storage; return an empty list if unavailable.
export const getActivePromoCodes = (): PromoCode[] => {
  try {
    const saved = localStorage.getItem('veyns_promo_codes');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
};
