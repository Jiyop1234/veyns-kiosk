// @ts-nocheck
// ThankYouSection (Step 11) — the last screen of the store, shown after the menu and above the site footer.
// Same look as the welcome screen ('Hi, [nickname]!'): one full screen, centered text on the plain page background.
// The text fades in from the middle and floats up when it is about half on screen, and plays again on every visit.
// 'Reduce motion' on (or no IntersectionObserver): no animation, the text is simply shown.
import React, { useEffect, useRef, useState } from 'react';

export function ThankYouSection() {
  const textRef = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.5) setShown(true);
        else if (entry.intersectionRatio < 0.25) setShown(false);
      },
      { threshold: [0, 0.25, 0.5] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section aria-label='Thank you' className='veyns-fullscreen items-center px-6 text-center'>
      <div
        ref={textRef}
        className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
          shown ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <h2 className='font-display text-4xl font-bold tracking-tight text-white sm:text-6xl'>
          Thank you for supporting VEYNS.
        </h2>
        <p className='mt-3 flex items-center justify-center gap-2 text-xl text-lime-400 sm:text-2xl'>
          <span>Made with love</span>
          {/* Drawn heart (not an emoji) so it looks the same on every phone and computer. */}
          <svg aria-hidden='true' viewBox='0 0 24 24' className='h-6 w-6 text-red-400 sm:h-7 sm:w-7' fill='currentColor'>
            <path d='M12 21s-7.5-4.6-9.6-9.2C.9 8.3 2.8 4.5 6.5 4.5c2.1 0 3.8 1.2 5.5 3.2 1.7-2 3.4-3.2 5.5-3.2 3.7 0 5.6 3.8 4.1 7.3C19.5 16.4 12 21 12 21z' />
          </svg>
        </p>
      </div>
    </section>
  );
}
