import type { TFunction } from 'i18next';
import { ApiClientError } from './api';

const AUTH_CODES = new Set([
  'invalid_credentials',
  'email_not_confirmed',
  'user_already_exists',
  'weak_password',
  'over_email_send_rate_limit',
]);

/** Human message for any error (API envelope, Supabase AuthError, network). */
export function errorMessage(t: TFunction, err: unknown): string {
  if (err instanceof ApiClientError) {
    const key = `errors.${err.code}`;
    return t(key as 'errors.unknown', { defaultValue: t('errors.unknown') });
  }
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && AUTH_CODES.has(code))
    return t(`errors.${code}` as 'errors.unknown');
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 429) return t('errors.rate_limited');
  if (err instanceof TypeError) return t('errors.network');
  return t('errors.unknown');
}

export function errorCode(err: unknown): string | null {
  if (err instanceof ApiClientError) return err.code;
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}
