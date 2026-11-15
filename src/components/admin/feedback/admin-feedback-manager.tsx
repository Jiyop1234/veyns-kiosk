// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, Eye, EyeOff, Clock, Trash2, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import {
  fetchFeedbackPage, signPhotoPaths, formatWhen, Stars, PhotoGrid, Lightbox, OFFICIAL_NAME, FEEDBACK_BUCKET, MAX_COMMENT,
} from '@/lib/feedback';
import { supabase } from '@/lib/supabase';

const RATINGS = [0, 5, 4, 3, 2, 1];
const STATUSES = [
  { key: '', label: 'All statuses' },
  { key: 'published', label: 'Published' },
  { key: 'pending', label: 'Pending Review' },
  { key: 'hidden', label: 'Hidden' },
];
const STATUS_SKIN: Record<string, string> = {
  published: 'bg-lime-400/15 text-lime-300 border-lime-400/50',
  pending: 'bg-amber-400/15 text-amber-300 border-amber-400/50',
  hidden: 'bg-red-950 text-red-400 border-red-800',
};
const chip = (on: boolean) =>
  `px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${on ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`;

function FeedbackRow({ post, urlMap, onOpenPhoto, onChanged, onDeleted }: any) {
  const reply = Array.isArray(post.feedback_replies) ? post.feedback_replies[0] : post.feedback_replies;
  const photos = [...(post.feedback_photos || [])].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  const urls = photos.map((p) => urlMap[p.storage_path]);
  const [draft, setDraft] = useState(reply?.body || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => { setDraft(reply?.body || ''); }, [reply?.body]);

  const setStatus = async (status: string) => {
    if (status === post.status) return;
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.from('feedback_posts').update({ status }).eq('id', post.id).select('id,status');
    setBusy(false);
    if (error || !data?.length) { setMsg({ ok: false, text: 'Not allowed or failed to update status.' }); return; }
    onChanged({ ...post, status: data[0].status });
  };

  const saveReply = async () => {
    const body = draft.trim();
    if (!body) { setMsg({ ok: false, text: 'Write a reply first.' }); return; }
    if (draft.length > MAX_COMMENT) { setMsg({ ok: false, text: `Reply is limited to ${MAX_COMMENT} characters.` }); return; }
    setBusy(true); setMsg(null);
    const res = reply
      ? await supabase.from('feedback_replies').update({ body }).eq('id', reply.id).select('id,body,created_at,updated_at')
      : await supabase.from('feedback_replies').insert({ post_id: post.id, body }).select('id,body,created_at,updated_at');
    setBusy(false);
    if (res.error || !res.data?.length) {
      setMsg({ ok: false, text: res.error?.code === '23505' ? 'Another staff member already replied. Reload the list.' : 'Reply was not saved (not authorized or a network error).' });
      return;
    }
    onChanged({ ...post, feedback_replies: [res.data[0]] });
    setMsg({ ok: true, text: reply ? `Reply updated as ${OFFICIAL_NAME}.` : `Reply published as ${OFFICIAL_NAME}.` });
  };

  const deleteReply = async () => {
    if (!reply) return;
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.from('feedback_replies').delete().eq('id', reply.id).select('id');
    setBusy(false);
    if (error || !data?.length) { setMsg({ ok: false, text: 'Reply was not deleted (not authorized or a network error).' }); return; }
    setDraft('');
    onChanged({ ...post, feedback_replies: [] });
    setMsg({ ok: true, text: 'Official reply deleted.' });
  };

  const deletePost = async () => {
    setBusy(true); setMsg(null);
    // 1) delete the database row first (food rows, photo rows and reply cascade); if this fails nothing is lost
    const { data, error } = await supabase.from('feedback_posts').delete().eq('id', post.id).select('id');
    if (error || !data?.length) {
      setBusy(false); setConfirmDel(false);
      setMsg({ ok: false, text: 'Post was not deleted (not authorized or a network error).' });
      return;
    }
    // 2) then remove its image files from Storage
    const paths = photos.map((p) => p.storage_path);
    if (paths.length) await supabase.storage.from(FEEDBACK_BUCKET).remove(paths);
    setBusy(false);
    onDeleted(post.id);
  };

  return (
    <div className="rounded-2xl border border-emerald-800/60 bg-[#061c16] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">
            {post.is_guest ? 'Guest' : post.display_name}
            <span className="ml-2 rounded-full border border-emerald-700/60 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">{post.is_guest ? 'Guest' : 'Registered'}</span>
          </p>
          <p className="text-[11px] text-emerald-300/70">{formatWhen(post.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Stars value={post.rating} />
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${STATUS_SKIN[post.status]}`}>{post.status}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(post.feedback_post_items || []).map((f, i) => (
          <span key={i} className="rounded-full border border-emerald-700/60 bg-[#0d2e26] px-2.5 py-0.5 text-[11px] font-bold text-lime-300">{f.item_name_snapshot}</span>
        ))}
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-emerald-50">{post.comment}</p>
      <PhotoGrid urls={urls} onOpen={(i) => onOpenPhoto(urls.filter(Boolean), urls.slice(0, i).filter(Boolean).length)} />

      <div className="mt-4 rounded-xl border border-emerald-800/60 bg-[#03120d] p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-lime-300"><ShieldCheck width={14} height={14} /> Reply as {OFFICIAL_NAME}</span>
          <span className={`text-[10px] font-extrabold uppercase ${reply ? 'text-lime-400' : 'text-amber-300'}`}>{reply ? 'Replied' : 'Needs reply'}</span>
        </div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Write the official response…" className="w-full resize-y rounded-lg border border-emerald-800/60 bg-[#061c16] p-2.5 text-sm text-white outline-none focus:border-lime-400/60" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-emerald-300/70">{draft.length} / {MAX_COMMENT}</span>
            {reply && (
              <button type="button" disabled={busy} onClick={deleteReply} className="text-[11px] font-extrabold text-red-400 underline disabled:opacity-40 cursor-pointer">Delete reply</button>
            )}
          </div>
          <button type="button" disabled={busy} onClick={saveReply} className="inline-flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2 text-xs font-extrabold text-black disabled:opacity-60 cursor-pointer">
            {busy && <Loader2 className="animate-spin" width={14} height={14} />} {reply ? 'Update reply' : 'Publish reply'}
          </button>
        </div>
        {msg && <p className={`mt-2 text-xs ${msg.ok ? 'text-lime-300' : 'text-red-300'}`}>{msg.text}</p>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || post.status === 'published'} onClick={() => setStatus('published')} className="inline-flex items-center gap-1.5 rounded-lg border border-lime-400/50 px-3 py-1.5 text-[11px] font-extrabold text-lime-300 disabled:opacity-40 cursor-pointer"><Eye width={13} height={13} /> Publish</button>
        <button type="button" disabled={busy || post.status === 'pending'} onClick={() => setStatus('pending')} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 px-3 py-1.5 text-[11px] font-extrabold text-amber-300 disabled:opacity-40 cursor-pointer"><Clock width={13} height={13} /> Pending review</button>
        <button type="button" disabled={busy || post.status === 'hidden'} onClick={() => setStatus('hidden')} className="inline-flex items-center gap-1.5 rounded-lg border border-red-800 px-3 py-1.5 text-[11px] font-extrabold text-red-400 disabled:opacity-40 cursor-pointer"><EyeOff width={13} height={13} /> Hide (spam / inappropriate)</button>
        {!confirmDel ? (
          <button type="button" disabled={busy} onClick={() => setConfirmDel(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-800 bg-red-950/60 px-3 py-1.5 text-[11px] font-extrabold text-red-300 disabled:opacity-40 cursor-pointer"><Trash2 width={13} height={13} /> Delete post</button>
        ) : (
          <span className="ml-auto inline-flex flex-wrap items-center gap-2 rounded-lg border border-red-800 bg-red-950/60 px-3 py-1.5 text-[11px] text-red-200">
            Permanently delete this post, its photos and reply?
            <button type="button" disabled={busy} onClick={deletePost} className="rounded-md bg-red-600 px-2.5 py-1 font-extrabold text-white disabled:opacity-60 cursor-pointer">{busy ? 'Deleting…' : 'Yes, delete'}</button>
            <button type="button" disabled={busy} onClick={() => setConfirmDel(false)} className="rounded-md border border-red-800 px-2.5 py-1 font-extrabold cursor-pointer">Cancel</button>
          </span>
        )}
      </div>
    </div>
  );
}

export function AdminFeedbackManager() {
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

  const replace = (updated: any) => setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const cleanOrphans = async () => {
    setCleanMsg('Checking…');
    const { data, error } = await supabase.rpc('feedback_orphan_images');
    if (error) { setCleanMsg('Not authorized or failed to check.'); return; }
    const names = (data || []).map((d: any) => d.name);
    if (!names.length) { setCleanMsg('No orphaned uploads found.'); return; }
    const { error: rmErr } = await supabase.storage.from(FEEDBACK_BUCKET).remove(names);
    setCleanMsg(rmErr ? 'Could not remove some files.' : `Removed ${names.length} orphaned upload(s).`);
  };

  const visible = onlyUnanswered ? rows.filter((r) => !(Array.isArray(r.feedback_replies) ? r.feedback_replies[0] : r.feedback_replies)) : rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-white">Customer Feedback</h2>
          <p className="text-xs text-emerald-300/70">Newest first. Hidden posts stay here for reference and never show publicly.</p>
        </div>
        <button type="button" onClick={cleanOrphans} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-800/60 px-3 py-2 text-[11px] font-extrabold text-emerald-200 hover:border-lime-400/50 cursor-pointer">
          <Trash2 width={13} height={13} /> Clean up unused uploads
        </button>
      </div>
      {cleanMsg && <p className="text-xs text-emerald-300">{cleanMsg}</p>}

      <div className="flex flex-wrap gap-2">
        {RATINGS.map((n) => <button key={n} type="button" onClick={() => setRating(n)} className={chip(rating === n)}>{n === 0 ? 'All Ratings' : `${n} ${n === 1 ? 'Star' : 'Stars'}`}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => <button key={s.key} type="button" onClick={() => setStatus(s.key)} className={chip(status === s.key)}>{s.label}</button>)}
        <label className="ml-1 inline-flex items-center gap-2 text-xs font-bold text-emerald-200 cursor-pointer">
          <input type="checkbox" checked={onlyUnanswered} onChange={(e) => setOnlyUnanswered(e.target.checked)} /> Needs reply only
        </label>
      </div>

      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/60 p-3 text-sm text-red-300"><AlertTriangle width={16} height={16} /> {error}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-emerald-300/80"><Loader2 className="animate-spin" width={18} height={18} /> Loading…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-800/60 py-12 text-center text-sm text-emerald-200"><MessageSquare className="mx-auto mb-2 text-emerald-700" width={26} height={26} />No feedback matches these filters.</div>
      ) : (
        <>
          {visible.map((p) => <FeedbackRow key={p.id} post={p} urlMap={urlMap} onOpenPhoto={(urls, index) => setLightbox({ urls, index })} onChanged={replace} onDeleted={removeRow} />)}
          {hasMore && (
            <button type="button" onClick={loadMore} disabled={loadingMore} className="mx-auto flex items-center gap-2 rounded-xl border border-emerald-800/60 bg-[#061c16] px-5 py-2.5 text-xs font-extrabold text-emerald-200 disabled:opacity-60 cursor-pointer">
              {loadingMore && <Loader2 className="animate-spin" width={14} height={14} />} Load more
            </button>
          )}
        </>
      )}
      <Lightbox urls={lightbox.urls} index={lightbox.index} onClose={() => setLightbox({ urls: [], index: null })} onIndex={(i) => setLightbox((l) => ({ ...l, index: i }))} />
    </div>
  );
}
