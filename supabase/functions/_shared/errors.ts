import { isApiErrorCode } from '@ai-crm/shared';
import { ApiError } from './http.ts';

export interface PgError {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

const VALIDATION_APP_CODES = new Set([
  'invalid_timezone',
  'invalid_country',
  'invalid_role',
  'invalid_token',
  'invalid_target',
]);

/**
 * Maps database errors to the API envelope. The DB raises `app:<code>` (0015),
 * `plan_limit:<key>:<limit>` / `plan_feature:<key>` (CLAUDE.md → HTTP 402).
 * Unknown errors become `internal` (the caller logs the original).
 */
export function mapDbError(error: PgError): ApiError {
  const msg = error.message ?? '';
  if (msg.startsWith('app:')) {
    const code = msg.slice(4);
    if (VALIDATION_APP_CODES.has(code)) return new ApiError('validation_failed', { reason: code });
    if (isApiErrorCode(code) && code !== 'internal') return new ApiError(code);
    return new ApiError('internal');
  }
  if (msg.startsWith('plan_limit:')) {
    const [, key, limit] = msg.split(':');
    return new ApiError('plan_limit_reached', { entitlement: key, limit: Number(limit) });
  }
  if (msg.startsWith('plan_feature:')) {
    return new ApiError('feature_not_in_plan', { entitlement: msg.slice('plan_feature:'.length) });
  }
  switch (error.code) {
    case '23505':
      return new ApiError('conflict');
    case '23514':
    case '23502':
    case '22P02':
    case '22023':
    case '22001':
      return new ApiError('validation_failed');
    case '42501':
      return new ApiError('forbidden');
    default:
      return new ApiError('internal');
  }
}
