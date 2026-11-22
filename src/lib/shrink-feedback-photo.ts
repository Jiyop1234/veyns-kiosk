// Shrinks a customer's feedback photo in the browser before it is uploaded (Step 5F-3).
// Same approach as Menu Manager (P5-B): scale so the long side is at most 1200 px (a small photo is never enlarged),
// save as WebP at quality 80, then 65, then 50 until the file is 1 MB or less. A browser that cannot write WebP
// gets a JPEG with a white background instead. A file that is not an image, is over 25 MB, cannot be opened (for
// example an iPhone HEIC photo on a desktop browser) or is still over 1 MB after shrinking is refused with a message
// that is safe to show to the customer.
export const FEEDBACK_ORIGINAL_MAX_BYTES = 25 * 1024 * 1024;
export const FEEDBACK_SHRUNK_MAX_BYTES = 1024 * 1024;
const MAX_SIDE = 1200;
const QUALITIES = [0.8, 0.65, 0.5];

export interface ShrunkPhoto { file: File; mime: string; ext: string }

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export async function shrinkFeedbackPhoto(file: File): Promise<ShrunkPhoto> {
  const label = `"${file.name}"`;
  if (!file.type.startsWith('image/')) throw new Error(`${label} is not a photo. Please choose a JPG, PNG or WebP.`);
  if (file.size > FEEDBACK_ORIGINAL_MAX_BYTES) throw new Error(`${label} is larger than 25 MB.`);

  let img: HTMLImageElement;
  try { img = await loadImage(file); } catch { throw new Error(`${label} could not be opened. Please use a JPG, PNG or WebP photo.`); }

  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) throw new Error(`${label} could not be opened. Please use a JPG, PNG or WebP photo.`);
  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0)); // never enlarge
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(`${label} could not be prepared. Please try another photo.`);
  ctx.drawImage(img, 0, 0, w, h);

  let blob: Blob | null = null;
  let type = 'image/webp';
  for (const q of QUALITIES) {
    blob = await toBlob(canvas, 'image/webp', q);
    if (!blob || blob.type !== 'image/webp') { blob = null; break; } // this browser cannot write WebP
    if (blob.size <= FEEDBACK_SHRUNK_MAX_BYTES) break;
  }
  if (!blob) {
    // JPEG has no transparency: put the photo on white so transparent parts do not turn black
    type = 'image/jpeg';
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    for (const q of QUALITIES) {
      blob = await toBlob(canvas, 'image/jpeg', q);
      if (blob && blob.size <= FEEDBACK_SHRUNK_MAX_BYTES) break;
    }
  }
  if (!blob) throw new Error(`${label} could not be prepared. Please try another photo.`);
  if (blob.size > FEEDBACK_SHRUNK_MAX_BYTES) throw new Error(`${label} is still too large after shrinking. Please choose a simpler photo.`);

  const ext = type === 'image/webp' ? 'webp' : 'jpg';
  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return { file: new File([blob], `${base}.${ext}`, { type }), mime: type, ext };
}
