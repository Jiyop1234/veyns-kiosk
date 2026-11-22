// Gateway route: a signed-in customer posts a feedback review (Step 5F-2).
// POST /api/feedback, body: { submissionKey, rating, comment, itemIds: [menu item ids], photos: [{ path }] }
// The gateway already did: token check, "signed in with a profile" check, global rate limit, body size and JSON check,
// timeout, safe errors. This file does two things only:
//   1. validate and trim the post to the fields the database function reads (anything else is dropped);
//   2. call public.submit_feedback_for(...) with the SERVICE key. The customer id comes from the verified token
//      (ctx.identity.userId), never from the body. The caller IP comes from the gateway (ctx.ip) so the database's
//      per-IP limit sees the real visitor, not the gateway's own address.
// The rating and comment rules, the 1 to 15 food items, the photo check against Storage, the post limits
// (3 per 10 minutes, 15 per day) and the admin-name guard all stay inside the database function.
// The size caps below are only a first wall; the database decides the exact rules (for example the comment length).
// Photos are uploaded by the browser straight to the feedback-images bucket (signed-in users only since 5F-1);
// this route only receives their storage paths.
// Server environment: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (used by server/db/client.ts).
import { HttpError } from '../gateway/errors.js';
import type { RouteContext, RouteDef, RouteResult, ValidationResult } from '../gateway/types.js';

const MAX_ITEMS = 15;
const MAX_PHOTOS = 5;
const MAX_COMMENT_GUARD = 10_000; // first wall only; the database applies the real comment limit

const bad = (msg: string): ValidationResult => ({ ok: false, error: msg });
const isStr = (v: unknown, min: number, max: number) => typeof v === 'string' && v.length >= min && v.length <= max;

export function validateFeedback(body: Record<string, unknown>): ValidationResult {
  const key = body.submissionKey;
  if (!isStr(key, 8, 100)) return bad('Invalid post.');

  const rating = body.rating;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) return bad('Please choose a star rating from 1 to 5.');

  const comment = body.comment;
  if (typeof comment !== 'string' || comment.trim().length === 0) return bad('Please write your feedback.');
  if (comment.length > MAX_COMMENT_GUARD) return bad('Your feedback is too long.');

  const items = body.itemIds;
  if (!Array.isArray(items) || items.length < 1) return bad('Select at least one food item.');
  if (items.length > MAX_ITEMS) return bad(`You can pick up to ${MAX_ITEMS} food items.`);
  if (!items.every((i) => isStr(i, 1, 100))) return bad('Invalid post.');

  const photosIn = body.photos === undefined || body.photos === null ? [] : body.photos;
  if (!Array.isArray(photosIn)) return bad('Invalid post.');
  if (photosIn.length > MAX_PHOTOS) return bad(`Only ${MAX_PHOTOS} photos are allowed per post.`);
  const photos: Array<{ path: string }> = [];
  for (const p of photosIn) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return bad('Invalid post.');
    const path = (p as Record<string, unknown>).path;
    if (!isStr(path, 1, 300)) return bad('Invalid post.');
    photos.push({ path: path as string }); // nothing but the path is kept
  }

  return { ok: true, value: { submissionKey: key, rating, comment, itemIds: items, photos } };
}

export function feedbackRoute(getClient: () => any): RouteDef {
  return {
    method: 'POST',
    path: '/feedback',
    access: 'customer',                          // any signed-in user with a profile
    timeoutMs: 9000,                             // photos are already uploaded; the database also checks them in Storage
    maxBodyBytes: 30_000,                        // text and a few photo paths
    rateLimit: { max: 10, windowSeconds: 60 },   // per caller IP; the database has its own 3 per 10 minutes per account
    validate: validateFeedback,
    handle: (ctx) => handle(ctx, getClient()),
  };
}

async function handle(ctx: RouteContext, admin: any): Promise<RouteResult> {
  const caller = ctx.identity!; // 'customer' route: the gateway guarantees a verified identity
  const b = ctx.body as Record<string, any>;
  const ip = ctx.ip && ctx.ip !== 'unknown' ? ctx.ip : null;

  const { data, error } = await admin.rpc('submit_feedback_for', {
    p_uid: caller.userId,
    p_submission_key: b.submissionKey,
    p_rating: b.rating,
    p_comment: b.comment,
    p_item_ids: b.itemIds,
    p_photos: b.photos,
    p_ip: ip,
  });
  if (error) {
    const code = String(error.code || '');
    const msg = String(error.message || '');
    // P0001 = a message the database function raised on purpose for the customer (too many posts, bad photo, ...).
    if (code === 'P0001') {
      if (msg === 'Sign in required') throw new HttpError(401, 'Sign in required.');
      if (/too many|limit|slow down|wait/i.test(msg)) throw new HttpError(429, msg.slice(0, 300));
      throw new HttpError(400, msg.slice(0, 300) || 'The post could not be saved.');
    }
    // anything else: log a short line (no post text, no IP) and give a safe answer
    console.error(`feedback ${ctx.requestId}: database error ${code}: ${msg.slice(0, 200)}`);
    throw new HttpError(500, 'Your post could not be saved. Please try again.');
  }
  if (!data || !data.id) {
    console.error(`feedback ${ctx.requestId}: the database function returned no post`);
    throw new HttpError(500, 'Your post could not be saved. Please try again.');
  }
  return { status: 200, body: { ok: true, post: data } }; // { id, created_at, duplicate }
}
