import type { Db } from './db.ts';
import { ApiError } from './http.ts';

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

interface Hit {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
}

/**
 * Fixed-window limit backed by Postgres (`public.hit_rate_limit`, 0015). Fails open on a
 * database error (logged by the caller) so an outage of the limiter never blocks sign-ins.
 */
export async function enforceRateLimit(
  db: Db,
  bucket: string,
  rule: RateLimitRule,
): Promise<number | null> {
  const { data, error } = await db.rpc<Hit[]>('hit_rate_limit', {
    p_bucket: bucket.slice(0, 200),
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });
  if (error || !data?.[0]) return null;
  const hit = data[0];
  if (!hit.allowed) {
    throw new ApiError(
      'rate_limited',
      { retry_after_seconds: hit.retry_after_seconds },
      {
        'retry-after': String(hit.retry_after_seconds),
      },
    );
  }
  return hit.remaining;
}
