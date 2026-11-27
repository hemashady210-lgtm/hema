import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { signUpSchema } from '@ai-crm/shared';
import { usePreferences } from '@/app/preferences';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InlineAlert } from '@/components/inline-alert';
import { errorCode, errorMessage } from '@/lib/errors';
import { fieldError, useZodForm } from '@/lib/forms';
import { supabase } from '@/lib/supabase';
import { useDocumentTitle } from '@/lib/use-document-title';
import { AuthHeading } from './AuthLayout';
import { GoogleButton, callbackUrl, setPasswordPath, useNextPath, withNext } from './shared';

/**
 * Email link first, password second (security review H1): the address is proven before any
 * password exists, so nobody can pre-register someone else's email with their own password.
 * The same confirmation shows whether or not an account already exists (no enumeration).
 */
export function SignUpPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.signUp.title'));
  const navigate = useNavigate();
  const next = useNextPath();
  const [params] = useSearchParams();
  const { locale } = usePreferences();
  const form = useZodForm(signUpSchema, {
    full_name: '',
    email: params.get('email') ?? '',
    accept_terms: false as unknown as true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callbackUrl(setPasswordPath(next)),
        // Display data only (never used for authorization); read by the profile trigger.
        data: { full_name: values.full_name, locale },
      },
    });
    const status = (error as { status?: number } | null)?.status;
    if (error && (status === 429 || errorCode(error) === 'over_email_send_rate_limit')) {
      setFormError(errorMessage(t, error));
      return;
    }
    if (error && status !== undefined && status >= 500) {
      setFormError(errorMessage(t, error));
      return;
    }
    try {
      sessionStorage.setItem('ai-crm.pending-email', values.email);
    } catch {
      /* ignore */
    }
    navigate(withNext('/auth/check-email', next, { email: values.email }), { replace: true });
  });

  return (
    <>
      <AuthHeading title={t('auth.signUp.title')} subtitle={t('auth.signUp.subtitle')} />
      <GoogleButton next={next} />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
        <Field label={t('auth.signUp.fullName')} error={fieldError(t, errors.full_name)}>
          <Input autoComplete="name" dir="auto" {...form.register('full_name')} />
        </Field>
        <Field
          label={t('auth.signUp.email')}
          error={fieldError(t, errors.email)}
          hint={t('auth.signUp.howItWorks')}
        >
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            {...form.register('email')}
          />
        </Field>
        <Controller
          control={form.control}
          name="accept_terms"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-start gap-3 text-callout text-text-secondary">
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  onBlur={field.onBlur}
                  aria-invalid={errors.accept_terms ? true : undefined}
                  aria-describedby={errors.accept_terms ? 'terms-error' : undefined}
                  className="mt-0.5"
                />
                <span>{t('auth.signUp.terms')}</span>
              </label>
              {errors.accept_terms ? (
                <p id="terms-error" role="alert" className="ps-[30px] text-footnote text-danger">
                  {fieldError(t, errors.accept_terms)}
                </p>
              ) : null}
            </div>
          )}
        />
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? t('auth.signUp.submitting') : t('auth.signUp.submit')}
        </Button>
      </form>
      <p className="mt-8 text-callout text-text-secondary">
        {t('auth.signUp.haveAccount')}{' '}
        <Link
          to={withNext('/auth/sign-in', next)}
          className="font-medium text-royal-300 hover:underline light:text-primary"
        >
          {t('auth.signUp.signIn')}
        </Link>
      </p>
    </>
  );
}
