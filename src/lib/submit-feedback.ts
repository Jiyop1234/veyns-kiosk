// Browser helper for POST /api/feedback (Step 5F-2).
// The feedback dialog used to call the database function submit_feedback straight from the browser. It now asks the
// gateway, which checks the login, limits the rate and the size, and then saves the post on the server.
// Photos are still uploaded by the dialog to the feedback-images bucket first; this call only sends their paths.
// Resolves with { id, created_at, duplicate }. Throws an Error whose message is safe to show to the customer.
import { supabase } from '@/lib/supabase';

export interface SubmitFeedbackInput {
  submissionKey: string;
  rating: number;
  comment: string;
  itemIds: string[];
  photoPaths: string[];
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<any> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Please sign in again to post your feedback.');

  let res: Response;
  try {
    res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        submissionKey: input.submissionKey,
        rating: input.rating,
        comment: input.comment,
        itemIds: input.itemIds,
        photos: input.photoPaths.map((path) => ({ path })),
      }),
    });
  } catch {
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }

  let json: any = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || !json?.ok || !json.post?.id) {
    throw new Error(String(json?.error || 'The post could not be saved.'));
  }
  return json.post;
}
