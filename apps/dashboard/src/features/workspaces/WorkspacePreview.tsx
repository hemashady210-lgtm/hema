import { useEffect, useState } from 'react';
import { Building2, Clock3, Globe2, MessagesSquare, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@ai-crm/shared';
import { usePreferences } from '@/app/preferences';
import { GlowBorder } from '@/components/effects/glow';
import { TiltCard } from '@/components/effects/tilt-card';
import { Badge } from '@/components/ui/misc';
import { countryName, initials, intlLocale } from '@/lib/format';

export interface WorkspacePreviewValues {
  name: string;
  slug: string;
  category?: string | undefined;
  country_code?: string | null | undefined;
  timezone?: string | undefined;
  default_locale: Locale;
}

/**
 * Live "workspace card" beside the onboarding form (desktop only, lazy): people see what they are
 * creating as they type (HIG onboarding › "Teach through interactivity"). Decorative duplicate of
 * the form's values, so it is hidden from assistive technology; the form stays the source.
 */
export default function WorkspacePreview({
  values,
  host,
}: {
  values: WorkspacePreviewValues;
  host: string;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const time = useLocalTime(values.timezone, locale);
  const name = values.name.trim() || t('onboarding.workspace.preview.namePending');
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <p className="text-footnote text-text-tertiary">
        {t('onboarding.workspace.preview.label')} · {t('onboarding.workspace.preview.caption')}
      </p>
      <TiltCard>
        <GlowBorder className="rounded-3xl">
          <div className="surface-card relative overflow-hidden rounded-3xl border p-6">
            <div
              aria-hidden
              className="decor-light pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-[radial-gradient(closest-side,rgb(61_99_240/0.28),transparent)]"
            />
            <div className="relative flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(145deg,#5a7bff,#2747d1)] text-title-3 font-semibold text-white shadow-glow">
                {values.name.trim() ? (
                  initials(values.name)
                ) : (
                  <Building2 className="size-6" strokeWidth={1.75} />
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p dir="auto" className="truncate text-title-3 font-semibold text-text-primary">
                  {name}
                </p>
                <p
                  dir="ltr"
                  className="truncate text-start font-mono text-footnote text-text-tertiary"
                >
                  {host}/w/{values.slug || '…'}
                </p>
              </div>
            </div>
            <dl className="relative mt-6 grid gap-3 border-t pt-5 text-callout text-text-secondary">
              <Row icon={Store}>
                {values.category
                  ? t(`onboarding.categories.${values.category}` as 'onboarding.categories.other')
                  : '—'}
              </Row>
              <Row icon={Globe2}>
                {values.country_code ? countryName(values.country_code, locale) : '—'}
              </Row>
              <Row icon={Clock3}>
                <span dir="ltr">{values.timezone?.replace(/_/g, ' ') ?? '—'}</span>
                {time ? (
                  <span className="text-text-tertiary">
                    {' · '}
                    {t('onboarding.workspace.preview.localTime', { time })}
                  </span>
                ) : null}
              </Row>
              <Row icon={MessagesSquare}>
                {t('onboarding.workspace.preview.customers', {
                  language: t(`language.${values.default_locale}`),
                })}
              </Row>
            </dl>
            <div className="relative mt-6">
              <Badge tone="info" dot>
                {t('onboarding.workspace.preview.trial')}
              </Badge>
            </div>
          </div>
        </GlowBorder>
      </TiltCard>
    </div>
  );
}

function Row({ icon: Icon, children }: { icon: typeof Store; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Icon aria-hidden className="size-4 shrink-0 text-text-tertiary" />
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}

/** Current time in the chosen zone, refreshed each minute (helps confirm the zone is right). */
function useLocalTime(zone: string | undefined, locale: Locale): string | null {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!zone) return null;
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      timeZone: zone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(now);
  } catch {
    return null;
  }
}
