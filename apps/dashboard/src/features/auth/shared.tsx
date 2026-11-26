import { useSearchParams } from 'react-router';
import { safeRedirectPath } from '@ai-crm/shared';
import { useTranslation } from 'react-i18next';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export function useNextPath(fallback = '/'): string {
  const [params] = useSearchParams();
  return safeRedirectPath(params.get('next'), fallback);
}

/** Keeps ?next= (and the invite context) when moving between auth pages. */
export function withNext(path: string, next: string, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams(extra);
  if (next && next !== '/') q.set('next', next);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** After an email-link sign-up the user chooses a password, then continues to `next`. */
export function setPasswordPath(next: string): string {
  return `/auth/set-password${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;
}

export function callbackUrl(next: string): string {
  return `${window.location.origin}/auth/callback${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;
}

export function OrDivider() {
  const { t } = useTranslation();
  return (
    <div className="my-6 flex items-center gap-3 text-footnote text-text-tertiary" role="separator">
      <span className="h-px flex-1 bg-border" />
      {t('common.or')}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}

/** Google sign-in (E8): rendered only when VITE_AUTH_GOOGLE_ENABLED=true. */
export function GoogleButton({ next }: { next: string }) {
  const { t } = useTranslation();
  if (!env.googleEnabled) return null;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={() =>
          void supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: callbackUrl(next) },
          })
        }
      >
        <GoogleGlyph />
        {t('auth.signIn.google')}
      </Button>
      <OrDivider />
    </>
  );
}
