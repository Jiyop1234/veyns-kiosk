// @ts-nocheck
// WelcomeSection — the first screen of the store (Step 8A, replaces welcome-modal.tsx).
// 'Hi, [nickname]!' and 'Welcome back.' on the plain page background. It stays on the page (no timer,
// no box). The hero image marquee sits below it and only shows once the customer scrolls down.
// Step 8E: a see-through, shining 'Scroll down' text sits above the arrow (styles in home-page.css).
// Step 8F: the section is exactly one screen minus the header (no scrolling to see 'Scroll down'), and the arrow shines instead of bouncing.
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const NAME_WAIT_MS = 1500;

export function WelcomeSection({ currentUser }: { currentUser?: any }) {
  const isGuest = !currentUser || currentUser.type === 'guest';
  const [name, setName] = useState('Foodie');
  const [ready, setReady] = useState(isGuest);

  // The nickname is profiles.name (own row only; the 'Users read own profile' policy allows it).
  useEffect(() => {
    if (isGuest) {
      setName('Foodie');
      setReady(true);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => live && setReady(true), NAME_WAIT_MS);
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return;
        const { data } = await supabase.from('profiles').select('name').eq('auth_user_id', userId).maybeSingle();
        const found = data?.name;
        if (live && typeof found === 'string' && found.trim()) setName(found.trim());
      } catch {
        /* keep the fallback */
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [isGuest, currentUser]);

  const scrollDown = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('home-hero')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <section aria-label='Welcome' className='veyns-welcome relative flex flex-col items-center justify-center px-6 text-center'>
      {/* Fades in from the middle and floats up once, then stays. */}
      <div
        className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
          ready ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <h1 className='font-display text-5xl font-bold tracking-tight text-white sm:text-7xl'>Hi, {name}!</h1>
        <p className='mt-3 text-xl text-lime-400 sm:text-2xl'>{isGuest ? 'Welcome to VEYNS.' : 'Welcome back.'}</p>
      </div>

      <button
        type='button'
        onClick={scrollDown}
        aria-label='Scroll down to the menu'
        className='absolute bottom-6 flex flex-col items-center gap-1 text-emerald-300/70 transition-colors hover:text-lime-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'
      >
        <span className='veyns-shine-text text-sm font-semibold uppercase tracking-[0.3em] sm:text-base'>Scroll down</span>
        <span aria-hidden='true' className='veyns-shine-arrow' />
      </button>
    </section>
  );
}
