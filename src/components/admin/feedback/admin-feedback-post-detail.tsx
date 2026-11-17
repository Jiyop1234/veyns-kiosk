// @ts-nocheck
// VEYNS Admin, Feedback: the selected post (its content and the official reply) and the Moderation Actions and Post Details panels (Step B5).
// The four actions (change status, save reply, delete reply, delete post) are the original code, moved unchanged from admin-feedback-manager.tsx.
// Every post keeps its own component (hidden when it is not the selected one), so a reply you are typing is not lost when you look at another post.
import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, Eye, EyeOff, Clock, Trash2 } from 'lucide-react';
import { formatWhen, Stars, PhotoGrid, OFFICIAL_NAME, FEEDBACK_BUCKET, MAX_COMMENT } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';

export const STATUS_SKIN: Record<string, string> = {
  published: 'bg-lime-400/15 text-lime-300',
  pending: 'bg-amber-400/15 text-amber-300',
  hidden: 'bg-red-500/15 text-red-300',
};

const card = 'rounded-2xl bg-white/[0.04] p-4';
const actionBtn = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

export function AdminFeedbackPostDetail({ post, urlMap, onOpenPhoto, onChanged, onDeleted, visible = true }: any) {
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

  const itemNames = (post.feedback_post_items || []).map((f) => f.item_name_snapshot);
  const initial = (post.is_guest ? 'G' : (post.display_name || '?').trim().charAt(0) || '?').toUpperCase();

  return (
    <>
      {/* The post and the official reply */}
      <section className={`${visible ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col gap-3 ${card}`}>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-lg font-extrabold text-lime-300" aria-hidden="true">{initial}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">
                  {post.is_guest ? 'Guest' : post.display_name}
                  <span className="ml-2 rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-zinc-300">{post.is_guest ? 'Guest' : 'Registered'}</span>
                </p>
                <p className="text-[11px] text-zinc-400">{formatWhen(post.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Stars value={post.rating} />
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_SKIN[post.status]}`}>{post.status}</span>
            </div>
          </div>

          {itemNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {itemNames.map((name, i) => (
                <span key={i} className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11px] font-bold text-lime-300">{name}</span>
              ))}
            </div>
          )}

          <p className="whitespace-pre-wrap break-words text-sm text-zinc-100">{post.comment}</p>
          <PhotoGrid urls={urls} onOpen={(i) => onOpenPhoto(urls.filter(Boolean), urls.slice(0, i).filter(Boolean).length)} />
        </div>

        <div className="shrink-0 rounded-xl bg-white/[0.04] p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-lime-300"><ShieldCheck width={14} height={14} /> Reply as {OFFICIAL_NAME}</span>
            <span className={`text-[10px] font-bold uppercase ${reply ? 'text-lime-400' : 'text-amber-300'}`}>{reply ? 'Replied' : 'Needs reply'}</span>
          </div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Write the official response…" className="w-full resize-none rounded-xl bg-white/[0.06] p-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-400">{draft.length} / {MAX_COMMENT}</span>
              {reply && (
                <button type="button" disabled={busy} onClick={deleteReply} className="text-[11px] font-bold text-red-400 underline disabled:opacity-40 cursor-pointer">Delete reply</button>
              )}
            </div>
            <button type="button" disabled={busy} onClick={saveReply} className="inline-flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2 text-xs font-extrabold text-black hover:bg-lime-300 disabled:opacity-60 cursor-pointer">
              {busy && <Loader2 className="animate-spin" width={14} height={14} />} {reply ? 'Update reply' : 'Publish reply'}
            </button>
          </div>
          {msg && <p className={`mt-2 text-xs ${msg.ok ? 'text-lime-300' : 'text-red-300'}`}>{msg.text}</p>}
        </div>
      </section>

      {/* Moderation Actions and Post Details */}
      <aside className={`${visible ? 'flex' : 'hidden'} min-h-0 flex-col gap-3 overflow-y-auto`}>
        <div className={card}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck width={16} height={16} className="text-lime-300" /> Moderation Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy || post.status === 'published'} onClick={() => setStatus('published')} className={`${actionBtn} bg-lime-400/15 text-lime-300 hover:bg-lime-400/25`}><Eye width={14} height={14} /> Publish</button>
            <button type="button" disabled={busy || post.status === 'pending'} onClick={() => setStatus('pending')} className={`${actionBtn} bg-amber-400/15 text-amber-300 hover:bg-amber-400/25`}><Clock width={14} height={14} /> Mark Pending</button>
            <button type="button" disabled={busy || post.status === 'hidden'} onClick={() => setStatus('hidden')} title="Hide (spam / inappropriate)" className={`${actionBtn} bg-red-500/15 text-red-300 hover:bg-red-500/25`}><EyeOff width={14} height={14} /> Hide Post</button>
            {!confirmDel ? (
              <button type="button" disabled={busy} onClick={() => setConfirmDel(true)} className={`${actionBtn} bg-red-500/15 text-red-300 hover:bg-red-500/25`}><Trash2 width={14} height={14} /> Delete Post</button>
            ) : (
              <span className="col-span-2 flex flex-wrap items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-[11px] text-red-200">
                Permanently delete this post, its photos and reply?
                <button type="button" disabled={busy} onClick={deletePost} className="rounded-md bg-red-600 px-2.5 py-1 font-extrabold text-white disabled:opacity-60 cursor-pointer">{busy ? 'Deleting…' : 'Yes, delete'}</button>
                <button type="button" disabled={busy} onClick={() => setConfirmDel(false)} className="rounded-md bg-white/[0.1] px-2.5 py-1 font-extrabold cursor-pointer">Cancel</button>
              </span>
            )}
          </div>
        </div>

        <div className={card}>
          <h3 className="mb-3 text-sm font-bold text-white">Post Details</h3>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-zinc-400">Posted on</dt><dd className="text-right text-white">{formatWhen(post.created_at)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-zinc-400">Menu item</dt><dd className="text-right text-white">{itemNames.length > 0 ? itemNames.join(', ') : '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-zinc-400">Rating</dt><dd className="text-right text-white">{post.rating} / 5</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-zinc-400">Status</dt><dd className="text-right capitalize text-white">{post.status}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-zinc-400">Photos</dt><dd className="text-right text-white">{photos.length}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-zinc-400">Official reply</dt><dd className="text-right text-white">{reply ? formatWhen(reply.created_at) : 'Not yet'}</dd></div>
          </dl>
        </div>
      </aside>
    </>
  );
}
