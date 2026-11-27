import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { resetPasswordSchema } from '@ai-crm/shared';
import { useAuth } from '@/app/auth';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { Skeleton } from '@/components/ui/misc';
import { InlineAlert } from '@/components/inline-alert';
import { PasswordStrength } from '@/components/password-strength';
import { errorMessage } from '@/lib/errors';
import { fieldError, useZodForm } from '@/lib/forms';
import { supabase } from '@/lib/supabase';
import { useDocumentTitle } from '@/lib/use-document-title';
import { AuthHeading } from './AuthLayout';
import { useNextPath } from './shared';

/**
 * `reset`: opened from the reset email (PKCE recovery session).
 * `setup`: first password after the sign-up email link was confirmed.
 * Both save the password, then sign out every other session (security review H1).
 */
export function PasswordPage({ mode }: { mode: 'reset' | 'setup' }) {
  const { t } = useTranslation();
  const copy =
    mode === 'reset'
      ? {
          title: t('auth.reset.title'),
          subtitle: t('auth.reset.subtitle'),
          submit: t('auth.reset.submit'),
          submitting: t('auth.reset.submitting'),
          done: t('auth.reset.done'),
        }
      : {
          title: t('auth.setPassword.title'),
          subtitle: t('auth.setPassword.subtitle'),
          submit: t('auth.setPassword.submit'),
          submitting: t('auth.setPassword.submitting'),
          done: t('auth.setPassword.done'),
        };
  useDocumentTitle(copy.title);
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const next = useNextPath();
  const form = useZodForm(resetPasswordSchema, { password: '', confirm: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const { errors, isSubmitting } = form.formState;
  const password = form.watch('password') ?? '';

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (!session) {
    return (
      <>
        <AuthHeading title={copy.title} />
        <InlineAlert tone="danger">
          {mode === 'reset' ? t('auth.reset.invalid') : t('auth.callback.failedBody')}
        </InlineAlert>
        <Link
          to={mode === 'reset' ? '/auth/forgot-password' : '/auth/sign-in'}
          className="mt-6 inline-block text-callout text-royal-300 hover:underline light:text-primary"
        >
          {mode === 'reset' ? t('auth.reset.requestNew') : t('auth.callback.backToSignIn')}
        </Link>
      </>
    );
  }

  const onSubmit = form.handleSubmit(async ({ password: pw }) => {
    setFormError(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setFormError(errorMessage(t, error));
      return;
    }
    // Any other session (e.g. someone who knew an earlier password) ends now.
    await supabase.auth.signOut({ scope: 'others' });
    toast.success(copy.done);
    navigate(next, { replace: true });
  });

  return (
    <>
      <AuthHeading title={copy.title} subtitle={copy.subtitle} />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
        <Field
          label={t('auth.reset.password')}
          error={fieldError(t, errors.password)}
          hint={t('auth.password.hint')}
        >
          <PasswordInput autoComplete="new-password" {...form.register('password')} />
        </Field>
        <PasswordStrength password={password} />
        <Field label={t('auth.reset.confirm')} error={fieldError(t, errors.confirm)}>
          <PasswordInput autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {isSubmitting ? copy.submitting : copy.submit}
        </Button>
      </form>
    </>
  );
}

export function ResetPasswordPage() {
  return <PasswordPage mode="reset" />;
}

export function SetPasswordPage() {
  return <PasswordPage mode="setup" />;
}
