import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { profileKey, useAuth } from '@/app/auth';
import { usePreferences, type ThemePreference } from '@/app/preferences';
import { InlineAlert } from '@/components/inline-alert';
import { PageHeader } from '@/components/page-header';
import { THEME_ICONS } from '@/components/theme-menu';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SettingsSection } from '@/features/settings/SettingsLayout';
import { LocaleSegmented } from '@/features/workspaces/CreateWorkspacePage';
import { errorMessage } from '@/lib/errors';
import { fieldError, useZodForm } from '@/lib/forms';
import { supabase } from '@/lib/supabase';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';

const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, { error: 'validation.required' })
    .max(120, { error: 'validation.too_long' }),
});

export function AccountPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('account.title'));
  const { user, profile, setLocale, setTheme } = useAuth();
  const { locale, theme } = usePreferences();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useZodForm(profileSchema, { full_name: profile?.full_name ?? '' });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const { error } = await supabase.from('profiles').update(values).eq('id', user!.id);
    if (error) {
      setFormError(errorMessage(t, error));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: profileKey(user?.id) });
    form.reset(values);
    toast.success(t('account.saved'));
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('account.title')} description={t('account.subtitle')} />
      <form noValidate onSubmit={onSubmit}>
        <SettingsSection
          title={t('account.profile')}
          footer={
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          }
        >
          <div className="flex flex-col gap-5">
            {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
            <Field label={t('account.fullName')} error={fieldError(t, errors.full_name)}>
              <Input dir="auto" autoComplete="name" {...form.register('full_name')} />
            </Field>
            <Field label={t('account.email')} hint={t('account.emailHelp')}>
              <Input readOnly value={user?.email ?? ''} dir="ltr" />
            </Field>
          </div>
        </SettingsSection>
      </form>
      <SettingsSection title={t('account.preferences')}>
        <div className="flex flex-col gap-5">
          <Field label={t('language.label')} hint={t('account.languageHelp')}>
            <LocaleSegmented value={locale} onChange={setLocale} label={t('language.label')} />
          </Field>
          <Field label={t('theme.label')}>
            <div role="radiogroup" aria-label={t('theme.label')} className="grid grid-cols-3 gap-2">
              {(['dark', 'light', 'system'] as ThemePreference[]).map((value) => {
                const Icon = THEME_ICONS[value];
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={theme === value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex h-16 flex-col items-center justify-center gap-1.5 rounded-lg border bg-surface-2 text-footnote text-text-secondary transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent',
                      theme === value && 'border-primary bg-primary/10 text-text-primary',
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                    {t(`theme.${value}`)}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </SettingsSection>
    </div>
  );
}
