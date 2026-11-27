import type { Ctx } from '../app.ts';
import { mapDbError } from '../../_shared/errors.ts';
import { ApiError } from '../../_shared/http.ts';
import { enforceRateLimit, type RateLimitRule } from '../../_shared/rate-limit.ts';

export const LIMITS = {
  createWorkspace: { limit: 10, windowSeconds: 3600 },
  slugCheck: { limit: 120, windowSeconds: 600 },
  invite: { limit: 30, windowSeconds: 3600 },
  // Security review L3: cap what one workspace / one recipient / one link can trigger per day.
  inviteWorkspaceDaily: { limit: 50, windowSeconds: 86_400 },
  inviteRecipientDaily: { limit: 5, windowSeconds: 86_400 },
  renewDaily: { limit: 5, windowSeconds: 86_400 },
  preview: { limit: 30, windowSeconds: 600 },
  previewGlobal: { limit: 3000, windowSeconds: 600 },
  accept: { limit: 20, windowSeconds: 600 },
  members: { limit: 60, windowSeconds: 600 },
} satisfies Record<string, RateLimitRule>;

export async function limit(ctx: Ctx, bucket: string, rule: RateLimitRule): Promise<void> {
  try {
    await enforceRateLimit(ctx.deps.db, bucket, rule);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    ctx.log.log('warn', 'rate limiter unavailable', { bucket: bucket.split(':')[0] });
  }
}

/** Calls an RPC and maps DB errors to the API envelope. */
export async function rpc<T>(ctx: Ctx, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await ctx.deps.db.rpc<T>(fn, args);
  if (error) {
    const mapped = mapDbError(error);
    if (mapped.code === 'internal') {
      ctx.log.log('error', 'rpc failed', {
        fn,
        code: error.code,
        message: error.message.slice(0, 200),
      });
    }
    throw mapped;
  }
  return data as T;
}
