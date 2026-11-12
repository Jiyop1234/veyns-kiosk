// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, MessageSquarePlus, CheckCircle2, AlertTriangle, MessageSquare } from 'lucide-react';
import {
  fetchFeedbackPage, signPhotoPaths, formatWhen, ratingLabel, Stars, OfficialReply, PhotoGrid, Lightbox,
} from '@/lib/feedback';
import { CreateFeedbackDialog } from '@/components/create-feedback-dialog';
import { supabase } from '@/lib/supabase';

const FILTERS = [
  { key: 0, label: 'All Ratings' },
  { key: 5, label: '5 Stars' },
  { key: 4, label: '4 Stars' },
  { key: 3, label: '3 Stars' },
  { key: 2, label: '2 Stars' },
  { key: 1, label: '1 Star' },
];

function PostCard({ post, urlMap, onOpenPhoto }: any) {
  const photos = [...(post.feedback_photos || [])].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  const urls = photos.map((p) => urlMap[p.storage_path]);
  const reply = Array.isArray(post.feedback_replies) ? post.feedback_replies[0] : post.feedback_replies;
  const foods = post.feedback_post_items || [];
  return (
    <article className="rounded-2xl border border-emerald-800/60 bg-[#061c16] p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0d2e26] text-sm font-extrabold text-[#d4af37]">
            {(post.is_guest ? 'G' : post.display_name?.[0] || 'C').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{post.is_guest ? 'Guest' : post.display_name}</p>
            <p className="text-[11px] text-emerald-300/70">{formatWhen(post.created_at)}</p>
          </div>
        </div>
        <Stars value={post.rating} />
      </header>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {foods.map((f, i) => (
          <span key={i} className="rounded-full border border-emerald-700/60 bg-[#0d2e26] px-2.5 py-0.5 text-[11px] font-bold text-lime-300">
            {f.item_name_snapshot}
          </span>
        ))}
      </div>

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

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[#071F19] text-white">
      <div className="sticky top-0 z-10 border-b border-emerald-800/60 bg-[#071F19]/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-200 hover:text-lime-300 cursor-pointer">
            <ArrowLeft width={16} height={16} /> Back to menu
          </button>
          <h1 className="text-base font-extrabold text-white">Customer Feedback</h1>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-lime-400 px-3 py-2 text-xs font-extrabold text-black shadow-lg cursor-pointer hover:bg-lime-300"
          >
            <MessageSquarePlus width={16} height={16} /> Create a Post
          </button>
        </div>
        <div className="mx-auto max-w-2xl overflow-x-auto px-4 pb-3">
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
                  className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all cursor-pointer ${active ? 'bg-lime-400 text-black shadow-lg' : 'border border-emerald-800/60 bg-[#061c16] text-emerald-200 hover:border-lime-400/50'}`}
                >
                  {f.label} <span className={active ? 'text-black/60' : 'text-emerald-400/70'}>({n})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        {notice && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-lime-400/50 bg-lime-400/10 p-3 text-sm font-bold text-lime-300">
            <CheckCircle2 width={18} height={18} /> {notice}
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/60 p-3 text-sm text-red-300">
            <AlertTriangle width={18} height={18} /> {error}
            <button type="button" onClick={() => loadFirst(filter)} className="ml-auto text-xs font-extrabold underline cursor-pointer">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-emerald-300/80">
            <Loader2 className="animate-spin" width={18} height={18} /> Loading reviews…
          </div>
        ) : posts.length === 0 && !error ? (
          <div className="rounded-2xl border border-dashed border-emerald-800/60 py-14 text-center">
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
                className="mx-auto flex items-center gap-2 rounded-xl border border-emerald-800/60 bg-[#061c16] px-5 py-2.5 text-xs font-extrabold text-emerald-200 hover:border-lime-400/50 disabled:opacity-60 cursor-pointer"
              >
                {loadingMore && <Loader2 className="animate-spin" width={14} height={14} />} Load more reviews
              </button>
            )}
          </>
        )}
      </main>

      <Lightbox urls={lightbox.urls} index={lightbox.index} onClose={() => setLightbox({ urls: [], index: null })} onIndex={(i) => setLightbox((l) => ({ ...l, index: i }))} />
      <CreateFeedbackDialog open={composeOpen} onOpenChange={setComposeOpen} currentUser={currentUser} onPublished={handlePublished} />
    </div>
  );
}
