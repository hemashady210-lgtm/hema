import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { MailCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/inline-alert';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useDocumentTitle } from '@/lib/use-document-title';
import { AuthHeading } from './AuthLayout';
import { callbackUrl, useNextPath, withNext } from './shared';

export function CheckEmailPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.checkEmail.title'));
  const [params] = useSearchParams();
  const next = useNextPath();
  const email = params.get('email') ?? safeSession('ai-crm.pending-email') ?? '';
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    setState('sending');
    setError(null);
    const { error: e } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: callbackUrl(next) },
    });
    if (e) {
      setError(errorMessage(t, e));
      setState('idle');
    } else setState('sent');
  };

  return (
    <>
      <span className="mb-6 grid size-12 place-items-center rounded-xl bg-primary/12 text-royal-300 ring-1 ring-primary/30 light:text-primary">
        <MailCheck aria-hidden className="size-6" strokeWidth={1.5} />
      </span>
      <AuthHeading
        title={t('auth.checkEmail.title')}
        subtitle={<span>{t('auth.checkEmail.body', { email: '⁨' + email + '⁩' })}</span>}
      />
      <div className="flex flex-col gap-4">
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
        <p className="text-callout text-text-secondary">{t('auth.checkEmail.noEmail')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={resend}
            loading={state === 'sending'}
            disabled={!email || state === 'sent'}
          >
            {state === 'sending' ? t('auth.checkEmail.resending') : t('auth.checkEmail.resend')}
          </Button>
          {state === 'sent' ? (
            <span role="status" className="text-footnote text-success">
              {t('auth.checkEmail.resent')}
            </span>
          ) : null}
        </div>
        <Link
          to={withNext('/auth/sign-up', next)}
          className="text-callout text-royal-300 hover:underline light:text-primary"
        >
          {t('auth.checkEmail.useAnother')}
        </Link>
      </div>
    </>
  );
}

function safeSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
