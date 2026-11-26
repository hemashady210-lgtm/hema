import { API_ERRORS, type ApiErrorCode, type Locale } from '@ai-crm/shared';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly details?: Record<string, unknown>,
    readonly headers?: Record<string, string>,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export function requestLocale(req: Request): Locale {
  const header = req.headers.get('accept-language') ?? '';
  const first = header.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : first.startsWith('ar') ? 'ar' : 'en';
}

export function requestId(req: Request): string {
  const incoming = req.headers.get('x-request-id');
  return incoming && /^[A-Za-z0-9_-]{8,64}$/.test(incoming)
    ? incoming
    : `req_${crypto.randomUUID()}`;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function errorResponse(err: ApiError, locale: Locale, reqId: string): Response {
  const spec = API_ERRORS[err.code];
  return json(
    {
      error: {
        code: err.code,
        message: spec[locale],
        ...(err.details ? { details: err.details } : {}),
        request_id: reqId,
      },
    },
    spec.status,
    err.headers ?? {},
  );
}

const ALLOWED_HEADERS = [
  'authorization',
  'apikey',
  'content-type',
  'x-client-info',
  'x-request-id',
  'accept-language',
  'idempotency-key',
].join(', ');

/** CORS for the dashboard origins only (exact match). */
export function corsHeaders(req: Request, allowedOrigins: string[]): Record<string, string> {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = { vary: 'Origin' };
  if (origin && allowedOrigins.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-headers'] = ALLOWED_HEADERS;
    headers['access-control-allow-methods'] = 'GET, POST, PATCH, DELETE, OPTIONS';
    headers['access-control-expose-headers'] = 'x-request-id, retry-after';
    headers['access-control-max-age'] = '600';
  }
  return headers;
}

/**
 * Client address for per-IP rate limits. The first X-Forwarded-For entry is client-controlled,
 * so the entry appended by the nearest proxy (the last one) is used. Which header the Supabase
 * gateway sets is **needs verification**; preview tokens are 256-bit, so this limit only slows
 * scanning.
 */
const IP = /^[0-9a-f:.]{2,45}$/i;

export function clientIp(req: Request): string {
  const fwd = req.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const candidate =
    req.headers.get('cf-connecting-ip')?.trim() ||
    fwd?.[fwd.length - 1] ||
    req.headers.get('x-real-ip')?.trim() ||
    '';
  // Only well-formed addresses become bucket keys (no unbounded attacker-chosen strings).
  return IP.test(candidate) ? candidate.toLowerCase() : 'unknown';
}
