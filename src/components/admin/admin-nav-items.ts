// Admin navigation: the 10 labels in display order, with their tab id and icon.
// Part B, Step B1a. The tab id of each label is the id the dashboard switches on. Step B12 adds Inventory.
import { LayoutDashboard, BarChart2, Wallet, ShoppingBag, Users, MessageSquare, Clock, Ticket, Tag, Truck, Package } from 'lucide-react';

export type AdminTabId =
  | 'overview'
  | 'sales'
  | 'ledger'
  | 'process'
  | 'customers'
  | 'feedback'
  | 'inventory'
  | 'slots'
  | 'promos'
  | 'menu'
  | 'fees';

// countKey: the key of the number shown next to the label (see AdminSidebar `counts`).
export const ADMIN_NAV_ITEMS: { id: AdminTabId; label: string; icon: any; countKey?: string }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'sales', label: 'Sales Analytics', icon: BarChart2, countKey: 'sales' },
  { id: 'ledger', label: 'Ledger', icon: Wallet },
  { id: 'process', label: 'Orders & POS', icon: ShoppingBag },
  { id: 'customers', label: 'Users', icon: Users, countKey: 'customers' },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'slots', label: 'Slot Capacity', icon: Clock },
  { id: 'promos', label: 'Vouchers', icon: Ticket, countKey: 'promos' },
  { id: 'menu', label: 'Menu Manager', icon: Tag, countKey: 'menu' },
  { id: 'fees', label: 'Delivery Fees', icon: Truck },
];
