import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { passwordStrength, signUpSchema } from '@ai-crm/shared';
import { usePreferences } from '@/app/preferences';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { InlineAlert } from '@/components/inline-alert';
import { errorMessage } from '@/lib/errors';
import { fieldError, useZodForm } from '@/lib/forms';
import { supabase } from '@/lib/supabase';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';
import { AuthHeading } from './AuthLayout';
import { GoogleButton, callbackUrl, useNextPath, withNext } from './shared';

const STRENGTH_TONE = ['bg-surface-3', 'bg-danger', 'bg-warning', 'bg-info', 'bg-success'] as const;
const STRENGTH_KEY = ['tooShort', 'weak', 'fair', 'good', 'strong'] as const;

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
    password: '',
    accept_terms: false as unknown as true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const { errors, isSubmitting } = form.formState;
  const password = form.watch('password') ?? '';
  const strength = passwordStrength(password);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      // Display data only (never used for authorization); picked up by the profile trigger.
      options: {
        emailRedirectTo: callbackUrl(next),
        data: { full_name: values.full_name, locale },
      },
    });
    if (error) {
      setFormError(errorMessage(t, error));
      return;
    }
    if (data.session) {
      navigate(next, { replace: true });
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
        <Field label={t('auth.signUp.email')} error={fieldError(t, errors.email)}>
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            {...form.register('email')}
          />
        </Field>
        <Field
          label={t('auth.signUp.password')}
          error={fieldError(t, errors.password)}
          hint={t('auth.signUp.passwordHint')}
        >
          <PasswordInput autoComplete="new-password" {...form.register('password')} />
        </Field>
        <div className="-mt-2 flex items-center gap-3" aria-live="polite">
          <div className="flex flex-1 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-(--duration-standard)',
                  i <= strength ? STRENGTH_TONE[strength] : 'bg-surface-3',
                )}
              />
            ))}
          </div>
          <span className="min-w-16 text-end text-footnote text-text-tertiary">
            <span className="sr-only">{t('auth.signUp.strength.label')}: </span>
            {password ? t(`auth.signUp.strength.${STRENGTH_KEY[strength]}`) : ''}
          </span>
        </div>
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
