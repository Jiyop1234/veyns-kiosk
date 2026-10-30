// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Star, X, ImagePlus, Loader2, Search, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  FEEDBACK_BUCKET, MAX_PHOTOS, MAX_PHOTO_BYTES, MAX_COMMENT, getGuestToken, sniffImageType, ratingLabel,
} from '@/lib/feedback';

type Photo = { id: string; file: File; preview: string; mime: string; ext: string; path?: string };

export function CreateFeedbackDialog({ open, onOpenChange, currentUser, onPublished }: any) {
  const [menu, setMenu] = useState<any[]>([]);
  const [menuError, setMenuError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);
  const submittingRef = useRef(false);          // blocks double-clicks even before React re-renders
  const submissionKey = useRef(crypto.randomUUID()); // idempotency key: same key => server never duplicates
  const fileInput = useRef<HTMLInputElement>(null);

  const isGuest = !currentUser || currentUser.type === 'guest';

  // Food list comes from the real catalog
  useEffect(() => {
    if (!open || menu.length) return;
    supabase.from('menu_items').select('id,name,category,sort_order').eq('is_available', true).order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) setMenuError('Could not load the menu. Please close and try again.');
        else setMenu(data || []);
      });
  }, [open]);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.preview)), []); // eslint-disable-line

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.filter((m) => !q || m.name.toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q));
  }, [menu, search]);

  const nameOf = (id: string) => menu.find((m) => m.id === id)?.name || id;
  const toggleFood = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const errs: string[] = [];
    const next: Photo[] = [];
    for (const file of Array.from(files)) {
      if (photos.length + next.length >= MAX_PHOTOS) { errs.push(`Only ${MAX_PHOTOS} photos are allowed per post.`); break; }
      if (file.size > MAX_PHOTO_BYTES) { errs.push(`"${file.name}" is larger than 5 MB.`); continue; }
      const type = await sniffImageType(file);
      if (!type) { errs.push(`"${file.name}" is not a JPEG, PNG or WebP image.`); continue; }
      next.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), mime: type.mime, ext: type.ext });
    }
    setPhotos((p) => [...p, ...next]);
    setPhotoErrors(errs);
    if (fileInput.current) fileInput.current.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((p) => { const x = p.find((q) => q.id === id); if (x) URL.revokeObjectURL(x.preview); return p.filter((q) => q.id !== id); });
  };

  const commentLen = comment.length;
  const trimmedEmpty = comment.trim().length === 0;
  const tooLong = commentLen > MAX_COMMENT;

  const problems: string[] = [];
  if (selected.length === 0) problems.push('Select at least one food item.');
  if (rating < 1) problems.push('Choose a star rating.');
  if (trimmedEmpty) problems.push('Write your feedback.');
  if (tooLong) problems.push(`Feedback is limited to ${MAX_COMMENT.toLocaleString()} characters (${commentLen - MAX_COMMENT} too many).`);

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setSelected([]); setRating(0); setComment(''); setPhotos([]); setPhotoErrors([]); setError(''); setTried(false); setSearch(''); setProgress('');
    submissionKey.current = crypto.randomUUID();
  };

  const publish = async () => {
    if (submittingRef.current) return;
    setTried(true); setError('');
    if (problems.length) return;
    submittingRef.current = true; setSubmitting(true);
    try {
      // 1) upload photos (already-uploaded ones are skipped on retry)
      const uploaded: Photo[] = [...photos];
      for (let i = 0; i < uploaded.length; i++) {
        const ph = uploaded[i];
        if (ph.path) continue;
        setProgress(`Uploading photo ${i + 1} of ${uploaded.length}…`);
        const path = `posts/${submissionKey.current}/${crypto.randomUUID()}.${ph.ext}`;
        const { error: upErr } = await supabase.storage.from(FEEDBACK_BUCKET).upload(path, ph.file, { contentType: ph.mime, upsert: false });
        if (upErr) throw new Error(`Photo ${i + 1} failed to upload. ${upErr.message}`);
        ph.path = path;
        setPhotos((cur) => cur.map((c) => (c.id === ph.id ? { ...c, path } : c)));
      }
      // 2) create the post (server re-validates everything)
      setProgress('Publishing…');
      const { data, error: rpcErr } = await supabase.rpc('submit_feedback', {
        p_submission_key: submissionKey.current,
        p_rating: rating,
        p_comment: comment,
        p_item_ids: selected,
        p_photos: uploaded.map((p) => ({ path: p.path })),
        p_guest_token: isGuest ? getGuestToken() : null,
      });
      if (rpcErr || !data?.id) throw new Error(rpcErr?.message || 'The post could not be saved.');
      // 3) only now is it a success
      reset();
      onPublished?.(data);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.'); // draft is kept so the customer can retry
    } finally {
      submittingRef.current = false; setSubmitting(false); setProgress('');
    }
  };

  const shown = hover || rating;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto border-emerald-800/60 bg-[#061c16] p-0 text-white">
        <div className="border-b border-emerald-800/60 px-4 py-3">
          <DialogTitle className="text-base font-extrabold text-white">Create a Post</DialogTitle>
          <DialogDescription className="text-xs text-emerald-300/80">
            Posting as <span className="font-bold text-lime-300">{isGuest ? 'Guest' : currentUser?.name || 'Customer'}</span>
          </DialogDescription>
        </div>

        <div className="space-y-5 px-4 py-4">
          {/* FOOD */}
          <section>
            <label className="mb-1.5 block text-xs font-extrabold text-emerald-100">What did you eat? <span className="text-lime-400">*</span></label>
            {selected.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selected.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full border border-lime-400/50 bg-lime-400/10 py-0.5 pl-2.5 pr-1 text-[11px] font-bold text-lime-300">
                    {nameOf(id)}
                    <button type="button" onClick={() => toggleFood(id)} aria-label={`Remove ${nameOf(id)}`} className="rounded-full p-0.5 hover:bg-lime-400/20 cursor-pointer"><X width={12} height={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative mb-1.5">
              <Search width={14} height={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the menu…" className="w-full rounded-xl border border-emerald-800/60 bg-[#03120d] py-2 pl-8 pr-3 text-xs text-white outline-none focus:border-lime-400/60" />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-emerald-800/60 bg-[#03120d]">
              {menuError ? (
                <p className="p-3 text-xs text-red-300">{menuError}</p>
              ) : menu.length === 0 ? (
                <p className="flex items-center gap-2 p-3 text-xs text-emerald-300/70"><Loader2 className="animate-spin" width={14} height={14} /> Loading menu…</p>
              ) : filteredMenu.length === 0 ? (
                <p className="p-3 text-xs text-emerald-300/70">No menu items match “{search}”.</p>
              ) : (
                filteredMenu.map((m) => {
                  const on = selected.includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggleFood(m.id)} className="flex w-full items-center justify-between gap-2 border-b border-emerald-900/50 px-3 py-2 text-left text-xs last:border-0 hover:bg-[#0d2e26] cursor-pointer">
                      <span className={on ? 'font-bold text-lime-300' : 'text-emerald-100'}>{m.name}</span>
                      <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-lime-400 bg-lime-400 text-black' : 'border-emerald-700'}`}>{on && <Check width={12} height={12} />}</span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* RATING */}
          <section>
            <label className="mb-1.5 block text-xs font-extrabold text-emerald-100">Your rating <span className="text-lime-400">*</span></label>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={ratingLabel(n)} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className="p-0.5 cursor-pointer">
                  <Star width={30} height={30} className={`transition-colors ${n <= shown ? 'fill-[#d4af37] text-[#d4af37]' : 'text-emerald-800'}`} />
                </button>
              ))}
              <span className="ml-2 text-xs font-bold text-emerald-200">{rating ? ratingLabel(rating) : 'Tap a star'}</span>
            </div>
          </section>

          {/* COMMENT */}
          <section>
            <label htmlFor="fb-comment" className="mb-1.5 block text-xs font-extrabold text-emerald-100">Your feedback <span className="text-lime-400">*</span></label>
            <textarea id="fb-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={5} placeholder="How was the taste, serving size, packaging, and overall experience?" className={`w-full resize-y rounded-xl border bg-[#03120d] p-3 text-sm text-white outline-none ${tooLong ? 'border-red-600' : 'border-emerald-800/60 focus:border-lime-400/60'}`} />
            <div className="mt-1 flex justify-between text-[11px]">
              <span className="text-red-300">{tooLong ? `Too long by ${commentLen - MAX_COMMENT} characters.` : ''}</span>
              <span className={tooLong ? 'font-bold text-red-300' : 'text-emerald-300/70'}>{commentLen.toLocaleString()} / {MAX_COMMENT.toLocaleString()}</span>
            </div>
          </section>

          {/* PHOTOS */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-extrabold text-emerald-100">Photos <span className="font-normal text-emerald-300/70">(optional, up to {MAX_PHOTOS}, 5 MB each)</span></label>
              <button type="button" disabled={photos.length >= MAX_PHOTOS || submitting} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-emerald-800/60 px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-200 hover:border-lime-400/50 disabled:opacity-40 cursor-pointer">
                <ImagePlus width={14} height={14} /> Add photos
              </button>
            </div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {photos.map((p) => (
                  <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-emerald-800/60">
                    <img src={p.preview} alt="Selected photo preview" className="h-full w-full object-cover" />
                    {p.path && <span className="absolute bottom-1 left-1 rounded bg-lime-400 px-1 text-[9px] font-extrabold text-black">Uploaded</span>}
                    <button type="button" disabled={submitting} onClick={() => removePhoto(p.id)} aria-label="Remove photo" className="absolute right-1 top-1 rounded-full bg-black/70 p-1 cursor-pointer"><X width={12} height={12} /></button>
                  </div>
                ))}
              </div>
            )}
            {photoErrors.map((m, i) => <p key={i} className="mt-1 text-[11px] text-red-300">{m}</p>)}
          </section>

          {tried && problems.length > 0 && (
            <ul role="alert" className="space-y-0.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              {problems.map((p) => <li key={p}>• {p}</li>)}
            </ul>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-800 bg-red-950/60 p-3 text-xs text-red-300">
              <AlertTriangle width={16} height={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-emerald-800/60 bg-[#061c16] px-4 py-3">
          <span className="text-[11px] text-emerald-300/70">{progress}</span>
          <div className="flex gap-2">
            <button type="button" disabled={submitting} onClick={() => onOpenChange(false)} className="rounded-xl border border-emerald-800/60 px-4 py-2 text-xs font-extrabold text-emerald-200 disabled:opacity-50 cursor-pointer">Cancel</button>
            <button type="button" onClick={publish} disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2 text-xs font-extrabold text-black shadow-lg hover:bg-lime-300 disabled:opacity-60 cursor-pointer">
              {submitting && <Loader2 className="animate-spin" width={14} height={14} />} Publish
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
