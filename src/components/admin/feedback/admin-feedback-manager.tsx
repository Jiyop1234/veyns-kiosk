// @ts-nocheck
// VEYNS Admin, Feedback: the Feedback screen (Step B5).
// Loads the posts page by page and filters them as before (server: rating and status; here: Needs reply, search, menu item).
// Layout: stat cards, filters, then the post list | the selected post and its reply | Moderation Actions and Post Details.
// On a large screen (fit) the page does not scroll: the list and the selected post scroll inside their own panels.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, MessageSquare, RefreshCw, Search, Trash2, Download } from 'lucide-react';
import { fetchFeedbackPage, signPhotoPaths, formatWhen, Stars, Lightbox, FEEDBACK_BUCKET } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { AdminFeedbackStatCards } from './admin-feedback-stat-cards';
import { AdminFeedbackPostDetail, STATUS_SKIN } from './admin-feedback-post-detail';
import { useAdminFeedbackStats } from './admin-feedback-data';
import { feedbackToCsv } from './admin-feedback-export';

const RATINGS = [0, 5, 4, 3, 2, 1];
const STATUSES = [
  { key: '', label: 'All statuses' },
  { key: 'published', label: 'Published' },
  { key: 'pending', label: 'Pending Review' },
  { key: 'hidden', label: 'Hidden' },
];
const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold cursor-pointer ${on ? 'bg-lime-400 text-black' : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'}`;
const fieldCls = 'rounded-xl bg-white/[0.06] px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 [color-scheme:dark]';
const toolBtn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-40';

const replyOf = (r: any) => (Array.isArray(r.feedback_replies) ? r.feedback_replies[0] : r.feedback_replies);

export function AdminFeedbackManager({ fit = false }: { fit?: boolean }) {
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState('');
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number | null }>({ urls: [], index: null });
  const [cleanMsg, setCleanMsg] = useState('');
  const reqId = useRef(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [menuFilter, setMenuFilter] = useState('');
  const { stats, reload: reloadStats } = useAdminFeedbackStats();

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true); setError('');
    try {
      const { rows, hasMore } = await fetchFeedbackPage({ rating: rating || null, status: status || null });
      const map = await signPhotoPaths(rows.flatMap((r) => (r.feedback_photos || []).map((p) => p.storage_path)));
      if (id !== reqId.current) return;
      setRows(rows); setUrlMap(map); setHasMore(hasMore);
    } catch { if (id === reqId.current) setError('Could not load feedback.'); }
    finally { if (id === reqId.current) setLoading(false); }
  }, [rating, status]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (loadingMore || !rows.length) return;
    const last = rows[rows.length - 1];
    setLoadingMore(true);
    try {
      const r = await fetchFeedbackPage({ rating: rating || null, status: status || null, cursor: { created_at: last.created_at, id: last.id } });
      const map = await signPhotoPaths(r.rows.flatMap((x) => (x.feedback_photos || []).map((p) => p.storage_path)));
      setRows((prev) => { const seen = new Set(prev.map((p) => p.id)); return [...prev, ...r.rows.filter((x) => !seen.has(x.id))]; });
      setUrlMap((p) => ({ ...p, ...map })); setHasMore(r.hasMore);
    } catch { setError('Could not load more.'); }
    finally { setLoadingMore(false); }
  };

  const replace = (updated: any) => { setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r))); reloadStats(); };
  const removeRow = (id: string) => { setRows((prev) => prev.filter((r) => r.id !== id)); reloadStats(); };

  const cleanOrphans = async () => {
    setCleanMsg('Checking…');
    const { data, error } = await supabase.rpc('feedback_orphan_images');
    if (error) { setCleanMsg('Not authorized or failed to check.'); return; }
    const names = (data || []).map((d: any) => d.name);
    if (!names.length) { setCleanMsg('No orphaned uploads found.'); return; }
    const { error: rmErr } = await supabase.storage.from(FEEDBACK_BUCKET).remove(names);
    setCleanMsg(rmErr ? 'Could not remove some files.' : `Removed ${names.length} orphaned upload(s).`);
  };

  const menuNames = Array.from(new Set(rows.flatMap((r) => (r.feedback_post_items || []).map((f: any) => f.item_name_snapshot)))).sort();
  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (onlyUnanswered && replyOf(r)) return false;
    if (menuFilter && !(r.feedback_post_items || []).some((f: any) => f.item_name_snapshot === menuFilter)) return false;
    if (q) {
      const reply = replyOf(r);
      const haystack = [r.is_guest ? 'guest' : r.display_name, r.comment, reply ? reply.body : '', ...(r.feedback_post_items || []).map((f: any) => f.item_name_snapshot)].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const activeId = visible.some((r) => r.id === selectedId) ? selectedId : visible.length > 0 ? visible[0].id : null;

  const exportCsv = () => {
    const blob = new Blob([feedbackToCsv(visible)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `veyns-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const ratingCount = (n: number) => (!stats ? null : n === 0 ? stats.total : stats.ratingCounts[n]);
  const statusCount = (key: string) => (!stats ? null : key === '' ? stats.total : stats.statusCounts[key]);
  const withCount = (label: string, count: number | null, on: boolean) => (
    <>
      {label}
      {count !== null && <span className={`rounded-full px-1.5 text-[10px] ${on ? 'bg-black/15' : 'bg-white/[0.08]'}`}>{count}</span>}
    </>
  );

  return (
    <div className={fit ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-4'}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-400 text-black"><MessageSquare width={22} height={22} aria-hidden="true" /></span>
          <div>
            <h2 className="font-display text-2xl font-extrabold leading-tight text-white">Customer Feedback</h2>
            <p className="text-xs text-zinc-400">Newest first. Hidden posts stay here for reference and never show publicly.</p>
          </div>
        </div>
        <button type="button" onClick={() => { load(); reloadStats(); }} aria-label="Refresh feedback" title="Refresh" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <AdminFeedbackStatCards stats={stats} />

      <div className="shrink-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {RATINGS.map((n) => <button key={n} type="button" onClick={() => setRating(n)} className={chip(rating === n)}>{withCount(n === 0 ? 'All Ratings' : `${n} ${n === 1 ? 'Star' : 'Stars'}`, ratingCount(n), rating === n)}</button>)}
          <label className="relative ml-auto min-w-[14rem] flex-1 sm:max-w-sm">
            <span className="sr-only">Search feedback</span>
            <Search width={14} height={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search nickname, review… (loaded posts)" className={`${fieldCls} w-full pl-9`} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((s) => <button key={s.key} type="button" onClick={() => setStatus(s.key)} className={chip(status === s.key)}>{withCount(s.label, statusCount(s.key), status === s.key)}</button>)}
          <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-zinc-200">
            <input type="checkbox" checked={onlyUnanswered} onChange={(e) => setOnlyUnanswered(e.target.checked)} className="peer sr-only" />
            <span className="relative h-5 w-9 rounded-full bg-white/[0.12] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-lime-400 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-lime-400" aria-hidden="true" />
            Needs reply only
          </label>
          <label>
            <span className="sr-only">Menu item</span>
            <select value={menuFilter} onChange={(e) => setMenuFilter(e.target.value)} className={fieldCls}>
              <option value="" className="bg-[#141817]">All menu items</option>
              {menuNames.map((name: any) => <option key={name} value={name} className="bg-[#141817]">{name}</option>)}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={exportCsv} disabled={visible.length === 0} className={`${toolBtn} bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]`}><Download width={14} height={14} /> Export Feedback</button>
            <button type="button" onClick={cleanOrphans} className={`${toolBtn} bg-red-500/15 text-red-300 hover:bg-red-500/25`}><Trash2 width={14} height={14} /> Clean up unused uploads</button>
          </div>
        </div>
        {cleanMsg && <p className="text-xs text-lime-300">{cleanMsg}</p>}
      </div>

      {error && <div role="alert" className="flex shrink-0 items-center gap-2 rounded-xl bg-red-500/15 p-3 text-sm text-red-300"><AlertTriangle width={16} height={16} /> {error}</div>}

      <div className={fit ? 'grid min-h-0 flex-1 grid-cols-[minmax(0,320px)_minmax(0,1fr)_320px] grid-rows-[minmax(0,1fr)] gap-3' : 'grid grid-cols-1 gap-4'}>
        {/* Post list */}
        <section className={`flex min-h-0 flex-col rounded-2xl bg-white/[0.04] p-3 ${fit ? '' : 'max-h-96'}`}>
          <h3 className="mb-2 shrink-0 px-1 text-sm font-bold text-white">Posts <span className="font-normal text-zinc-400">({visible.length}{hasMore ? '+' : ''})</span></h3>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-400"><Loader2 className="animate-spin" width={18} height={18} /> Loading…</div>
            ) : visible.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-300"><MessageSquare className="mx-auto mb-2 text-zinc-600" width={26} height={26} />No feedback matches these filters.</div>
            ) : (
              <>
                {visible.map((p) => {
                  const on = p.id === activeId;
                  return (
                    <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} aria-current={on ? 'true' : undefined} className={`w-full cursor-pointer rounded-xl p-3 text-left ${on ? 'bg-lime-400/10 ring-1 ring-lime-400/50' : 'bg-white/[0.04] hover:bg-white/[0.08]'}`}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs font-bold text-white">{p.is_guest ? 'Guest' : p.display_name}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${STATUS_SKIN[p.status]}`}>{p.status}</span>
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2"><Stars value={p.rating} /><span className="text-[10px] text-zinc-400">{formatWhen(p.created_at)}</span></span>
                      <span className="mt-1.5 line-clamp-2 block break-words text-[11px] text-zinc-300">{p.comment}</span>
                      <span className={`mt-1.5 block text-[10px] font-bold uppercase ${replyOf(p) ? 'text-lime-400' : 'text-amber-300'}`}>{replyOf(p) ? 'Replied' : 'Needs reply'}</span>
                    </button>
                  );
                })}
                {hasMore && (
                  <button type="button" onClick={loadMore} disabled={loadingMore} className="mx-auto flex items-center gap-2 rounded-xl bg-white/[0.06] px-5 py-2 text-xs font-bold text-zinc-200 hover:bg-white/[0.12] disabled:opacity-60 cursor-pointer">
                    {loadingMore && <Loader2 className="animate-spin" width={14} height={14} />} Load more
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        {/* Selected post (every post is mounted, only the selected one is shown) */}
        {visible.map((p) => (
          <AdminFeedbackPostDetail key={p.id} post={p} visible={p.id === activeId} urlMap={urlMap} onOpenPhoto={(urls, index) => setLightbox({ urls, index })} onChanged={replace} onDeleted={removeRow} />
        ))}
        {!loading && visible.length === 0 && (
          <div className={`flex items-center justify-center rounded-2xl bg-white/[0.04] p-6 text-sm text-zinc-400 ${fit ? 'col-span-2' : ''}`}>Select a post to read it, reply and moderate it.</div>
        )}
      </div>
      <Lightbox urls={lightbox.urls} index={lightbox.index} onClose={() => setLightbox({ urls: [], index: null })} onIndex={(i) => setLightbox((l) => ({ ...l, index: i }))} />
    </div>
  );
}
