// @ts-nocheck
// Shared helpers + small display components for the Customer Feedback feature (Task 5).
import React, { useEffect } from 'react';
import { Star, ShieldCheck, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

export const FEEDBACK_BUCKET = 'feedback-images';
export const PAGE_SIZE = 10;
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_COMMENT = 1000;
export const OFFICIAL_NAME = 'VEYNS ADMIN'; // fixed constant: the UI never uses a name sent by anyone

// Explicit column list (private columns such as user_id / ip are not readable through the API).
const POST_SELECT =
  'id,display_name,is_guest,rating,comment,status,created_at,' +
  'feedback_post_items(menu_item_id,item_name_snapshot),' +
  'feedback_photos(id,storage_path,created_at),' +
  'feedback_replies(id,body,created_at,updated_at)';

/** One page of posts, newest first, keyset-paginated (no duplicates, no OFFSET). */
export async function fetchFeedbackPage({ rating = null, status = 'published', cursor = null }: any) {
  let q = supabase
    .from('feedback_posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (status) q = q.eq('status', status);
  if (rating) q = q.eq('rating', rating);
  if (cursor) {
    q = q.or(`created_at.lt."${cursor.created_at}",and(created_at.eq."${cursor.created_at}",id.lt.${cursor.id})`);
  }
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []).slice(0, PAGE_SIZE);
  return { rows, hasMore: (data || []).length > PAGE_SIZE };
}

/** Signed URLs for only the photos of the posts currently loaded (bucket is private). */
export async function signPhotoPaths(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return {};
  const { data, error } = await supabase.storage.from(FEEDBACK_BUCKET).createSignedUrls(unique, 60 * 60);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  data.forEach((d: any) => { if (d?.signedUrl && d?.path) out[d.path] = d.signedUrl; });
  return out;
}

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

export const ratingLabel = (n: number) => `${n} ${n === 1 ? 'Star' : 'Stars'}`;

export function getGuestToken() {
  try {
    let t = localStorage.getItem('veyns_feedback_guest_token');
    if (!t) { t = crypto.randomUUID(); localStorage.setItem('veyns_feedback_guest_token', t); }
    return t;
  } catch { return null; }
}

/** Real file-type check from the first bytes (not just the extension / browser-reported type). */
export async function sniffImageType(file: File): Promise<{ mime: string; ext: string } | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { mime: 'image/png', ext: 'png' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

// ---------------------------------------------------------------- UI pieces
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} width={size} height={size} className={n <= value ? 'fill-[#d4af37] text-[#d4af37]' : 'text-emerald-800'} />
      ))}
    </span>
  );
}

export function OfficialReply({ reply }: { reply: any }) {
  return (
    <div className="mt-4 rounded-xl border border-lime-400/40 border-l-4 border-l-lime-400 bg-lime-400/10 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-lime-300">
          <ShieldCheck width={16} height={16} /> {OFFICIAL_NAME}
        </span>
        <span className="text-[11px] text-emerald-300/70">
          {formatWhen(reply.updated_at || reply.created_at)}
          {reply.updated_at && reply.created_at && reply.updated_at !== reply.created_at ? ' (edited)' : ''}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-emerald-50">{reply.body}</p>
    </div>
  );
}

export function PhotoGrid({ urls, onOpen }: { urls: (string | undefined)[]; onOpen: (i: number) => void }) {
  if (!urls.length) return null;
  const cols = urls.length === 1 ? 'grid-cols-1' : urls.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
  return (
    <div className={`mt-3 grid ${cols} gap-1.5`}>
      {urls.map((u, i) => (
        <button
          key={i}
          type="button"
          onClick={() => u && onOpen(i)}
          className={`relative overflow-hidden rounded-xl border border-emerald-800/60 bg-[#0d2e26] cursor-pointer ${urls.length === 1 ? 'aspect-[16/10]' : 'aspect-square'}`}
          aria-label={`Open photo ${i + 1}`}
        >
          {u ? (
            <img src={u} alt={`Customer photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[11px] text-emerald-300/60">Photo unavailable</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Lightbox({ urls, index, onClose, onIndex }: { urls: string[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const open = index !== null && urls.length > 0;
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onIndex((index! - 1 + urls.length) % urls.length);
      if (e.key === 'ArrowRight') onIndex((index! + 1) % urls.length);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, index, urls.length]);
  if (!open) return null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl border-emerald-800/60 bg-[#03120d] p-2 text-white sm:p-3">
        <DialogTitle className="sr-only">Photo {index! + 1} of {urls.length}</DialogTitle>
        <DialogDescription className="sr-only">Enlarged customer photo</DialogDescription>
        <div className="relative flex items-center justify-center">
          <img src={urls[index!]} alt={`Customer photo ${index! + 1}`} className="max-h-[80vh] w-full rounded-lg object-contain" />
          {urls.length > 1 && (
            <>
              <button type="button" onClick={() => onIndex((index! - 1 + urls.length) % urls.length)} className="absolute left-1 rounded-full bg-black/60 p-2 cursor-pointer" aria-label="Previous photo"><ChevronLeft width={20} height={20} /></button>
              <button type="button" onClick={() => onIndex((index! + 1) % urls.length)} className="absolute right-1 rounded-full bg-black/60 p-2 cursor-pointer" aria-label="Next photo"><ChevronRight width={20} height={20} /></button>
            </>
          )}
        </div>
        <p className="text-center text-[11px] text-emerald-300/70">{index! + 1} / {urls.length}</p>
      </DialogContent>
    </Dialog>
  );
}
