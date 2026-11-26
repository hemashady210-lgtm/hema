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
import { errorMessage } from '@/lib/errors';
import { fieldError, useZodForm } from '@/lib/forms';
import { supabase } from '@/lib/supabase';
import { useDocumentTitle } from '@/lib/use-document-title';
import { AuthHeading } from './AuthLayout';

/** Opened from the reset email (PKCE: the code in the URL is exchanged for a recovery session). */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.reset.title'));
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const form = useZodForm(resetPasswordSchema, { password: '', confirm: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const { errors, isSubmitting } = form.formState;

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
        <AuthHeading title={t('auth.reset.title')} />
        <InlineAlert tone="danger">{t('auth.reset.invalid')}</InlineAlert>
        <Link
          to="/auth/forgot-password"
          className="mt-6 inline-block text-callout text-royal-300 hover:underline light:text-primary"
        >
          {t('auth.reset.requestNew')}
        </Link>
      </>
    );
  }

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setFormError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError(errorMessage(t, error));
      return;
    }
    toast.success(t('auth.reset.done'));
    navigate('/', { replace: true });
  });

  return (
    <>
      <AuthHeading title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')} />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
        <Field
          label={t('auth.reset.password')}
          error={fieldError(t, errors.password)}
          hint={t('auth.signUp.passwordHint')}
        >
          <PasswordInput autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Field label={t('auth.reset.confirm')} error={fieldError(t, errors.confirm)}>
          <PasswordInput autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {isSubmitting ? t('auth.reset.submitting') : t('auth.reset.submit')}
        </Button>
      </form>
    </>
  );
}
