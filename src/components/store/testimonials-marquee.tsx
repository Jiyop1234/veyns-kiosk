// @ts-nocheck
// TestimonialsMarquee — a continuously, slowly moving coverflow of 5-star customer reviews (Step 9, redesigned in Step 9F, made continuous in Step 9G).
// Reads the latest published 5-star posts from feedback_posts (same table and 'published' rule as the Feedback page).
// No database change: anon visitors can already read these columns (RLS policy "feedback_posts public read").
// Hidden completely when there are no published 5-star reviews or the request fails.
// Step 9C: the section fills exactly one screen (minus the header) and snaps into place.
// Step 9F: one sharp card in the center, blurred cards on both sides; a card clears as it reaches the center.
//          Only rating = 5 is shown. No CSS file change: all styling is Tailwind classes and inline styles.
// Step 9G: no more "wait 5 s, then jump to the next card". The row now drifts left continuously at a slow, steady speed
//          and loops forever. Size, blur and brightness are calculated every frame from each card's distance to the
//          center, so a card sharpens smoothly while it travels to the middle. Clicks, dots, arrows and swipes glide
//          to the chosen card, then the drift carries on. Pause on hover / touch is kept (it eases to a stop and back).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Stars } from '@/lib/feedback';

const MAX_REVIEWS = 12;          // newest published 5-star reviews used by the carousel
const MIN_CARDS = 5;             // fewer reviews than this are repeated so the left/center/right cards always exist
const MAX_CHARS = 220;           // long comments are cut here (the full text stays on the Feedback page)
const DRIFT_MS_PER_CARD = 4500;  // SPEED: time the row takes to move by one card. Bigger = slower, smaller = faster.
const GLIDE_MS = 450;            // how quickly a click / dot / arrow / swipe glides to its card (smaller = snappier)
const EASE_MS = 350;             // how quickly the drift eases to a stop when paused and back up when resumed

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

// Position, size, blur and brightness of one card for a signed distance d from the center (in cards, can be a fraction).
// Center: full size and perfectly sharp. As a card travels in, it clears up slowly; as it travels out, it blurs slowly.
// Everything is blended with a smooth S-curve (smoothstep) so there is no sudden change anywhere, and there is a small
// "dead zone" around the center where the card stays completely sharp.
const SHARP_ZONE = 0.12;  // cards: how far from the center a card is still 100% sharp
const MAX_BLUR = 8;       // px of blur on cards two positions away (about half of that at one position away)
function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
function cardLook(d: number, step: number) {
  const abs = Math.abs(d);
  const s = smooth((abs - SHARP_ZONE) / (2 - SHARP_ZONE)); // 0 at the center, 1 two cards away
  const scale = 1 - 0.3 * s;                                // 1 at the center, 0.85 one away, 0.7 two away
  const blur = MAX_BLUR * s;
  const opacity = abs <= 1 ? 1 - 0.4 * smooth((abs - SHARP_ZONE) / (1 - SHARP_ZONE)) : Math.max(0, 0.6 * (2 - abs));
  return { abs, scale, blur, opacity, x: d * step };
}

