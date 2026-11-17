// VEYNS Admin, Feedback: the numbers on the stat cards, worked out from the posts (Step B5).
// Pure functions: no database and no React here, so they can be tested on their own.

export type FeedbackStatsRow = {
  rating: number;
  status: string;
  created_at: string;
  feedback_replies?: { created_at: string } | { created_at: string }[] | null;
};

export type FeedbackStats = {
  total: number;
  average: number | null;
  trend: number | null; // average of the last 30 days minus the average of the 30 days before; null when either has no posts
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>;
  statusCounts: { published: number; pending: number; hidden: number };
  replied: number;
  replyRate: number | null; // whole percent of posts that have an official reply
  avgResponseHours: number | null; // average time from the post to its official reply
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RATINGS: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

function replyOf(row: FeedbackStatsRow): { created_at: string } | null {
  const r = row.feedback_replies;
  if (!r) return null;
  if (Array.isArray(r)) return r.length > 0 ? r[0] : null;
  return r;
}

function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeFeedbackStats(rows: FeedbackStatsRow[], now: number): FeedbackStats {
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const statusCounts = { published: 0, pending: 0, hidden: 0 };
  const ratings: number[] = [];
  const recent: number[] = [];
  const before: number[] = [];
  const responseHours: number[] = [];
  let replied = 0;

  for (const row of rows) {
    const rating = Number(row.rating);
    if (rating >= 1 && rating <= 5) {
      ratingCounts[rating as 1 | 2 | 3 | 4 | 5] += 1;
      ratings.push(rating);
      const at = Date.parse(row.created_at);
      if (!Number.isNaN(at)) {
        if (at <= now && at > now - 30 * DAY_MS) recent.push(rating);
        else if (at <= now - 30 * DAY_MS && at > now - 60 * DAY_MS) before.push(rating);
      }
    }
    if (row.status === 'published' || row.status === 'pending' || row.status === 'hidden') statusCounts[row.status] += 1;
    const reply = replyOf(row);
    if (reply) {
      replied += 1;
      const hours = (Date.parse(reply.created_at) - Date.parse(row.created_at)) / 3600000;
      if (!Number.isNaN(hours) && hours >= 0) responseHours.push(hours);
    }
  }

  const average = averageOf(ratings);
  const recentAvg = averageOf(recent);
  const beforeAvg = averageOf(before);
  const avgResponse = averageOf(responseHours);
  return {
    total: rows.length,
    average: average === null ? null : round1(average),
    trend: recentAvg !== null && beforeAvg !== null ? round1(recentAvg - beforeAvg) : null,
    ratingCounts,
    statusCounts,
    replied,
    replyRate: rows.length > 0 ? Math.round((replied / rows.length) * 100) : null,
    avgResponseHours: avgResponse,
  };
}

export function ratingShare(stats: FeedbackStats | null, rating: 1 | 2 | 3 | 4 | 5): number {
  if (!stats || stats.total === 0) return 0;
  return Math.round((stats.ratingCounts[rating] / stats.total) * 100);
}

export function formatResponseTime(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${(Math.round(hours * 10) / 10).toFixed(1)} hrs`;
  return `${(Math.round((hours / 24) * 10) / 10).toFixed(1)} days`;
}

export { RATINGS as FEEDBACK_RATINGS };
