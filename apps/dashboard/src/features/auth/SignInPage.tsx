import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { magicLinkSchema, signInSchema } from '@ai-crm/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { InlineAlert } from '@/components/inline-alert';
import { errorCode, errorMessage } from '@/lib/errors';
import { fieldError, useZodForm } from '@/lib/forms';
import { supabase } from '@/lib/supabase';
import { useDocumentTitle } from '@/lib/use-document-title';
import { AuthHeading } from './AuthLayout';
import { GoogleButton, callbackUrl, setPasswordPath, useNextPath, withNext } from './shared';

export function SignInPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.signIn.title'));
  const next = useNextPath();
  return (
    <>
      <AuthHeading title={t('auth.signIn.title')} subtitle={t('auth.signIn.subtitle')} />
      <GoogleButton next={next} />
      <Tabs defaultValue="password">
        <TabsList className="mb-6 w-full">
          <TabsTrigger value="password">{t('auth.signIn.tabPassword')}</TabsTrigger>
          <TabsTrigger value="magic">{t('auth.signIn.tabMagic')}</TabsTrigger>
        </TabsList>
        <TabsContent value="password">
          <PasswordForm next={next} />
        </TabsContent>
        <TabsContent value="magic">
          <MagicLinkForm next={next} />
        </TabsContent>
      </Tabs>
      <p className="mt-8 text-callout text-text-secondary">
        {t('auth.signIn.noAccount')}{' '}
        <Link
          to={withNext('/auth/sign-up', next)}
          className="font-medium text-royal-300 hover:underline light:text-primary"
        >
          {t('auth.signIn.createAccount')}
        </Link>
      </p>
    </>
  );
}

function PasswordForm({ next }: { next: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const form = useZodForm(signInSchema, { email: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setUnconfirmed(null);
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      if (errorCode(error) === 'email_not_confirmed') setUnconfirmed(values.email);
      else setFormError(errorMessage(t, error));
      return;
    }
    navigate(next, { replace: true });
  });

  const resend = async () => {
    if (!unconfirmed) return;
    await supabase.auth.resend({
      type: 'signup',
      email: unconfirmed,
      options: { emailRedirectTo: callbackUrl(setPasswordPath(next)) },
    });
    setResent(true);
  };

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="flex flex-col gap-5"
      aria-describedby={formError ? 'signin-error' : undefined}
    >
      {formError ? (
        <div id="signin-error">
          <InlineAlert tone="danger">{formError}</InlineAlert>
        </div>
      ) : null}
      {unconfirmed ? (
        <InlineAlert
          tone="warning"
          title={t('auth.signIn.unconfirmed')}
          action={
            resent ? (
              <span className="text-footnote text-success">{t('auth.signIn.resent')}</span>
            ) : (
              <Button type="button" variant="link" onClick={resend}>
                {t('auth.signIn.resend')}
              </Button>
            )
          }
        />
      ) : null}
      <Field label={t('auth.signIn.email')} error={fieldError(t, errors.email)}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          {...form.register('email')}
        />
      </Field>
      <Field
        label={t('auth.signIn.password')}
        error={fieldError(t, errors.password)}
        labelAside={
          <Link
            to={withNext('/auth/forgot-password', next)}
            className="text-footnote text-royal-300 hover:underline light:text-primary"
          >
            {t('auth.signIn.forgot')}
          </Link>
        }
      >
        <PasswordInput autoComplete="current-password" {...form.register('password')} />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? t('auth.signIn.submitting') : t('auth.signIn.submit')}
      </Button>
    </form>
  );
}

function MagicLinkForm({ next }: { next: string }) {
  const { t } = useTranslation();
  const form = useZodForm(magicLinkSchema, { email: '' });
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setFormError(null);
    // Existing accounts only; the same message is shown either way (no account enumeration).
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: false },
    });
    const code = errorCode(error);
    if (
      error &&
      (code === 'over_email_send_rate_limit' || (error as { status?: number }).status === 429)
    ) {
      setFormError(errorMessage(t, error));
      return;
    }
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <InlineAlert tone="success" title={t('auth.signIn.magicSentTitle')}>
        {t('auth.signIn.magicSentBody', { email: sentTo })}
      </InlineAlert>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
      <Field label={t('auth.signIn.email')} error={fieldError(t, errors.email)}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          {...form.register('email')}
        />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {isSubmitting ? t('auth.signIn.magicSending') : t('auth.signIn.magicSubmit')}
      </Button>
    </form>
  );
}
