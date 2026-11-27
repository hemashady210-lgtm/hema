// Client for the `api` Edge Function (docs/API.md). Error envelope → ApiClientError.
import { isApiErrorCode, type ApiErrorBody } from '@ai-crm/shared';
import { i18n } from '@/i18n';
import { env } from './env';
import { supabase } from './supabase';

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(code);
    this.name = 'ApiClientError';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the user's access token (default true; preview works signed out too). */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    apikey: env.supabaseKey,
    'accept-language': i18n.language === 'en' ? 'en' : 'ar',
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.auth !== false) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${env.apiBaseUrl}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : null,
      signal: options.signal ?? null,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiClientError('network', 0);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiClientError('unknown', res.status);
  }
  if (!res.ok) {
    const e = (parsed as Partial<ApiErrorBody> | null)?.error;
    throw new ApiClientError(
      isApiErrorCode(e?.code) ? e!.code : 'unknown',
      res.status,
      e?.details,
      e?.request_id,
    );
  }
  return parsed as T;
}

/** Field-level validation issues from a `validation_failed` envelope. */
export function fieldIssues(err: unknown): Record<string, string> {
  if (!(err instanceof ApiClientError) || err.code !== 'validation_failed') return {};
  const issues = (err.details?.issues as { path: string; message: string }[] | undefined) ?? [];
  return Object.fromEntries(issues.map((i) => [i.path, i.message]));
}
