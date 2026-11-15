// @ts-nocheck
// CategoryTabs — the pill-shaped category bar of the menu, with a neon highlight that slides to the chosen category (Step 13).
//
// How the highlight works (a mask / clip window, no extra moving boxes):
//   The bar is drawn twice, exactly on top of each other.
//   1) the bottom copy is the dark bar with white labels (these are the real buttons);
//   2) the top copy is the same bar in neon lime with dark labels, and it is only visible through a rounded window
//      (clip-path) that is exactly the size of the chosen category.
//   When another category is chosen, the window slides and resizes to it (styles in menu-page.css).
//   Every letter changes color exactly as the neon edge passes over it, because it is the same text seen through the moving window.
// 'Extras' is an action button (it opens the Extras page), so the window never lands on it.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type CategoryTab = { key: string; label: string; kind?: 'filter' | 'action' };

// The same classes on both copies, so the two layers line up letter for letter.
const LABEL = 'px-4 py-2 text-xs font-semibold tracking-tight whitespace-nowrap sm:px-5 sm:text-sm';

export function CategoryTabs({ tabs, active, onSelect, onAction }: { tabs: CategoryTab[]; active: string; onSelect: (key: string) => void; onAction?: (key: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // The window, as distances from the left and right edge of the bar (px). null until measured.
  const [win, setWin] = useState<{ left: number; right: number } | null>(null);
  // false for the very first measurement, so the window does not slide in from nowhere on load.
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const row = rowRef.current;
    const btn = btnRefs.current[active];
    if (!row || !btn) return;
    const rr = row.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const left = br.left - rr.left;
    const right = rr.right - br.right;
    setWin((w) => (w && Math.abs(w.left - left) < 0.5 && Math.abs(w.right - right) < 0.5 ? w : { left, right }));
  }, [active]);

  useLayoutEffect(() => { measure(); }, [measure, tabs.length]);

  // Re-measure when the bar changes size (window resize, web font finished loading).
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(row);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => measure());
    return () => ro && ro.disconnect();
  }, [measure]);

  useEffect(() => {
    if (!win || ready) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [win, ready]);

  // On a narrow screen the bar scrolls sideways: bring the chosen category to the middle.
  useEffect(() => {
    if (!ready) return;
    const sc = scrollRef.current;
    const btn = btnRefs.current[active];
    if (!sc || !btn || sc.scrollWidth <= sc.clientWidth) return;
    const sr = sc.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const delta = br.left + br.width / 2 - (sr.left + sr.width / 2);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sc.scrollBy({ left: delta, behavior: reduce ? 'auto' : 'smooth' });
  }, [active, ready]);

  const clip = win ? `inset(0px ${win.right}px 0px ${win.left}px round 9999px)` : undefined;

  return (
    <div ref={scrollRef} className="veyns-tabs-scroll w-fit max-w-full overflow-x-auto rounded-full border border-emerald-900/50 bg-[#071F19] p-1">
      <div ref={rowRef} className="relative inline-flex">
        {/* Bottom copy: the real, clickable buttons (white labels). */}
        <div className="flex" role="group" aria-label="Menu categories">
          {tabs.map((t) => (
            <button
              key={t.key}
              ref={(el) => { btnRefs.current[t.key] = el; }}
              type="button"
              onClick={() => (t.kind === 'action' ? onAction && onAction(t.key) : onSelect(t.key))}
              aria-pressed={t.kind === 'action' ? undefined : active === t.key}
              className={`${LABEL} cursor-pointer rounded-full text-white transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Top copy: neon with dark labels, seen only through the sliding window. It cannot be clicked or read out loud. */}
        <div
          aria-hidden="true"
          className="veyns-tabs-lit pointer-events-none absolute inset-0 flex bg-lime-400 text-[#03120d]"
          style={win ? { clipPath: clip, WebkitClipPath: clip, transition: ready ? undefined : 'none' } : { visibility: 'hidden' }}
        >
          {tabs.map((t) => (
            <span key={t.key} className={LABEL}>{t.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
