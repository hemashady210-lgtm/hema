// Runtime configuration for Edge Functions. Never log values from here.
//
// Supabase keys (decision F5, docs checked 2026-11-26 — guides/functions/secrets): hosted
// projects inject the new-style `SUPABASE_SECRET_KEYS` / `SUPABASE_PUBLISHABLE_KEYS` (JSON
// dictionaries, key "default"). The CLI's local edge runtime (2.122.1) injects only the legacy
// `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY`, which are used as a fallback.

export interface Env {
  supabaseUrl: string;
  secretKey: string;
  publishableKey: string;
  /** Dashboard origin used in links (invitations). Null on a hosted project until APP_URL is set. */
  appUrl: string | null;
  /** Browser origins allowed by CORS. */
  allowedOrigins: string[];
  resend: { apiKey: string; from: string } | null;
  isLocal: boolean;
}

type Getter = (name: string) => string | undefined;

function fromKeyDictionary(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed['default'] ?? Object.values(parsed)[0];
    return typeof value === 'string' && value ? value : undefined;
  } catch {
    return undefined;
  }
}

function clean(value: string | undefined): string | undefined {
  // The CLI passes an unset `env(X)` reference through as an empty string.
  const v = value?.trim();
  return v && !v.startsWith('env(') ? v : undefined;
}

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : undefined;
  } catch {
    return undefined;
  }
}

const LOCAL_DASHBOARD = 'http://127.0.0.1:5173';

export function loadEnv(get: Getter = (n) => Deno.env.get(n)): Env {
  const supabaseUrl = clean(get('SUPABASE_URL'));
  if (!supabaseUrl) throw new Error('SUPABASE_URL is not set');
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|kong|host\.docker\.internal)(:|\/|$)/.test(
    supabaseUrl,
  );

  const secretKey =
    fromKeyDictionary(get('SUPABASE_SECRET_KEYS')) ??
    clean(get('SUPABASE_SECRET_KEY')) ??
    clean(get('SUPABASE_SERVICE_ROLE_KEY'));
  const publishableKey =
    fromKeyDictionary(get('SUPABASE_PUBLISHABLE_KEYS')) ??
    clean(get('SUPABASE_PUBLISHABLE_KEY')) ??
    clean(get('SUPABASE_ANON_KEY'));
  if (!secretKey || !publishableKey) throw new Error('Supabase API keys are not available');

  // Local development defaults to the Vite origin. A hosted project without APP_URL still boots
  // (health, reads) but refuses to create invitation links (never a link to the wrong host).
  const appUrl = originOf(clean(get('APP_URL'))) ?? (isLocal ? LOCAL_DASHBOARD : null);

  const extra = (clean(get('ALLOWED_ORIGINS')) ?? '')
    .split(',')
    .map((o) => originOf(o.trim()))
    .filter((o): o is string => !!o);
  const allowedOrigins = [
    ...new Set([
      ...(appUrl ? [appUrl] : []),
      ...extra,
      ...(isLocal ? [LOCAL_DASHBOARD, 'http://localhost:5173'] : []),
    ]),
  ];

  const apiKey = clean(get('RESEND_API_KEY'));
  const from = clean(get('RESEND_FROM_EMAIL'));
  return {
    supabaseUrl,
    secretKey,
    publishableKey,
    appUrl,
    allowedOrigins,
    resend: apiKey && from ? { apiKey, from } : null,
    isLocal,
  };
}
