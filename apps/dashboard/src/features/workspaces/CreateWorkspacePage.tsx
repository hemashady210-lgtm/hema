import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type Ref,
  lazy,
  Suspense,
} from 'react';
import { Link, useNavigate } from 'react-router';
import { Controller } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CircleAlert, LoaderCircle, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  PRIORITY_COUNTRIES,
  SLUG_PATTERN,
  WORKSPACE_CATEGORIES,
  createWorkspaceSchema,
  slugify,
} from '@ai-crm/shared';
import { useAuth } from '@/app/auth';
import { usePreferences } from '@/app/preferences';
import { BrandMark } from '@/components/brand-mark';
import { useIsDesktop } from '@/components/effects/env';
import { InlineAlert } from '@/components/inline-alert';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeMenu } from '@/components/theme-menu';
import { LocaleSegmented } from '@/components/locale-segmented';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, ApiClientError, fieldIssues } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { countryOptions, deviceTimeZone, pickTimeZone, timeZoneOptions } from '@/lib/format';
import { fieldError, useZodForm } from '@/lib/forms';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';
import { membershipsKey, useMemberships } from './queries';

// Desktop-only live preview (Motion + glow) — kept out of this page's first-visit bundle.
const WorkspacePreview = lazy(() => import('./WorkspacePreview'));

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function CreateWorkspacePage() {
  const { t } = useTranslation();
  useDocumentTitle(t('onboarding.workspace.title'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { locale } = usePreferences();
  const { user, signOut } = useAuth();
  const { data: memberships } = useMemberships();
  const [formError, setFormError] = useState<string | null>(null);
  const slugTouched = useRef(false);
  const zoneTouched = useRef(false);
  const desktop = useIsDesktop();
  const zones = useMemo(() => timeZoneOptions(), []);
  const device = useMemo(() => deviceTimeZone(), []);

  const form = useZodForm(createWorkspaceSchema, {
    name: '',
    slug: '',
    country_code: 'SA',
    timezone: pickTimeZone({ device, zones, country: 'SA' }),
    default_locale: locale,
  });
  const { errors, isSubmitting } = form.formState;
  const name = form.watch('name');
  const slug = form.watch('slug') ?? '';
  const country = form.watch('country_code');
  const preview = form.watch();

  // The device's zone wins and is never overwritten; only without one does the zone follow
  // the chosen country — and never after people pick a zone themselves.
  useEffect(() => {
    if (zoneTouched.current) return;
    const current = form.getValues('timezone');
    const next = pickTimeZone({ device, zones, country, current });
    if (next !== current) form.setValue('timezone', next);
  }, [country, device, form, zones]);

  useEffect(() => {
    if (!slugTouched.current)
      form.setValue('slug', name ? slugify(name) : '', { shouldValidate: !!name });
  }, [name, form]);

  const debouncedSlug = useDebounced(slug.trim().toLowerCase(), 400);
  const slugQuery = useQuery({
    queryKey: ['slug-availability', debouncedSlug],
    enabled: SLUG_PATTERN.test(debouncedSlug),
    queryFn: ({ signal }) =>
      api<{ available: boolean }>(
        `/v1/workspaces/slug-availability?slug=${encodeURIComponent(debouncedSlug)}`,
        { signal },
      ),
    staleTime: 10_000,
  });
  const slugStatus =
    !SLUG_PATTERN.test(debouncedSlug) || debouncedSlug !== slug.trim().toLowerCase()
      ? slug && SLUG_PATTERN.test(slug)
        ? 'checking'
        : 'idle'
      : slugQuery.isFetching
        ? 'checking'
        : slugQuery.data
          ? slugQuery.data.available
            ? 'available'
            : 'taken'
          : 'idle';

  const countries = useMemo(() => countryOptions(locale, PRIORITY_COUNTRIES), [locale]);
  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await api<{ workspace: { slug: string } }>('/v1/workspaces', { body: values });
      await queryClient.invalidateQueries({ queryKey: membershipsKey(user?.id) });
      toast.success(t('onboarding.workspace.created'));
      navigate(`/w/${res.workspace.slug}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'slug_taken') {
        form.setError('slug', { message: t('onboarding.workspace.slugTaken') });
        return;
      }
      const issues = fieldIssues(err);
      if (Object.keys(issues).length) {
        for (const [path, message] of Object.entries(issues)) {
          form.setError(path as 'name', { message });
        }
        return;
      }
      setFormError(errorMessage(t, err));
    }
  });

  const host = typeof window !== 'undefined' ? window.location.host : '';
  const back =
    memberships && memberships.length > 0 ? `/w/${memberships[0]!.workspace.slug}` : null;

  return (
    <div className="min-h-dvh bg-aurora">
      <header className="flex h-14 items-center justify-between gap-3 border-b px-4 sm:px-6">
        <BrandMark />
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeMenu />
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate('/auth/sign-in', { replace: true });
            }}
          >
            <LogOut aria-hidden className="rtl-mirror" />
            <span className="hidden sm:inline">{t('shell.signOut')}</span>
          </Button>
        </div>
      </header>
      <main
        id="main"
        className="mx-auto grid w-full max-w-xl gap-16 px-5 py-10 sm:py-16 lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_360px]"
      >
        <div className="min-w-0">
          {back ? (
            <Link
              to={back}
              className="mb-6 inline-flex items-center gap-1.5 text-callout text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft aria-hidden className="rtl-mirror size-4" />
              {t('common.back')}
            </Link>
          ) : null}
          <div className="mb-8 flex flex-col gap-2">
            <h1 className="text-title-1 font-semibold">{t('onboarding.workspace.title')}</h1>
            <p className="text-callout text-text-secondary">{t('onboarding.workspace.subtitle')}</p>
          </div>
          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
            {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
            <Field label={t('onboarding.workspace.name')} error={fieldError(t, errors.name)}>
              <Input
                autoComplete="organization"
                dir="auto"
                placeholder={t('onboarding.workspace.namePlaceholder')}
                {...form.register('name')}
              />
            </Field>
            <Field
              label={t('onboarding.workspace.slug')}
              error={fieldError(t, errors.slug)}
              hint={t('onboarding.workspace.slugHelp')}
              labelAside={<SlugStatus status={slugStatus} />}
            >
              <SlugInput
                host={host}
                {...form.register('slug', {
                  onChange: () => {
                    slugTouched.current = true;
                  },
                })}
              />
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label={t('onboarding.workspace.category')}
                error={fieldError(t, errors.category)}
              >
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger onBlur={field.onBlur}>
                        <SelectValue placeholder={t('onboarding.workspace.categoryPlaceholder')} />
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
              <Field
                label={t('onboarding.workspace.country')}
                error={fieldError(t, errors.country_code)}
              >
                <Controller
                  control={form.control}
                  name="country_code"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger onBlur={field.onBlur}>
                        <SelectValue placeholder={t('onboarding.workspace.countryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c, i) => (
                          <Fragment key={c.code}>
                            {i === PRIORITY_COUNTRIES.length ? <SelectSeparator /> : null}
                            <SelectItem value={c.code}>{c.name}</SelectItem>
                          </Fragment>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label={t('onboarding.workspace.timezone')}
                error={fieldError(t, errors.timezone)}
              >
                <Controller
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        zoneTouched.current = true;
                        field.onChange(v);
                      }}
                    >
                      {/* The control follows the page direction (chevron at the end in Arabic);
                        zone names are LTR islands. */}
                      <SelectTrigger onBlur={field.onBlur}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((z) => (
                          <SelectItem key={z} value={z}>
                            <span dir="ltr">{z.replace(/_/g, ' ')}</span>
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
                      onChange={field.onChange}
                      label={t('onboarding.workspace.defaultLocale')}
                    />
                  )}
                />
              </Field>
            </div>
            <InlineAlert tone="info">{t('onboarding.workspace.trialNote')}</InlineAlert>
            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              className="w-full sm:w-auto sm:self-start"
            >
              {isSubmitting
                ? t('onboarding.workspace.submitting')
                : t('onboarding.workspace.submit')}
            </Button>
          </form>
        </div>
        {desktop ? (
          <aside className="hidden lg:block">
            <div className="sticky top-10">
              <Suspense fallback={null}>
                <WorkspacePreview host={host} values={{ ...preview, slug }} />
              </Suspense>
            </div>
          </aside>
        ) : null}
      </main>
    </div>
  );
}

function SlugStatus({ status }: { status: 'idle' | 'checking' | 'available' | 'taken' }) {
  const { t } = useTranslation();
  if (status === 'idle') return null;
  const map = {
    checking: {
      icon: LoaderCircle,
      cls: 'text-text-tertiary [&_svg]:animate-spin',
      label: t('onboarding.workspace.slugChecking'),
    },
    available: { icon: Check, cls: 'text-success', label: t('onboarding.workspace.slugAvailable') },
    taken: { icon: CircleAlert, cls: 'text-danger', label: t('onboarding.workspace.slugTaken') },
  } as const;
  const { icon: Icon, cls, label } = map[status];
  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-1 text-footnote', cls)}
      data-testid="slug-status"
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

const SlugInput = ({
  host,
  ...props
}: { host: string } & InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) => (
  <div
    dir="ltr"
    className="flex items-stretch overflow-hidden rounded-md border border-input bg-surface-2 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/25 has-[[aria-invalid=true]]:border-destructive"
  >
    <span className="hidden items-center border-e border-border bg-surface-1 px-3 text-footnote text-text-tertiary sm:flex">
      {host}/w/
    </span>
    <input
      {...props}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      className="h-10 min-w-0 flex-1 bg-transparent px-3 font-mono text-footnote text-text-primary outline-none"
    />
  </div>
);
