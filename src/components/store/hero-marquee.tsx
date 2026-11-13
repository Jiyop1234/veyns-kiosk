// @ts-nocheck
// HeroMarquee — two rows of food photos looping forever, with "Explore menu" in the middle (Step 8).
// Top row moves left to right, bottom row right to left. Pure CSS animation (see home-page.css).
// Step 8A: it sits below the welcome section and only fades in and starts moving once it scrolls into view.
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
                className="relative h-36 w-52 shrink-0 overflow-hidden rounded-2xl bg-[#0d2e26] sm:h-52 sm:w-72"
              >
                {src && (
                  <img
                    src={src}
                    alt=""
                    width={288}
                    height={208}
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

  const list = photos ?? [];
  // The bottom row starts halfway through the list so the two rows do not show the same dish above each other.
  const top = pick(list, 0);
  const bottom = pick(list, Math.floor(list.length / 2) + PER_ROW);

  return (
    <section
      id="home-hero"
      ref={sectionRef}
      aria-label="Featured dishes"
      className={`relative overflow-hidden bg-[#071F19] py-6 transition-opacity duration-700 motion-reduce:transition-none sm:py-10 ${seen ? 'opacity-100' : 'opacity-0'}`}
    >
      <Row tiles={top} direction="ltr" seconds={70} running={seen} />

      <div className="relative z-10 flex justify-center py-8 sm:py-12">
        {/* Soft dark pool behind the button so it stays readable over the photos. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-44 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(7,31,25,0.95)_25%,transparent_70%)]"
        />
        <button
          type="button"
          onClick={scrollToMenu}
          className="relative rounded-full bg-lime-400 px-10 py-5 font-display text-lg font-bold text-[#03120d] shadow-[0_10px_40px_-10px_rgba(163,230,53,0.6)] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.98] sm:px-14 sm:py-6 sm:text-2xl"
        >
          Explore menu
        </button>
      </div>

      <Row tiles={bottom} direction="rtl" seconds={70} running={seen} />
    </section>
  );
}
