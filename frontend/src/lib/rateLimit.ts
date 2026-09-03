// Best-effort, single-process rate limiting for upload-style routes. This is
// an in-memory sliding window: it resets on deploy/restart and does not
// coordinate across multiple server instances. It exists to blunt obvious
// abuse (a runaway client hammering an upload endpoint), not as a substitute
// for a real distributed limiter (e.g. Upstash/Redis) if this app scales to
// multiple instances — swap the implementation, keep the call sites.

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Periodic sweep so long-lived processes don't accumulate one entry per
// distinct key forever.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > windowMs) buckets.delete(key);
  }
}

/**
 * Returns true if `key` is still within `limit` calls per `windowMs`.
 * Call once per request; a false result means the caller should be refused.
 */
export function rateLimitAllow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now, windowMs);
  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}
