// VEYNS Admin: tells the dashboard when a screen can use the whole window without a page scroll (Steps B10b, B2a2, B3a, B4 and B4b).
// True only on a large screen: wide and tall enough for the panels of that screen ('ledger', 'orders', 'users' or 'slots').
// The width needed depends on the navigation pill: the expanded pill takes 192 px more from the page.
// On smaller screens it is false and the page scrolls as before.

import { useEffect, useState } from 'react';

export const ADMIN_FIT_MIN_WIDTH_COLLAPSED = 1600;
export const ADMIN_FIT_MIN_WIDTH_EXPANDED = 1792;
export const ADMIN_FIT_MIN_HEIGHT = 840;

// Orders & POS (Step B2a2): three columns, so it needs less height but enough width for the middle column.
export const ADMIN_FIT_ORDERS_MIN_WIDTH_COLLAPSED = 1440;
export const ADMIN_FIT_ORDERS_MIN_WIDTH_EXPANDED = 1632;
export const ADMIN_FIT_ORDERS_MIN_HEIGHT = 680;
// Orders & POS with its Order Transactions table in the same no-scroll window (Step B2b): needs more height.
export const ADMIN_FIT_ORDERS_TABLE_MIN_HEIGHT = 850;

// Users (Step B3a): stat cards and a table that scrolls inside its card; same widths as Orders & POS.
export const ADMIN_FIT_USERS_MIN_HEIGHT = 700;

// Slot Capacity (Step B4, B4b): stat cards, a list of slots that scrolls inside its card, and the Global Actions bar; same widths as Orders & POS.
export const ADMIN_FIT_SLOTS_MIN_HEIGHT = 800;

export type AdminFitKind = 'ledger' | 'orders' | 'orders-table' | 'users' | 'slots';

export function useAdminFitScreen(navExpanded: boolean, kind: AdminFitKind = 'ledger'): boolean {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const orders = kind !== 'ledger';
  const minWidth = orders
    ? (navExpanded ? ADMIN_FIT_ORDERS_MIN_WIDTH_EXPANDED : ADMIN_FIT_ORDERS_MIN_WIDTH_COLLAPSED)
    : (navExpanded ? ADMIN_FIT_MIN_WIDTH_EXPANDED : ADMIN_FIT_MIN_WIDTH_COLLAPSED);
  const minHeight = kind === 'orders-table' ? ADMIN_FIT_ORDERS_TABLE_MIN_HEIGHT : kind === 'users' ? ADMIN_FIT_USERS_MIN_HEIGHT : kind === 'slots' ? ADMIN_FIT_SLOTS_MIN_HEIGHT : orders ? ADMIN_FIT_ORDERS_MIN_HEIGHT : ADMIN_FIT_MIN_HEIGHT;
  return size.width >= minWidth && size.height >= minHeight;
}
