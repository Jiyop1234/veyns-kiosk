// VEYNS Admin: tells the dashboard when a screen can use the whole window without a page scroll (Step B10b).
// True only on a large screen: wide enough for the 3-column Ledger and tall enough for its panels.
// The width needed depends on the navigation pill: the expanded pill takes 192 px more from the page.
// On smaller screens it is false and the page scrolls as before.

import { useEffect, useState } from 'react';

export const ADMIN_FIT_MIN_WIDTH_COLLAPSED = 1600;
export const ADMIN_FIT_MIN_WIDTH_EXPANDED = 1792;
export const ADMIN_FIT_MIN_HEIGHT = 840;

export function useAdminFitScreen(navExpanded: boolean): boolean {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const minWidth = navExpanded ? ADMIN_FIT_MIN_WIDTH_EXPANDED : ADMIN_FIT_MIN_WIDTH_COLLAPSED;
  return size.width >= minWidth && size.height >= ADMIN_FIT_MIN_HEIGHT;
}
