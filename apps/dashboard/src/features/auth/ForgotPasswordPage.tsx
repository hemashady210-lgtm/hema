import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { forgotPasswordSchema } from '@ai-crm/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InlineAlert } from '@/components/inline-alert';
import { errorMessage } from '@/lib/errors';
import { fieldError, useZodForm } from '@/lib/forms';
import { supabase } from '@/lib/supabase';
import { useDocumentTitle } from '@/lib/use-document-title';
import { AuthHeading } from './AuthLayout';
import { useNextPath, withNext } from './shared';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.forgot.title'));
  const next = useNextPath();
  const form = useZodForm(forgotPasswordSchema, { email: '' });
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setFormError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    // Same confirmation whether or not the account exists; only rate limits are surfaced.
    if (error && (error as { status?: number }).status === 429) {
      setFormError(errorMessage(t, error));
      return;
    }
    setSentTo(email);
  });

  return (
    <>
      <AuthHeading
        title={t('auth.forgot.title')}
        subtitle={sentTo ? undefined : t('auth.forgot.subtitle')}
      />
      {sentTo ? (
        <InlineAlert tone="success" title={t('auth.forgot.sentTitle')}>
          {t('auth.forgot.sentBody', { email: sentTo })}
        </InlineAlert>
      ) : (
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
            {isSubmitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
          </Button>
        </form>
      )}
      <Link
        to={withNext('/auth/sign-in', next)}
        className="mt-8 inline-block text-callout text-royal-300 hover:underline light:text-primary"
      >
        {t('auth.forgot.back')}
      </Link>
    </>
  );
}
