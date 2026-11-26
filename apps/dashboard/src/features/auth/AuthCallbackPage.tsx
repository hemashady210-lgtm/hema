import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { safeRedirectPath } from '@ai-crm/shared';
import { useAuth } from '@/app/auth';
import { InlineAlert } from '@/components/inline-alert';
import { useDocumentTitle } from '@/lib/use-document-title';
import { AuthHeading } from './AuthLayout';

/**
 * Landing page for email confirmation, magic links and OAuth. supabase-js exchanges the PKCE
 * `code` on load (detectSessionInUrl); this page waits for the session, then continues to ?next.
 */
export function AuthCallbackPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.callback.verifying'));
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeRedirectPath(params.get('next'), '/');
  const urlError = params.get('error_description') ?? params.get('error') ?? hashError();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (session) navigate(next, { replace: true });
  }, [session, next, navigate]);

  useEffect(() => {
    if (urlError) return;
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [urlError]);

  const failed = !!urlError || (!loading && !session && (timedOut || !params.get('code')));
  if (failed) {
    return (
      <>
        <AuthHeading title={t('auth.callback.failedTitle')} />
        <InlineAlert tone="danger">{t('auth.callback.failedBody')}</InlineAlert>
        <Link
          to="/auth/sign-in"
          className="mt-6 inline-block text-callout text-royal-300 hover:underline light:text-primary"
        >
          {t('auth.callback.backToSignIn')}
        </Link>
      </>
    );
  }
  return (
    <div className="flex items-center gap-3 text-callout text-text-secondary" role="status">
      <LoaderCircle aria-hidden className="size-5 animate-spin text-accent" />
      {t('auth.callback.verifying')}
    </div>
  );
}

function hashError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return hash.get('error_description') ?? hash.get('error');
}
