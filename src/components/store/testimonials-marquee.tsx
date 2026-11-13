// @ts-nocheck
// TestimonialsMarquee — a slow row of customer review cards, moving left to right (Step 9).
// Reads the latest published posts from feedback_posts (same table and 'published' rule as the Feedback page).
// No database change: anon visitors can already read these columns (RLS policy "feedback_posts public read").
// Hidden completely when there are no published reviews or the request fails.
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Stars } from '@/lib/feedback';

const MAX_REVIEWS = 12;      // newest published reviews shown in the row
const MIN_CARDS = 6;         // fewer reviews than this are repeated so the loop never shows a gap
const MAX_CHARS = 140;       // long comments are cut here (the full text stays on the Feedback page)
const SECONDS_PER_CARD = 8;  // keeps the speed the same whether there are 3 or 12 reviews
const MIN_SECONDS = 48;

// Cut a comment at about MAX_CHARS, at a word boundary when there is one, and add an ellipsis.
function shorten(text: string): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_CHARS) return t;
  const cut = t.slice(0, MAX_CHARS);
  const space = cut.lastIndexOf(' ');
  return (space > 80 ? cut.slice(0, space) : cut).trimEnd() + '…';
}

function ReviewCard({ review }: { review: any }) {
  const name = review.is_guest ? 'Guest' : review.display_name || 'Customer';
  return (
    <article className="flex w-72 shrink-0 flex-col justify-between rounded-2xl border border-emerald-700/40 bg-white/[0.04] p-5 sm:w-80">
      <div>
        <Stars value={review.rating} size={16} />
        <p className="mt-3 break-words text-sm leading-relaxed text-emerald-50">{shorten(review.comment)}</p>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0d2e26] text-sm font-extrabold text-[#d4af37]">
          {name[0].toUpperCase()}
        </div>
        <p className="truncate text-sm font-bold text-white">{name}</p>
      </div>
    </article>
  );
}

export function TestimonialsMarquee() {
  // null = still loading; [] = nothing to show (section stays hidden).
  const [reviews, setReviews] = useState<any[] | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('feedback_posts')
          .select('id, display_name, is_guest, rating, comment, created_at')
          .eq('status', 'published')
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

  // Fade in and start moving only when the section scrolls into view (same idea as the hero).
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

  if (!reviews || reviews.length === 0) return null;

  // Repeat a short list so one group is always wide enough; the track holds two identical groups.
  const reps = Math.ceil(MIN_CARDS / reviews.length);
  const cards = Array.from({ length: reps }, () => reviews).flat();
  const seconds = Math.max(MIN_SECONDS, cards.length * SECONDS_PER_CARD);

  return (
    <section
      id="home-reviews"
      ref={sectionRef}
      aria-label="Customer reviews"
      className={`relative overflow-hidden bg-[#03120d] py-10 transition-opacity duration-700 motion-reduce:transition-none sm:py-14 ${seen ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="mx-auto mb-6 max-w-6xl px-4 text-center sm:mb-8">
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">What our customers say</h2>
        <p className="mt-1 text-sm text-emerald-300/70">Real reviews from VEYNS customers</p>
      </div>

      <div className="relative">
        <div className="veyns-marquee veyns-testimonials" data-running={seen ? 'true' : 'false'}>
          <div
            className="veyns-marquee-track veyns-marquee-ltr"
            style={{ ['--marquee-duration' as any]: `${seconds}s` }}
          >
            {[0, 1].map((copy) => (
              // The second group is a visual duplicate for the loop; screen readers skip it.
              <div className="veyns-marquee-group" key={copy} aria-hidden={copy === 1 ? 'true' : undefined}>
                {cards.map((r, i) => (
                  <ReviewCard key={`${r.id}-${i}`} review={r} />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Soft fade at both edges. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-12 bg-gradient-to-r from-[#03120d] to-transparent sm:w-32"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-12 bg-gradient-to-l from-[#03120d] to-transparent sm:w-32"
        />
      </div>
    </section>
  );
}
