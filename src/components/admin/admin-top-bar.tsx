// VEYNS Admin: the top bar of the dashboard (Step B10b).
// Tablet and desktop only (768 px and up): the VEYNS name on the left and a greeting centered on the screen.
// The greeting is checked again every minute, so it changes by itself when the page stays open past 12:00 or 18:00.
// On phones the fixed top bar of the sidebar is used instead, so this one is hidden there.

import { useEffect, useState } from 'react';
import { adminGreeting } from '@/components/admin/admin-greeting';

export function AdminTopBar() {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="hidden h-16 grid-cols-[1fr_auto_1fr] items-center px-8 md:grid">
      <span className="font-display text-2xl font-extrabold tracking-tight text-white">VEYNS.</span>
      <p className="font-display text-2xl font-extrabold text-white">{adminGreeting(now)}</p>
      <span aria-hidden="true" />
    </header>
  );
}
