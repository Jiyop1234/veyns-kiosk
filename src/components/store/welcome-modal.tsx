// @ts-nocheck
// WelcomeModal — "Hi, [nickname]!" for 3 seconds after a real sign-in (Step 8).
// Never blocks the page: the full-screen layer is transparent and ignores clicks.
//
// Why the listener lives at module level: the sign-in event (SIGNED_IN) fires while the login
// screen is still showing, BEFORE the store (and this component) is on screen. A listener created
// inside the component would miss it. This file is imported when the app starts, so the listener
// is already waiting; the component picks the event up when it mounts.
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const SHOWN_KEY = 'veyns_welcome_shown_for';
const VISIBLE_MS = 3000;
const LEAVE_MS = 500;
const PENDING_MAX_AGE_MS = 60_000;
const FRESH_SIGN_IN_MS = 5 * 60_000;

let pending: { userId: string; at: number } | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined' && !(window as any).__veynsWelcomeListener) {
  (window as any).__veynsWelcomeListener = true;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      pending = null;
      sessionStorage.removeItem(SHOWN_KEY);
      return;
    }
    if (event !== 'SIGNED_IN' || !session?.user) return;

    const user = session.user;
    // supabase-js can repeat SIGNED_IN (tab regains focus, page reload). Greet once per sign-in.
    if (sessionStorage.getItem(SHOWN_KEY) === user.id) return;
    // A real sign-in just happened; a repeat for an old session did not.
    const signedInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN;
    if (!Number.isNaN(signedInAt) && Math.abs(Date.now() - signedInAt) > FRESH_SIGN_IN_MS) return;

    pending = { userId: user.id, at: Date.now() };
    // Never call supabase from inside this callback (it can deadlock auth): hand off to a timer.
    window.setTimeout(() => listeners.forEach((fn) => fn()), 0);
  });
}

type Phase = 'enter' | 'visible' | 'leave';

export function WelcomeModal() {
  const [name, setName] = useState('Foodie');
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('enter');

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const tryShow = async () => {
      if (!pending) return;
      if (Date.now() - pending.at > PENDING_MAX_AGE_MS) {
        pending = null;
        return;
      }
      const userId = pending.userId;

      // The nickname is profiles.name (own row only; the "Users read own profile" policy allows it).
      let nickname = 'Foodie';
      try {
        const lookup = supabase.from('profiles').select('name').eq('auth_user_id', userId).maybeSingle();
        const result: any = await Promise.race([
          lookup,
          new Promise((resolve) => window.setTimeout(() => resolve(null), 1500)),
        ]);
        const found = result?.data?.name;
        if (typeof found === 'string' && found.trim()) nickname = found.trim();
      } catch {
        /* keep the fallback */
      }

      // Only consume the event if this effect is still alive (React StrictMode mounts twice in dev).
      if (cancelled || !pending || pending.userId !== userId) return;
      pending = null;
      sessionStorage.setItem(SHOWN_KEY, userId);

      setName(nickname);
      setPhase('enter');
      setMounted(true);
      later(() => setPhase('visible'), 30);
      later(() => setPhase('leave'), 30 + VISIBLE_MS);
      later(() => setMounted(false), 30 + VISIBLE_MS + LEAVE_MS);
    };

    tryShow(); // the sign-in may already have happened before the store mounted
    listeners.add(tryShow);
    return () => {
      cancelled = true;
      listeners.delete(tryShow);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  if (!mounted) return null;

  const motion =
    phase === 'enter'
      ? 'opacity-0 translate-y-10'
      : phase === 'visible'
        ? 'opacity-100 translate-y-0'
        : 'opacity-0 -translate-y-6';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center px-6"
      role="status"
      aria-live="polite"
    >
      <div
        className={`rounded-3xl border border-emerald-800/60 bg-[#03120d]/80 px-10 py-8 text-center shadow-2xl backdrop-blur-md transition-all duration-500 ease-out motion-reduce:transition-none ${motion}`}
      >
        <p className="font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">Hi, {name}!</p>
        <p className="mt-2 text-lg text-lime-400 sm:text-xl">Welcome back.</p>
      </div>
    </div>
  );
}
