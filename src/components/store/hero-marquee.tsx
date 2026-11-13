// @ts-nocheck
// HeroMarquee — two rows of food photos looping forever, with "Explore menu" in the middle (Step 8).
// Top row moves left to right, bottom row right to left. Pure CSS animation (see home-page.css).
// Step 8A: it sits below the welcome section and only fades in and starts moving once it scrolls into view.
// Step 8D: tall portrait tiles packed tightly, the button sits on the seam between the two rows, soft fade at both edges.
// Step 9A: a centered heading block above the rows, and the button is now see-through glass that lights up lime when touched.
// Step 9B: the button is small, rectangular, all capitals, and almost fully see-through; the dark pool behind it is gone so the photos show through.
// Step 9C: the section fills exactly one screen (minus the header) and snaps into place; tile size follows the screen height (see home-page.css).
// Step 9D/9E: the heading block (title, divider, paragraph) fades in and rises each time it scrolls into view (no blur).
// Photos come from menu_items.image_url, falling back to the bundled images in lib/menu-images.ts.
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { menuImages } from '@/lib/menu-images';

const PER_ROW = 10;

// Pick PER_ROW photos starting at `start`, repeating the list when there are fewer photos than tiles.
function pick(photos: string[], start: number): (string | null)[] {
  if (photos.length === 0) return Array.from({ length: PER_ROW }, () => null);
  return Array.from({ length: PER_ROW }, (_, i) => photos[(start + i) % photos.length]);
}

function scrollToMenu() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('menu')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

function Row({ tiles, direction, seconds, running }: { tiles: (string | null)[]; direction: 'ltr' | 'rtl'; seconds: number; running: boolean }) {
  return (
    <div className="veyns-marquee" aria-hidden="true">
      <div
        className={`veyns-marquee-track ${direction === 'ltr' ? 'veyns-marquee-ltr' : 'veyns-marquee-rtl'}`}
        style={{ ['--marquee-duration' as any]: `${seconds}s`, animationPlayState: running ? 'running' : 'paused' }}
      >
        {/* Two identical groups: the track slides by exactly one group, then starts over. */}
        {[0, 1].map((copy) => (
          <div className="veyns-marquee-group" key={copy}>
            {tiles.map((src, i) => (
              <div
                key={i}
                className="veyns-tile relative shrink-0 overflow-hidden rounded-lg bg-[#0d2e26]"
              >
                {src && (
                  <img
                    src={src}
                    alt=""
                    width={240}
                    height={288}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#03120d]/70 via-[#03120d]/20 to-[#03120d]/30" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroMarquee() {
  // null = still loading (dark placeholder tiles); an array = ready (possibly the bundled fallback).
  const [photos, setPhotos] = useState<string[] | null>(null);
  // false until the hero scrolls into view; then the rows fade in and start moving.
  const sectionRef = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  // Heading block: true while it is on screen, so the fade-in and rise plays again on every visit.
  const headingRef = useRef<HTMLDivElement>(null);
  const [headingIn, setHeadingIn] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    // No animation for people who ask for less motion, or in browsers without IntersectionObserver.
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setHeadingIn(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.5) setHeadingIn(true); // half of it is on screen: play
        else if (entry.intersectionRatio < 0.25) setHeadingIn(false); // mostly gone: get ready to play again
      },
      { threshold: [0, 0.25, 0.5] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let live = true;
    const fallback = () => Array.from(new Set(Object.values(menuImages)));

    (async () => {
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .select('id, image_url, is_available, is_extra, category, sort_order')
          .order('sort_order', { ascending: true });
        if (error || !data) throw error || new Error('no menu data');

        const srcs = data
          .filter((m: any) => m.is_available !== false && !m.is_extra && m.category !== 'Apparel')
          .map((m: any) => m.image_url || menuImages[m.id])
          .filter(Boolean);
        const unique = Array.from(new Set(srcs)) as string[];
        if (live) setPhotos(unique.length > 0 ? unique : fallback());
      } catch (e) {
        if (live) setPhotos(fallback());
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  // Transparent and 24px low at rest; opaque and in place when visible. Each piece starts a little later.
  const reveal = (delayMs: number) => ({
    className: `transition-[opacity,transform] duration-1000 ease-out ${headingIn ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`,
    style: { transitionDelay: headingIn ? `${delayMs}ms` : '0ms' },
  });

  const list = photos ?? [];
  // The bottom row starts halfway through the list so the two rows do not show the same dish above each other.
  const top = pick(list, 0);
  const bottom = pick(list, Math.floor(list.length / 2) + PER_ROW);

  return (
    <section
      id="home-hero"
      ref={sectionRef}
      aria-label="Featured dishes"
      className={`veyns-fullscreen veyns-hero relative overflow-hidden bg-[#03120d] py-4 transition-opacity duration-700 motion-reduce:transition-none sm:py-6 ${seen ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Heading block above the photos: spaced capitals, a thin divider and one short paragraph. */}
      <div ref={headingRef} className="mx-auto max-w-3xl px-6 pb-8 pt-6 text-center sm:pb-12 sm:pt-10">
        <h2
          className={`font-serif text-xl font-light uppercase tracking-[0.2em] text-white sm:text-4xl sm:tracking-[0.3em] ${reveal(0).className}`}
          style={reveal(0).style}
        >
          A unique experience
        </h2>
        <div
          aria-hidden="true"
          className={`mx-auto mt-4 h-px w-16 bg-white/40 ${reveal(200).className}`}
          style={reveal(200).style}
        />
        <p
          className={`mx-auto mt-4 max-w-xl text-xs leading-relaxed text-emerald-100/70 sm:text-sm ${reveal(400).className}`}
          style={reveal(400).style}
        >
          Rice and noodle bowls made fresh for every order. Pick a favorite, make it yours, and taste the care in every bite.
        </p>
      </div>

      {/* The two rows sit almost touching; the button is centered on the seam between them. */}
      <div className="relative flex flex-col gap-2 sm:gap-2.5">
        <Row tiles={top} direction="ltr" seconds={60} running={seen} />
        <Row tiles={bottom} direction="rtl" seconds={60} running={seen} />

        {/* Soft fade at both edges. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-12 bg-gradient-to-r from-[#03120d] to-transparent sm:w-32"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-12 bg-gradient-to-l from-[#03120d] to-transparent sm:w-32"
        />

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <button
            type="button"
            onClick={scrollToMenu}
            className="veyns-glass-btn pointer-events-auto relative rounded-sm px-6 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.25em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-8 sm:py-3 sm:text-sm"
          >
            Explore menu
          </button>
        </div>
      </div>
    </section>
  );
}
