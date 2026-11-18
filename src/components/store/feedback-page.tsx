// @ts-nocheck
// Customer Feedback page ("Lami Wall"), redesigned in the style of the new home page (Step B7).
// Looks changed only: a summary row (average rating and star breakdown from the real counts), a composer bar that opens the same Create a Post dialog,
// pill filters and softer post cards. Loading, filtering, posting, photos, admin replies and "Load more" are the old code.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle, MessageSquare, Star, ImagePlus } from 'lucide-react';
import {
  fetchFeedbackPage, signPhotoPaths, formatWhen, ratingLabel, Stars, OfficialReply, PhotoGrid, Lightbox,
} from '@/lib/feedback';
import { CreateFeedbackDialog } from '@/components/create-feedback-dialog';
import { supabase } from '@/lib/supabase';

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400';

const FILTERS = [
  { key: 0, label: 'All' },
  { key: 5, label: '5' },
  { key: 4, label: '4' },
  { key: 3, label: '3' },
  { key: 2, label: '2' },
  { key: 1, label: '1' },
];

function PostCard({ post, urlMap, onOpenPhoto }: any) {
  const photos = [...(post.feedback_photos || [])].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  const urls = photos.map((p) => urlMap[p.storage_path]);
  const reply = Array.isArray(post.feedback_replies) ? post.feedback_replies[0] : post.feedback_replies;
  const foods = post.feedback_post_items || [];
  return (
    <article className="animate-fade-up rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0d2e26] font-display text-sm font-extrabold text-lime-300">
            {(post.is_guest ? 'G' : post.display_name?.[0] || 'C').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{post.is_guest ? 'Guest' : post.display_name}</p>
            <p className="text-[11px] text-emerald-200/60">{formatWhen(post.created_at)}</p>
          </div>
        </div>
        <Stars value={post.rating} />
      </header>

      {foods.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {foods.map((f, i) => (
            <span key={i} className="rounded-full border border-lime-400/25 bg-lime-400/10 px-2.5 py-0.5 text-[11px] font-bold text-lime-300">
              {f.item_name_snapshot}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-emerald-50">{post.comment}</p>

      <PhotoGrid urls={urls} onOpen={(i) => onOpenPhoto(urls.filter(Boolean), urls.slice(0, i).filter(Boolean).length)} />

      {reply && <OfficialReply reply={reply} />}
    </article>
  );
}

export function FeedbackPage({ onBack, currentUser }: { onBack: () => void; currentUser?: any }) {
  const [filter, setFilter] = useState(0);
  const [posts, setPosts] = useState<any[]>([]);
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [composeOpen, setComposeOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number | null }>({ urls: [], index: null });
  const reqId = useRef(0);

  const loadCounts = useCallback(async () => {
    const { data } = await supabase.rpc('feedback_rating_counts');
    const c: Record<number, number> = {};
    (data || []).forEach((r: any) => { c[r.rating] = Number(r.total); });
    setCounts(c);
  }, []);

  const loadFirst = useCallback(async (f: number) => {
    const id = ++reqId.current;
    setLoading(true); setError('');
    try {
      const { rows, hasMore } = await fetchFeedbackPage({ rating: f || null, status: 'published' });
      const map = await signPhotoPaths(rows.flatMap((r) => (r.feedback_photos || []).map((p) => p.storage_path)));
      if (id !== reqId.current) return; // a newer request replaced this one
      setPosts(rows); setUrlMap(map); setHasMore(hasMore);
    } catch (e: any) {
      if (id === reqId.current) setError('Could not load reviews. Please try again.');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadFirst(filter); }, [filter, loadFirst]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const loadMore = async () => {
    if (loadingMore || !posts.length) return;
    const last = posts[posts.length - 1];
    const id = reqId.current;
    setLoadingMore(true);
    try {
      const { rows, hasMore } = await fetchFeedbackPage({ rating: filter || null, status: 'published', cursor: { created_at: last.created_at, id: last.id } });
      const map = await signPhotoPaths(rows.flatMap((r) => (r.feedback_photos || []).map((p) => p.storage_path)));
      if (id !== reqId.current) return;
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...rows.filter((r) => !seen.has(r.id))];
      });
      setUrlMap((prev) => ({ ...prev, ...map }));
      setHasMore(hasMore);
    } catch {
      setError('Could not load more reviews.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePublished = () => {
    setComposeOpen(false);
    setNotice('Your feedback was published. Thank you!');
    setTimeout(() => setNotice(''), 5000);
    loadCounts();
    loadFirst(filter); // refetch from Supabase so the saved post appears at the top
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // --- Step B7: summary numbers, from the same rating counts as the filter chips ---
  const average = total > 0 ? [1, 2, 3, 4, 5].reduce((sum, n) => sum + n * (counts[n] || 0), 0) / total : 0;
  const initial = ((currentUser && currentUser.type !== 'guest' && currentUser.name) ? String(currentUser.name)[0] : 'G').toUpperCase();

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[#03120d] text-white" style={{ backgroundImage: 'radial-gradient(60rem 28rem at 85% -5%, rgba(163,230,53,0.07), transparent 60%)' }}>
      {/* top bar: same color and height as the store header */}
      <div className="sticky top-0 z-10 bg-[#03120d]/95 backdrop-blur">
        <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-3 sm:h-20 sm:px-8">
          <button type="button" onClick={onBack} className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-emerald-100/80 transition-colors hover:text-lime-400 cursor-pointer ${FOCUS}`}>
            <ArrowLeft width={16} height={16} /> Back to menu
          </button>
          <span className="border-b-2 border-lime-400 pb-1 text-sm font-semibold text-lime-400">Feedback</span>
          <span />
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-4 sm:px-6">
        {/* summary row */}
        <section className="animate-fade-up grid items-center gap-6 md:grid-cols-[1.15fr_auto_1.25fr] md:gap-8">
          <div>
            <h1 className="font-display text-5xl font-extrabold tracking-tight text-white sm:text-6xl">Lami Wall<span className="text-lime-400">.</span></h1>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100/70">Share your experience with us!<br />Let's keep the good food vibes going.</p>
          </div>

          <div className="md:border-l md:border-white/10 md:px-8">
            <div className="flex items-end gap-1">
              <span className="font-display text-5xl font-extrabold leading-none text-white">{total > 0 ? average.toFixed(1) : '–'}</span>
              <span className="pb-1 text-lg font-bold text-emerald-100/60">/5</span>
            </div>
            <div className="mt-2 flex gap-0.5" aria-label={total > 0 ? `Average rating ${average.toFixed(1)} out of 5` : 'No ratings yet'}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} width={18} height={18} className={Math.round(average) >= n && total > 0 ? 'fill-[#d4af37] text-[#d4af37]' : 'text-emerald-800'} />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-emerald-100/60">{total.toLocaleString()} {total === 1 ? 'review' : 'reviews'}</p>
          </div>

          <div className="md:border-l md:border-white/10 md:pl-8">
            <p className="mb-2 text-xs font-bold text-white">Rating breakdown</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = counts[n] || 0;
                const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                return (
                  <div key={n} className="flex items-center gap-2 text-[11px] text-emerald-100/80">
                    <span className="flex w-6 items-center gap-0.5">{n}<Star width={10} height={10} className="fill-[#d4af37] text-[#d4af37]" /></span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-lime-400" style={{ width: `${pct}%` }} /></span>
                    <span className="w-9 text-right tabular-nums">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* composer bar: opens the same Create a Post dialog */}
        <section className="animate-fade-up mt-6 flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0d2e26] font-display text-sm font-extrabold text-lime-300">{initial}</div>
          <button type="button" onClick={() => setComposeOpen(true)} className={`min-w-0 flex-1 truncate rounded-2xl bg-white/[0.05] px-4 py-3 text-left text-sm text-emerald-100/50 transition-colors hover:bg-white/[0.08] cursor-pointer ${FOCUS}`}>
            Share your experience…
          </button>
          <button type="button" onClick={() => setComposeOpen(true)} aria-label="Add photos and write a post" className={`hidden size-10 shrink-0 items-center justify-center rounded-full text-emerald-100/70 transition-colors hover:bg-[#0d2e26] hover:text-lime-400 cursor-pointer sm:flex ${FOCUS}`}>
            <ImagePlus width={18} height={18} />
          </button>
          <button type="button" onClick={() => setComposeOpen(true)} className={`shrink-0 rounded-full bg-lime-400 px-5 py-2.5 text-sm font-extrabold text-black transition-colors hover:bg-lime-300 cursor-pointer ${FOCUS}`}>
            Post
          </button>
        </section>

        {/* rating filters */}
        <div className="mt-5 overflow-x-auto pb-1">
          <div className="flex gap-2" role="tablist" aria-label="Filter by rating">
            {FILTERS.map((f) => {
              const n = f.key === 0 ? total : counts[f.key] || 0;
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${FOCUS} ${active ? 'bg-lime-400 text-black' : 'border border-white/10 bg-white/[0.04] text-emerald-100/80 hover:border-lime-400/50 hover:text-white'}`}
                >
                  {f.key === 0 ? 'All' : <>{f.label}<Star width={12} height={12} className={active ? 'fill-black text-black' : 'fill-[#d4af37] text-[#d4af37]'} /></>}
                  <span className={active ? 'text-black/60' : 'text-emerald-300/60'}>({n})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* posts */}
        <div className="mt-4 space-y-3">
          {notice && (
            <div role="status" className="flex items-center gap-2 rounded-2xl border border-lime-400/50 bg-lime-400/10 p-3 text-sm font-bold text-lime-300">
              <CheckCircle2 width={18} height={18} /> {notice}
            </div>
          )}
          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-2xl border border-red-800 bg-red-950/60 p-3 text-sm text-red-300">
              <AlertTriangle width={18} height={18} /> {error}
              <button type="button" onClick={() => loadFirst(filter)} className="ml-auto text-xs font-extrabold underline cursor-pointer">Retry</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-emerald-300/80">
              <Loader2 className="animate-spin" width={18} height={18} /> Loading reviews…
            </div>
          ) : posts.length === 0 && !error ? (
            <div className="rounded-3xl border border-dashed border-white/15 py-14 text-center">
              <MessageSquare className="mx-auto mb-2 text-emerald-700" width={28} height={28} />
              <p className="text-sm font-bold text-emerald-100">
                {filter === 0 ? 'No reviews yet.' : `No ${ratingLabel(filter)} reviews yet.`}
              </p>
              <p className="mt-1 text-xs text-emerald-300/70">Be the first to share your experience.</p>
            </div>
          ) : (
            <>
              {posts.map((p) => (
                <PostCard key={p.id} post={p} urlMap={urlMap} onOpenPhoto={(urls, index) => setLightbox({ urls, index })} />
              ))}
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className={`mx-auto flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 py-2.5 text-xs font-bold text-emerald-100 hover:border-lime-400/50 disabled:opacity-60 cursor-pointer ${FOCUS}`}
                >
                  {loadingMore && <Loader2 className="animate-spin" width={14} height={14} />} Load more reviews
                </button>
              )}
            </>
          )}
        </div>
      </main>

      <Lightbox urls={lightbox.urls} index={lightbox.index} onClose={() => setLightbox({ urls: [], index: null })} onIndex={(i) => setLightbox((l) => ({ ...l, index: i }))} />
      <CreateFeedbackDialog open={composeOpen} onOpenChange={setComposeOpen} currentUser={currentUser} onPublished={handlePublished} />
    </div>
  );
}
