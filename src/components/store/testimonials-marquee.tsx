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
// Step 9G-3: the dots are removed; silver arrows (a shine sweeps across them, no glow) on the left and right (plus swipe, keys and tapping a side card).
//          Slower drift, and cards start clearing up as soon as they appear. Text in the carousel can no longer be
//          highlighted by accident while swiping.
// Step 9G-6: card is now an Instagram-style post (paper look, nickname, place, big centered review, likes, caption, time).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MAX_REVIEWS = 12;          // newest published 5-star reviews used by the carousel
const MIN_CARDS = 5;             // fewer reviews than this are repeated so the left/center/right cards always exist
const MAX_CHARS = 220;           // long comments are cut here (the full text stays on the Feedback page)
const DRIFT_MS_PER_CARD = 6000;  // SPEED: time the row takes to move by one card. Bigger = slower, smaller = faster.
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
const MAX_BLUR = 7;       // px of blur on cards two positions away (only about 2 px one position away: a card starts clearing as soon as it appears)
function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
const GAP = 28;           // px of empty space between two neighbouring cards (desktop). Always the same, at every moment.
const GAP_COMPACT = 16;   // same, on phones
function scaleAt(abs: number) {
  const s = smooth((abs - SHARP_ZONE) / (2 - SHARP_ZONE)); // 0 at the center, 1 two cards away
  return 1 - 0.3 * s;                                       // 1 at the center, 0.85 one away, 0.7 two away
}
// Horizontal position (px from the center) of a card at distance d. Cards shrink as they leave the center, so a fixed
// spacing would make the gaps uneven (that was the bug). Instead each card is placed so that the empty space between it
// and its neighbour is exactly `gap`, whatever their sizes are at that moment. The first part is the position inside
// one card-width of the center (mirrored left/right); the loops add or remove one neighbour-to-neighbour distance at a time.
function layoutX(d: number, w: number, gap: number) {
  const sc = (v: number) => scaleAt(Math.abs(v));
  const between = (a: number, b: number) => (w * (sc(a) + sc(b))) / 2 + gap; // center-to-center of two neighbours
  const P = between(0, 1);
  const base = Math.floor(d);
  const r = d - base; // 0 <= r < 1
  let x = between(r, 1 - r) / 2 + P * (r - 0.5);
  for (let j = 1; j <= base; j++) x += between(r + j - 1, r + j);
  for (let k = base; k < 0; k++) x -= between(r + k, r + k + 1);
  return x;
}
function cardLook(d: number, w: number, gap: number) {
  const abs = Math.abs(d);
  const s = smooth((abs - SHARP_ZONE) / (2 - SHARP_ZONE));
  const scale = scaleAt(abs);
  const blur = MAX_BLUR * Math.pow(s, 1.5); // the 1.5 power makes cards clear up sooner on the way in (and blur later on the way out)
  const opacity = abs <= 1 ? 1 - 0.4 * smooth((abs - SHARP_ZONE) / (1 - SHARP_ZONE)) : Math.max(0, 0.6 * (2 - abs));
  // Cards two or more away are invisible, so skip the position maths for them.
  const x = opacity <= 0.005 ? 0 : layoutX(d, w, gap);
  return { abs, scale, blur, opacity, x };
}

// Card design (Step 9G-6): an Instagram-style post on paper. Header (round initial, nickname, place, three dots),
// the review in big centered text, then the heart / comment / send / bookmark row, likes, caption, comments and time.
// Everything below the review text is the same for every customer except the nickname and the "posted" time.
const CARD_W = 290;              // card width on desktop (px)
const CARD_H = 420;              // card height on desktop (px)
const CARD_W_COMPACT = 220;      // phones
const CARD_H_COMPACT = 330;
const PLACE = 'Mandaue City, Cebu';
const CAPTION = 'Good Food, Good Mood';
const LIKES = 922;
const COMMENTS = 922;
const INK = '#1d2723';           // main dark text
const MUTED = '#7a766d';         // grey text
const PAPER_TOP = '#eee4d9';     // header and footer
const PAPER_MID = '#e8d9c8';     // area behind the review
// Very faint paper grain (an inline SVG noise picture, so no image file is needed).
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45 0 0 0 0 0.36 0 0 0 0 0.26 0 0 0 0.16 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

