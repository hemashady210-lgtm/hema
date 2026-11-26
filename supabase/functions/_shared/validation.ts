import type { z } from 'zod';
import { ApiError } from './http.ts';

const MAX_BODY_BYTES = 16 * 1024;

/** Reads a JSON body (≤ 16 KB) and validates it; issues carry i18n keys as messages. */
export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.output<T>> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new ApiError('validation_failed', { reason: 'content_type' });
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new ApiError('validation_failed', { reason: 'body_too_large' });
  }
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError('validation_failed', { reason: 'invalid_json' });
  }
  return parseWith(schema, raw);
}

export function parseWith<T extends z.ZodType>(schema: T, raw: unknown): z.output<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError('validation_failed', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Path ids that are not UUIDs are reported as not found (no information leak). */
export function requireUuid(value: string | undefined): string {
  if (!value || !UUID.test(value)) throw new ApiError('not_found');
  return value.toLowerCase();
}
