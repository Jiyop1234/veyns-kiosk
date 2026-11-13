// @ts-nocheck
// TestimonialsMarquee — a slowly switching coverflow of 5-star customer reviews (Step 9, redesigned in Step 9F).
// Reads the latest published 5-star posts from feedback_posts (same table and 'published' rule as the Feedback page).
// No database change: anon visitors can already read these columns (RLS policy "feedback_posts public read").
// Hidden completely when there are no published 5-star reviews or the request fails.
// Step 9C: the section fills exactly one screen (minus the header) and snaps into place.
// Step 9F: one sharp card in the center, blurred cards on both sides; a card clears as it reaches the center.
//          Only rating = 5 is shown. No CSS file change: all styling is Tailwind classes and inline styles.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Stars } from '@/lib/feedback';

const MAX_REVIEWS = 12;      // newest published 5-star reviews used by the carousel
const MIN_CARDS = 5;         // fewer reviews than this are repeated so the left/center/right cards always exist
const MAX_CHARS = 220;       // long comments are cut here (the full text stays on the Feedback page)
const AUTOPLAY_MS = 5000;    // time between automatic switches
const SLIDE_MS = 1100;       // length of the slide + blur-to-sharp transition

// Cut a comment at about MAX_CHARS, at a word boundary when there is one, and add an ellipsis.
function shorten(text: string): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_CHARS) return t;
  const cut = t.slice(0, MAX_CHARS);
  const space = cut.lastIndexOf(' ');
  return (space > 120 ? cut.slice(0, space) : cut).trimEnd() + '…';
}

// Small helper: does the visitor's device match this media query? (false where matchMedia is missing)
function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, [query]);
  return matches;
}