// "5 hours ago", "2 days ago", ... from the time the review was posted.
function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  const unit = (v: number, w: string) => `${v} ${w}${v === 1 ? '' : 's'} ago`;
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return unit(min, 'minute');
  const hr = Math.floor(min / 60);
  if (hr < 24) return unit(hr, 'hour');
  const day = Math.floor(hr / 24);
  if (day < 7) return unit(day, 'day');
  if (day < 30) return unit(Math.floor(day / 7), 'week');
  if (day < 365) return unit(Math.floor(day / 30), 'month');
  return unit(Math.floor(day / 365), 'year');
}

// Long reviews get a smaller size so they always fit the paper.
function reviewFontSize(len: number, compact: boolean): number {
  const sizes = compact ? [18, 15, 13, 12] : [22, 19, 16, 14];
  if (len <= 70) return sizes[0];
  if (len <= 130) return sizes[1];
  if (len <= 180) return sizes[2];
  return sizes[3];
}

const ICON = { fill: 'none', stroke: INK, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as any;

// Static look of a card. Position, scale, blur and opacity are written straight onto the element by the animation
// loop below (so React does not re-render 60 times a second); that is why none of them appear in this style object.
function ReviewCard({ review, compact, setEl, onPick }: any) {
  const name = review.is_guest ? 'Guest' : review.display_name || 'Customer';
  const comment = shorten(review.comment);
  const width = compact ? CARD_W_COMPACT : CARD_W;
  const height = compact ? CARD_H_COMPACT : CARD_H;
  const small = compact ? 10 : 11; // footer text size

  return (
    <article
      ref={setEl}
      onClick={onPick}
      className="absolute left-1/2 top-1/2 flex flex-col overflow-hidden rounded-md shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
      style={{
        width,
        height,
        color: INK,
        backgroundColor: PAPER_TOP,
        backgroundImage: GRAIN,
        willChange: 'transform, filter, opacity',
        visibility: 'hidden', // shown by the animation loop as soon as it has placed the card
      }}
    >
      {/* Header: initial, nickname, place, three dots. */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif text-base"
          style={{ background: '#cdb9a3', color: '#3a2f27' }}
        >
          {name[0].toUpperCase()}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-bold" style={{ fontSize: small + 1 }}>{name}</p>
          <p className="truncate" style={{ fontSize: small - 1, color: MUTED }}>{PLACE}</p>
        </div>
        <span aria-hidden="true" className="ml-auto flex shrink-0 gap-[3px] pr-1">
          {[0, 1, 2].map((k) => (
            <span key={k} className="h-[3px] w-[3px] rounded-full" style={{ background: INK }} />
          ))}
        </span>
      </div>

      {/* The review. */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 text-center"
        style={{ background: PAPER_MID }}
      >
        <p
          className="break-words font-medium tracking-tight"
          style={{ fontSize: reviewFontSize(comment.length, compact), lineHeight: 1.22 }}
        >
          {comment}
        </p>
      </div>

      {/* Footer: icons, likes, caption, comments, time. */}
      <div className="shrink-0 px-3 pb-3 pt-2.5" style={{ fontSize: small }}>
        <div aria-hidden="true" className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path
              d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.6 1.1 5.6 3.2C14 6.1 15.6 5 17.6 5c3.4 0 5.5 3.4 4 6.8C19.5 16.4 12 21 12 21z"
              fill="#e0393e"
              stroke="#e0393e"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <svg viewBox="0 0 24 24" width="21" height="21" {...ICON}>
            <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20.5l1.6-5.3A8.5 8.5 0 1 1 21 11.5z" />
          </svg>
          <svg viewBox="0 0 24 24" width="21" height="21" {...ICON}>
            <path d="M22 3 9.5 14.5M22 3l-7 18-5.5-6.5L3 9z" />
          </svg>
          <svg viewBox="0 0 24 24" width="21" height="21" className="ml-auto" {...ICON}>
            <path d="M6 3h12v18l-6-4.5L6 21z" />
          </svg>
        </div>
        <p className="mt-2 font-bold">{LIKES} likes</p>
        <p className="mt-0.5 truncate">
          <span className="font-bold">{name}</span> {CAPTION}
        </p>
        <p className="mt-0.5" style={{ color: MUTED }}>View all {COMMENTS} comments</p>
        <p className="mt-0.5" style={{ color: MUTED, fontSize: small - 1 }}>{timeAgo(review.created_at)}</p>
      </div>
    </article>
  );
}

// A thin silver chevron with a bright shine that sweeps across it every few seconds (like the "Scroll down" arrow).
// No glow. The sweep is a moving highlight inside the SVG gradient (SVG animation, so no CSS file change).
// It is left out when the visitor has "Reduce motion" turned on.
const ARROW_BASE = '#98a6a2';   // resting silver
const ARROW_SHINE = '#ffffff';  // the sweeping highlight
const SHINE_SECONDS = 3;        // time for one full sweep + rest
function SilverArrow({ dir, onClick, reduce }: any) {
  const id = dir < 0 ? 'veyns-silver-left' : 'veyns-silver-right';
  return (
    <button
      type="button"
      aria-label={dir < 0 ? 'Previous review' : 'Next review'}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className={`group absolute top-1/2 z-40 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full outline-none transition-transform duration-300 hover:scale-110 focus-visible:ring-2 focus-visible:ring-lime-400/70 sm:h-14 sm:w-14 ${
        dir < 0 ? 'left-0 sm:left-3' : 'right-0 sm:right-3'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7 sm:h-8 sm:w-8"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0" stopColor={ARROW_BASE} />
            <stop offset="0.38" stopColor={ARROW_BASE} />
            <stop offset="0.5" stopColor={ARROW_SHINE} />
            <stop offset="0.62" stopColor={ARROW_BASE} />
            <stop offset="1" stopColor={ARROW_BASE} />
            {!reduce && (
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                values="-1 0; 1 0; 1 0"
                keyTimes="0; 0.55; 1"
                dur={`${SHINE_SECONDS}s`}
                repeatCount="indefinite"
              />
            )}
          </linearGradient>
        </defs>
        <path d={dir < 0 ? 'M15 4 L7 12 L15 20' : 'M9 4 L17 12 L9 20'} stroke={`url(#${id})`} />
      </svg>
    </button>
  );
}

export function TestimonialsMarquee() {
  // null = still loading; [] = nothing to show (section stays hidden).
  const [reviews, setReviews] = useState<any[] | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const compact = useMedia('(max-width: 639px)');
  const reduce = useMedia('(prefers-reduced-motion: reduce)');

  // Animation state lives in refs so moving the cards never causes a React re-render.
  const posRef = useRef(0);            // which card is at the center, as a fraction (2.5 = halfway between card 2 and 3)
  const targetRef = useRef<number | null>(null); // where a click / swipe is gliding to (null = just drifting)
  const speedRef = useRef(1);          // 0 = stopped, 1 = full drift speed (eased)
  const pausedRef = useRef(false);     // hover / touch pause
  const onScreenRef = useRef(false);   // true while the section is on screen
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
    const cardW = compact ? CARD_W_COMPACT : CARD_W; // must match the card width in ReviewCard
    const gap = compact ? GAP_COMPACT : GAP;

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
        const { abs, scale, blur, opacity, x } = cardLook(d, cardW, gap);
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
        className="relative mx-auto w-full max-w-6xl select-none outline-none focus-visible:ring-2 focus-visible:ring-lime-400/60"
        style={{ height: compact ? 360 : 450, touchAction: 'pan-y' }}
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
        {/* Silver arrows with a shine that sweeps across. Same job as swiping: one card back / forward. */}
        <SilverArrow dir={-1} reduce={reduce} onClick={() => go(-1)} />
        <SilverArrow dir={1} reduce={reduce} onClick={() => go(1)} />
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
    </section>
  );
}
