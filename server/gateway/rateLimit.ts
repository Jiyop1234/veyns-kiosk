// Small fixed-window rate limiter, kept in memory.
// LIMIT OF THIS DESIGN: every serverless instance has its own counters, and counters reset on a cold start.
// It is a cheap first wall against floods. Routes that need a hard limit (login-check) keep their
// database-backed limiter and the gateway will call it in Step 4C.
export interface RateResult { allowed: boolean; retryAfterSeconds: number }

export function createRateLimiter(now: () => number = Date.now) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function prune(t: number) {
    if (buckets.size < 5000) return;
    for (const [k, v] of buckets) if (v.resetAt <= t) buckets.delete(k);
    if (buckets.size >= 5000) buckets.clear(); // last resort: forget everything rather than grow without bound
  }

  return function hit(key: string, max: number, windowSeconds: number): RateResult {
    const t = now();
    prune(t);
    const b = buckets.get(key);
    if (!b || b.resetAt <= t) {
      buckets.set(key, { count: 1, resetAt: t + windowSeconds * 1000 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    b.count += 1;
    if (b.count > max) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - t) / 1000)) };
    return { allowed: true, retryAfterSeconds: 0 };
  };
}