function ReviewCard({ review, d, compact, reduce, onPick }: any) {
  const name = review.is_guest ? 'Guest' : review.display_name || 'Customer';
  const width = compact ? 250 : 340;
  const height = compact ? 310 : 330;
  const step = compact ? 215 : 350;
  const abs = Math.abs(d);
  const isCenter = d === 0;
  const isNear = abs === 1;

  // Center: full size, sharp. Neighbors: smaller, blurred, dimmer. Everything further out waits invisible.
  const scale = isCenter ? 1 : isNear ? 0.84 : 0.7;
  const blur = isCenter ? 0 : isNear ? 6 : 10;
  const opacity = isCenter ? 1 : isNear ? 0.6 : 0;
  const transition = reduce
    ? 'none'
    : `transform ${SLIDE_MS}ms cubic-bezier(0.45, 0, 0.2, 1), filter ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease`;

  return (
    <article
      aria-hidden={isCenter ? undefined : 'true'}
      onClick={onPick}
      className={`absolute left-1/2 top-1/2 flex flex-col overflow-hidden rounded-3xl border border-white/15 p-5 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] sm:p-6 ${
        isNear ? 'cursor-pointer' : ''
      }`}
      style={{
        width,
        height,
        background: 'linear-gradient(170deg, #5f9283 0%, #36645a 38%, #123027 72%, #0a1c16 100%)',
        transform: `translate(-50%, -50%) translateX(${d * step}px) scale(${scale})`,
        filter: `blur(${blur}px)`,
        opacity,
        zIndex: isCenter ? 30 : isNear ? 20 : 10,
        pointerEvents: abs > 1 ? 'none' : 'auto',
        transition,
        willChange: 'transform, filter, opacity',
      }}
    >
      {/* Big faded quote mark in the corner. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 right-3 select-none font-serif text-[11rem] leading-none text-white/[0.07]"
      >
        {'\u201D'}
      </span>

      <div className="relative flex items-center gap-3">
        <span
          aria-hidden="true"
          className="select-none font-serif text-6xl leading-[0.6] text-white/35"
          style={{ marginTop: '0.35rem' }}
        >
          {'\u201C'}
        </span>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-[#0d2e26] text-base font-extrabold text-[#d4af37]">
          {name[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white sm:text-base">{name}</p>
          <p className="truncate text-xs text-emerald-100/70">VEYNS customer</p>
        </div>
      </div>

      <p className="relative mt-5 flex-1 overflow-hidden break-words text-sm leading-relaxed text-white/95 sm:text-[15px]">
        {shorten(review.comment)}
      </p>

      <div className="relative mt-3">
        <Stars value={5} size={18} />
      </div>
    </article>
  );
}

export function TestimonialsMarquee() {
  // null = still loading; [] = nothing to show (section stays hidden).
  const [reviews, setReviews] = useState<any[] | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const compact = useMedia('(max-width: 639px)');
  const reduce = useMedia('(prefers-reduced-motion: reduce)');

  // Swipe / tap bookkeeping (refs so they never cause a re-render).
  const startX = useRef<number | null>(null);
  const dragged = useRef(false);
  const resumeTimer = useRef<any>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('feedback_posts')
          .select('id, display_name, is_guest, rating, comment, created_at')
          .eq('status', 'published')
          .eq('rating', 5)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(MAX_REVIEWS);
        if (error) throw error;
        if (live) setReviews(data || []);
      } catch (e) {
        if (live) setReviews([]);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  // Fade in and start switching only when the section scrolls into view (same idea as the hero).
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
  }, [reviews]);

  // Repeat a short list so there is always a left, a center and a right card.
  const cards = useMemo(() => {
    if (!reviews || reviews.length === 0) return [];
    const reps = Math.ceil(MIN_CARDS / reviews.length);
    return Array.from({ length: reps }, () => reviews).flat();
  }, [reviews]);
  const n = cards.length;

  // Automatic slow switching. Off for "Reduce motion", while paused, and in a hidden browser tab.
  useEffect(() => {
    if (!seen || paused || reduce || n < 2) return;
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setActive((a) => (a + 1) % n);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [seen, paused, reduce, n]);

  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  if (!reviews || reviews.length === 0) return null;

  const go = (dir: number) => setActive((a) => (a + dir + n) % n);

  // Signed distance of card i from the active one, wrapped so the row loops: -2 .. 2 for 5 cards.
  const offsetOf = (i: number) => {
    let d = (((i - active) % n) + n) % n;
    if (d > n / 2) d -= n;
    return d;
  };

  const onPointerDown = (e: any) => {
    startX.current = e.clientX;
    dragged.current = false;
    if (e.pointerType !== 'mouse') {
      clearTimeout(resumeTimer.current);
      setPaused(true);
    }
  };
  const finishPointer = (e: any, clientX: number | null) => {
    if (startX.current != null && clientX != null) {
      const dx = clientX - startX.current;
      if (Math.abs(dx) > 40) {
        dragged.current = true;
        go(dx < 0 ? 1 : -1);
      }
    }
    startX.current = null;
    if (e.pointerType !== 'mouse') {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => setPaused(false), 4000);
    }
  };

  const dotsActive = active % reviews.length;

  return (
    <section
      id="home-reviews"
      ref={sectionRef}
      aria-label="Customer reviews"
      className={`veyns-fullscreen relative overflow-hidden bg-[#03120d] py-10 transition-opacity duration-700 motion-reduce:transition-none sm:py-14 ${seen ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="mx-auto mb-4 max-w-6xl px-4 text-center sm:mb-6">
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">What our customers say</h2>
        <p className="mt-1 text-sm text-emerald-300/70">Real reviews from VEYNS customers</p>
      </div>

      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="5-star customer reviews"
        tabIndex={0}
        className="relative mx-auto w-full max-w-6xl outline-none focus-visible:ring-2 focus-visible:ring-lime-400/60"
        style={{ height: compact ? 350 : 380, touchAction: 'pan-y' }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1);
          if (e.key === 'ArrowLeft') go(-1);
        }}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setPaused(false)}
        onPointerDown={onPointerDown}
        onPointerUp={(e) => finishPointer(e, e.clientX)}
        onPointerCancel={(e) => finishPointer(e, null)}
      >
        {cards.map((r, i) => {
          const d = offsetOf(i);
          return (
            <ReviewCard
              key={`${r.id}-${i}`}
              review={r}
              d={d}
              compact={compact}
              reduce={reduce}
              onPick={() => {
                if (dragged.current) {
                  dragged.current = false;
                  return;
                }
                if (d !== 0) setActive(i);
              }}
            />
          );
        })}
      </div>

      {reviews.length > 1 && (
        <div className="mt-2 flex justify-center gap-2" role="group" aria-label="Choose a review">
          {reviews.map((r, k) => (
            <button
              key={r.id}
              type="button"
              aria-label={`Show review ${k + 1} of ${reviews.length}`}
              aria-current={k === dotsActive ? 'true' : undefined}
              onClick={() => setActive(k)}
              className={`h-2 rounded-full transition-all duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400 ${
                k === dotsActive ? 'w-6 bg-[#d4af37]' : 'w-2 bg-emerald-700/50 hover:bg-emerald-500/60'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
