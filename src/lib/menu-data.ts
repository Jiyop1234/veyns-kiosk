// @ts-nocheck
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

export interface PromoCode {
  code: string;
  discountPercent: number;
}

export const formatPeso = (amount: number) => {
  return `₱${amount.toFixed(2)}`;
};

export const menuCategories = [
  'All items',
  'Rice Bowls',
  'Noodle Bowls',
  'Sides',
  'Apparel'
];

export const CATEGORIES = menuCategories;

export const UPSELL_ITEMS: MenuItem[] = [
  {
    id: 'fries',
    name: "Crispy French Fries (Salted w/ Cane's Dip)",
    category: 'Sides',
    price: 59,
    description: "Crispy salted french fries served with signature Raising Cane's dipping sauce."
  },
  {
    id: 'extra-egg',
    name: 'Extra Fried / Hardboiled Egg',
    category: 'Sides',
    price: 15,
    description: 'Freshly prepared egg cooked to order.'
  },
  {
    id: 'extra-rice',
    name: 'Extra Rice (220g Portion)',
    category: 'Sides',
    price: 20,
    description: 'Hot steamed rice (220g portion).'
  },
  {
    id: 'extra-pork-katsu',
    name: 'Extra Pork Katsu Piece (72.8g)',
    category: 'Sides',
    price: 40,
    description: 'Crispy breaded pork katsu cutlet (72.8g).'
  },
  {
    id: 'canes-sauce-drizzle',
    name: "Raising Cane's Dipping Sauce Drizzle",
    category: 'Sides',
    price: 15,
    description: "Signature house Raising Cane's sauce drizzle."
  },
  {
    id: 'canes-sauce-cup',
    name: "Extra Raising Cane's Dipping Sauce Cup (1 oz)",
    category: 'Sides',
    price: 20,
    description: "1 oz cup of Raising Cane's dipping sauce."
  },
  {
    id: 'toyomansi-dip-cup',
    name: 'Extra Toyomansi / Onion Dip Cup',
    category: 'Sides',
    price: 10,
    description: '1 oz cup of toyomansi or savory onion dip.'
  }
];

export const menuItems: MenuItem[] = [
  // --- 1. RICE BOWLS ---
  {
    id: 'pork-sinugba',
    name: 'Pork Sugba Rice Bowl',
    category: 'Rice Bowls',
    price: 109,
    description: 'Grilled pork with rice, a 1 oz cup of toyomansi and 4 cucumber slices, served in a kraft paper bowl.',
    bestSeller: true,
    sortOrder: 1,
    optionGroups: [
      {
        id: 'group_egg_sinugba',
        name: 'Add Egg',
        type: 'single',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'opt_no_egg', name: 'No Egg', price: 0 },
          { id: 'opt_add_egg', name: 'Add Egg', price: 6 }
        ]
      }
    ]
  },
  {
    id: 'pork-sisig',
    name: 'Pork Sisig Rice Bowl',
    category: 'Rice Bowls',
    price: 119,
    description: 'Sizzling savory chopped pork seasoned with calamansi, onions, and creamy dressing over rice.',
    sortOrder: 2,
    optionGroups: [
      {
        id: 'group_egg_sisig',
        name: 'Add Egg',
        type: 'single',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'opt_no_egg', name: 'No Egg', price: 0 },
          { id: 'opt_add_egg', name: 'Add Egg', price: 6 }
        ]
      }
    ]
  },
  {
    id: 'pork-katsu',
    name: 'Pork Katsu Meal',
    category: 'Rice Bowls',
    price: 89,
    description: 'Single piece crispy breaded pork katsu served over hot steamed rice with savory drizzle.',
    sortOrder: 3
  },

  // --- 2. NOODLE BOWLS ---
  {
    id: 'ramen-katsu',
    name: 'Ramen Bowl',
    category: 'Noodle Bowls',
    price: 119,
    description: 'Rich savory soup broth with noodles, fresh scallions, and your choice of egg or katsu toppings.',
    bestSeller: true,
    sortOrder: 4,
    optionGroups: [
      {
        id: 'group_ramen_style',
        name: 'Ramen Style',
        type: 'single',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'plain_ramen', name: 'Plain Ramen', price: 0 },
          { id: 'broth_egg', name: 'Ramen Broth Mixed With Egg', price: 6 }
        ]
      },
      {
        id: 'group_add_egg',
        name: 'Add Egg',
        type: 'single',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'no_egg', name: 'No Egg', price: 0 },
          { id: 'add_egg', name: 'Add Egg', price: 6 }
        ]
      },
      {
        id: 'group_add_katsu',
        name: 'Add Pork Katsu',
        type: 'single',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'no_katsu', name: 'No Pork Katsu', price: 0 },
          { id: 'add_katsu', name: 'Add Pork Katsu', price: 40 }
        ]
      }
    ]
  },
  {
    id: 'buldak',
    name: 'Cheesy Buldak',
    category: 'Noodle Bowls',
    price: 134,
    description: 'Spicy Korean fire noodles tossed in signature hot sauce with melted cheese.',
    sortOrder: 5
  },

  // --- 3. SIDES ---
  {
    id: 'fries',
    name: "Crispy French Fries (Salted w/ Cane's Dip)",
    category: 'Sides',
    price: 59,
    description: "Crispy salted french fries served in our classic kiosk cup with Raising Cane's dipping sauce.",
    sortOrder: 6
  },

  // --- 4. APPAREL (Locked at the bottom) ---
  {
    id: 'hoodie',
    name: 'VEYNS Streetwear Hoodie',
    category: 'Apparel',
    price: 850,
    description: 'Oversized boxy-fit heavy cotton premium streetwear hoodie with custom minimalist print.',
    sortOrder: 99
  }
];

export const MENU_GRID = menuItems;

export const getActivePromoCodes = (): PromoCode[] => {
  try {
    const saved = localStorage.getItem('veyns_promo_codes');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
};

export const getStoredMenuItems = (): MenuItem[] => {
  try {
    const saved = localStorage.getItem('veyns_menu_items');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return menuItems;
};

export const saveStoredMenuItems = (items: MenuItem[]) => {
  try {
    localStorage.setItem('veyns_menu_items', JSON.stringify(items));
  } catch (e) {}
};