// Static look of a card. Position, scale, blur and opacity are written straight onto the element by the animation
// loop below (so React does not re-render 60 times a second); that is why none of them appear in this style object.
function ReviewCard({ review, compact, setEl, onPick }: any) {
  const name = review.is_guest ? 'Guest' : review.display_name || 'Customer';
  const width = compact ? 250 : 340;
  const height = compact ? 310 : 330;

  return (
    <article
      ref={setEl}
      onClick={onPick}
      className="absolute left-1/2 top-1/2 flex flex-col overflow-hidden rounded-3xl border border-white/15 p-5 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] sm:p-6"
      style={{
        width,
        height,
        background: 'linear-gradient(170deg, #5f9283 0%, #36645a 38%, #123027 72%, #0a1c16 100%)',
        willChange: 'transform, filter, opacity',
        visibility: 'hidden', // shown by the animation loop as soon as it has placed the card
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
  const [active, setActive] = useState(0); // index of the card nearest the center (only used for the dots)
  const compact = useMedia('(max-width: 639px)');
  const reduce = useMedia('(prefers-reduced-motion: reduce)');

  // Animation state lives in refs so moving the cards never causes a React re-render.
  const posRef = useRef(0);            // which card is at the center, as a fraction (2.5 = halfway between card 2 and 3)
  const targetRef = useRef<number | null>(null); // where a click / swipe is gliding to (null = just drifting)
  const speedRef = useRef(1);          // 0 = stopped, 1 = full drift speed (eased)
  const pausedRef = useRef(false);     // hover / touch pause
  const onScreenRef = useRef(false);   // true while the section is on screen
  const lastActiveRef = useRef(0);
  const cardEls = useRef<any[]>([]);
  const rafRef = useRef<number | null>(null);

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

  // Fade in the first time the section is on screen; keep tracking whether it is on screen so the drift only runs then.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      onScreenRef.current = true;
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreenRef.current = entry.isIntersecting;
        if (entry.isIntersecting) setSeen(true);
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

  // The animation loop: places every card each frame and, unless paused, moves the row slowly and steadily.
  useEffect(() => {
    if (n === 0) return;
    const step = compact ? 215 : 350;

    // Write the position, scale, blur and brightness of every card for the current center position.
    const place = () => {
      const pos = posRef.current;
      for (let i = 0; i < n; i++) {
        const el = cardEls.current[i];
        if (!el) continue;
        // Signed distance from the center, wrapped so the row loops. The wrap point is half the row away,
        // where cards are invisible, so nothing visibly jumps.
        let d = (((i - pos) % n) + n) % n;
        if (d > n / 2) d -= n;
        const { abs, scale, blur, opacity, x } = cardLook(d, step);
        if (opacity <= 0.005) {
          if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
          continue;
        }
        el.style.visibility = 'visible';
        el.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(2)}px) scale(${scale.toFixed(4)})`;
        el.style.filter = blur < 0.05 ? 'none' : `blur(${blur.toFixed(2)}px)`;
        el.style.opacity = opacity.toFixed(3);
        el.style.zIndex = String(Math.max(1, Math.round(30 - abs * 10)));
        el.style.pointerEvents = abs > 1.5 ? 'none' : 'auto';
        el.style.cursor = abs > 0.5 ? 'pointer' : 'default';
        const hide = abs > 0.5 ? 'true' : null;
        if (el.getAttribute('aria-hidden') !== hide) {
          if (hide) el.setAttribute('aria-hidden', 'true');
          else el.removeAttribute('aria-hidden');
        }
      }
      // Tell the dots which card is nearest the center (only re-renders when it actually changes).
      const nearest = ((Math.round(pos) % n) + n) % n;
      if (nearest !== lastActiveRef.current) {
        lastActiveRef.current = nearest;
        setActive(nearest);
      }
    };

    place();
    let last = 0;
    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      const dt = last ? Math.min(now - last, 50) : 16; // cap so coming back to a tab does not cause a leap
      last = now;
      if (!onScreenRef.current) return;

      if (targetRef.current != null) {
        // Gliding to a chosen card.
        if (reduce) {
          posRef.current = targetRef.current;
        } else {
          posRef.current += (targetRef.current - posRef.current) * (1 - Math.exp(-dt / (GLIDE_MS / 3)));
        }
        if (Math.abs(targetRef.current - posRef.current) < 0.002) {
          posRef.current = targetRef.current;
          targetRef.current = null;
        }
      } else if (!reduce) {
        // Steady drift, eased to a stop while paused and eased back up when resumed.
        const wanted = pausedRef.current ? 0 : 1;
        speedRef.current += (wanted - speedRef.current) * (1 - Math.exp(-dt / EASE_MS));
        posRef.current += (dt / DRIFT_MS_PER_CARD) * speedRef.current;
      }
      // Keep the number small so it never loses precision after hours on the page.
      if (posRef.current >= n) {
        posRef.current -= n;
        if (targetRef.current != null) targetRef.current -= n;
      } else if (posRef.current < 0) {
        posRef.current += n;
        if (targetRef.current != null) targetRef.current += n;
      }
      place();
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [n, compact, reduce]);

  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  if (!reviews || reviews.length === 0) return null;

  // Shortest signed distance (in cards) from the current position to card index i, going whichever way is closer.
  const deltaTo = (i: number) => {
    let d = (((i - posRef.current) % n) + n) % n;
    if (d > n / 2) d -= n;
    return d;
  };
  const glideToCard = (i: number) => {
    targetRef.current = posRef.current + deltaTo(i);
  };
  // For the dots: the nearest copy of review k (short lists are repeated, so there can be several).
  const glideToReview = (k: number) => {
    let best = k;
    let bestAbs = Infinity;
    for (let c = k; c < n; c += reviews.length) {
      const a = Math.abs(deltaTo(c));
      if (a < bestAbs) {
        bestAbs = a;
        best = c;
      }
    }
    glideToCard(best);
  };
  // One card left / right. Repeated presses stack up from where the last glide is heading.
  const go = (dir: number) => {
    const base = targetRef.current != null ? targetRef.current : Math.round(posRef.current);
    targetRef.current = base + dir;
  };

  const onPointerDown = (e: any) => {
    startX.current = e.clientX;
    dragged.current = false;
    if (e.pointerType !== 'mouse') {
      clearTimeout(resumeTimer.current);
      pausedRef.current = true;
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
      resumeTimer.current = setTimeout(() => {
        pausedRef.current = false;
      }, 4000);
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
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') pausedRef.current = true;
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') pausedRef.current = false;
        }}
        onPointerDown={onPointerDown}
        onPointerUp={(e) => finishPointer(e, e.clientX)}
        onPointerCancel={(e) => finishPointer(e, null)}
      >
        {cards.map((r, i) => (
          <ReviewCard
            key={`${r.id}-${i}`}
            review={r}
            compact={compact}
            setEl={(el: any) => {
              cardEls.current[i] = el;
            }}
            onPick={() => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              // Only side cards react to a tap; the center card is already the one being read.
              if (Math.abs(deltaTo(i)) > 0.5) glideToCard(i);
            }}
          />
        ))}
      </div>

      {reviews.length > 1 && (
        <div className="mt-2 flex justify-center gap-2" role="group" aria-label="Choose a review">
          {reviews.map((r, k) => (
            <button
              key={r.id}
              type="button"
              aria-label={`Show review ${k + 1} of ${reviews.length}`}
              aria-current={k === dotsActive ? 'true' : undefined}
              onClick={() => glideToReview(k)}
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
