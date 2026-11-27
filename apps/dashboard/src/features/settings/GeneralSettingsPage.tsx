import { useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  PRIORITY_COUNTRIES,
  WORKSPACE_CATEGORIES,
  updateWorkspaceSchema,
  type WorkspaceCategory,
} from '@ai-crm/shared';
import { useAuth } from '@/app/auth';
import { usePreferences } from '@/app/preferences';
import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermissions } from '@/features/permissions/use-permissions';
import { useWorkspace } from '@/features/workspaces/context';
import { LocaleSegmented } from '@/components/locale-segmented';
import { membershipsKey } from '@/features/workspaces/queries';
import { errorMessage } from '@/lib/errors';
import { countryOptions, timeZoneOptions } from '@/lib/format';
import { fieldError, useZodForm } from '@/lib/forms';
import { supabase } from '@/lib/supabase';
import { useDocumentTitle } from '@/lib/use-document-title';
import { TransferOwnershipSection } from '@/features/members/TransferOwnership';
import { SettingsSection } from './SettingsLayout';

export function GeneralSettingsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('settings.tabs.general'));
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const { locale } = usePreferences();
  const { canWrite, can } = usePermissions();
  const editable = canWrite('workspace.settings.edit');
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const countries = useMemo(() => countryOptions(locale, PRIORITY_COUNTRIES), [locale]);
  const zones = useMemo(() => timeZoneOptions(), []);
  const category = (WORKSPACE_CATEGORIES as readonly string[]).includes(workspace.category ?? '')
    ? (workspace.category as WorkspaceCategory)
    : 'other';

  const form = useZodForm(updateWorkspaceSchema, {
    name: workspace.name,
    category,
    country_code: workspace.country_code,
    timezone: workspace.timezone,
    default_locale: workspace.default_locale,
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    // Direct write through RLS + column grants (owner/admin, writable workspace).
    const { data, error } = await supabase
      .from('workspaces')
      .update(values)
      .eq('id', workspace.id)
      .select('id');
    if (error || !data?.length) {
      setFormError(errorMessage(t, error ?? { code: 'forbidden' }));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: membershipsKey(user?.id) });
    form.reset(values);
    toast.success(t('settings.general.saved'));
  });

  return (
    <div className="flex flex-col gap-6">
      {!editable ? <InlineAlert tone="info" title={t('settings.general.readOnlyNotice')} /> : null}
      <form noValidate onSubmit={onSubmit}>
        <SettingsSection
          title={t('settings.general.title')}
          description={t('settings.general.subtitle')}
          footer={
            editable ? (
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            ) : null
          }
        >
          <fieldset disabled={!editable} className="flex flex-col gap-5">
            {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
            <Field label={t('onboarding.workspace.name')} error={fieldError(t, errors.name)}>
              <Input dir="auto" {...form.register('name')} />
            </Field>
            <Field label={t('settings.general.url')} hint={t('settings.general.urlHelp')}>
              <div
                dir="ltr"
                className="flex h-10 items-center gap-2 rounded-md border border-border bg-surface-1 px-3 font-mono text-footnote text-text-secondary"
              >
                <Lock aria-hidden className="size-3.5 text-text-tertiary" />
                {window.location.host}/w/{workspace.slug}
              </div>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('onboarding.workspace.category')}>
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!editable}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKSPACE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t(`onboarding.categories.${c}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label={t('onboarding.workspace.country')}>
                <Controller
                  control={form.control}
                  name="country_code"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      disabled={!editable}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('onboarding.workspace.countryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label={t('onboarding.workspace.timezone')}>
                <Controller
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!editable}>
                      <SelectTrigger dir="ltr">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="ltr">
                        {zones.map((z) => (
                          <SelectItem key={z} value={z}>
                            {z.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                label={t('onboarding.workspace.defaultLocale')}
                hint={t('onboarding.workspace.defaultLocaleHelp')}
              >
                <Controller
                  control={form.control}
                  name="default_locale"
                  render={({ field }) => (
                    <LocaleSegmented
                      value={field.value}
                      onChange={editable ? field.onChange : () => {}}
                      label={t('onboarding.workspace.defaultLocale')}
                    />
                  )}
                />
              </Field>
            </div>
          </fieldset>
        </SettingsSection>
      </form>
      {can('workspace.transfer') ? <TransferOwnershipSection /> : null}
    </div>
  );
}
