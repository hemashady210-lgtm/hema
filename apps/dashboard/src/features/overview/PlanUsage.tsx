import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CalendarClock, Sparkles, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '@/app/preferences';
import { SpotlightCard } from '@/components/effects/glow';
import { NumberTicker } from '@/components/effects/number-ticker';
import { ShimmerButton } from '@/components/effects/shimmer-button';
import { UsageMeter } from '@/components/usage-meter';
import { Badge, Skeleton } from '@/components/ui/misc';
import { useAiReplyUsage, useSeatUsage } from '@/features/billing/usage';
import { useWorkspace } from '@/features/workspaces/context';
import { useSubscription } from '@/features/workspaces/queries';
import { daysUntil, formatDate } from '@/lib/format';

/**
 * "Plan & usage" (DECISIONS H6): three real numbers from the workspace's subscription,
 * entitlements and usage period — the only KPIs P3 can show truthfully. Counters animate once
 * on screen (static under reduced motion); every value is also plain text for screen readers.
 */
export function PlanUsage() {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const { locale } = usePreferences();
  // Latin digits (profiles.numeral_style default); the auth profile doesn't load that column yet.
  const numerals = 'latin' as const;
  const sub = useSubscription(workspace.id);
  const seats = useSeatUsage(workspace.id);
  const ai = useAiReplyUsage(workspace.id);
  const trialing = sub.data?.status === 'trialing' && !!sub.data.trial_ends_at;
  const days = trialing ? Math.max(daysUntil(sub.data!.trial_ends_at!), 0) : 0;
  const n = (value: number) => <NumberTicker value={value} locale={locale} numerals={numerals} />;
  const fmt = (value: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en').format(value);

  return (
    <section aria-labelledby="plan-usage-title" className="flex flex-col gap-4">
      <h2 id="plan-usage-title" className="text-title-3 font-semibold">
        {t('overview.usage.title')}
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi
          icon={CalendarClock}
          label={trialing ? t('overview.usage.trial') : t('overview.usage.plan')}
          loading={sub.isLoading}
          testId="kpi-plan"
        >
          {workspace.status !== 'active' ? (
            <Badge tone="danger" dot>
              {t('shell.readOnly')}
            </Badge>
          ) : trialing ? (
            <>
              <Value>
                {n(days)}
                <Unit>{t('overview.usage.daysLeft', { count: days })}</Unit>
              </Value>
              <p className="text-footnote text-text-tertiary">
                {t('overview.usage.endsOn', {
                  date: formatDate(sub.data!.trial_ends_at!, locale),
                })}
              </p>
            </>
          ) : (
            <>
              <Value>
                <span className="text-title-2 font-semibold">{t('overview.usage.active')}</span>
              </Value>
              {sub.data?.current_period_end ? (
                <p className="text-footnote text-text-tertiary">
                  {t('overview.usage.renewsOn', {
                    date: formatDate(sub.data.current_period_end, locale),
                  })}
                </p>
              ) : null}
            </>
          )}
          <ShimmerButton asChild size="sm" className="mt-1 self-start">
            <Link to={`/w/${workspace.slug}/billing`}>{t('overview.usage.viewPlans')}</Link>
          </ShimmerButton>
        </Kpi>

        <Kpi
          icon={UsersRound}
          label={t('overview.usage.seats')}
          loading={seats.loading}
          testId="kpi-seats"
        >
          <Value>
            {n(seats.used)}
            <Unit>
              {seats.limit === null
                ? t('overview.usage.unlimited')
                : t('overview.usage.ofLimit', { limit: fmt(seats.limit) })}
            </Unit>
          </Value>
          <UsageMeter
            value={seats.used}
            max={seats.limit}
            label={t('overview.usage.seats')}
            valueText={
              seats.limit === null
                ? fmt(seats.used)
                : t('members.seats', { used: fmt(seats.used), limit: fmt(seats.limit) })
            }
          />
          <p className="text-footnote text-text-tertiary">
            {seats.includesInvites ? t('members.seatsHelp') : t('overview.usage.seatsMembersOnly')}
          </p>
        </Kpi>

        <Kpi
          icon={Sparkles}
          label={t('overview.usage.aiReplies')}
          loading={ai.loading}
          testId="kpi-ai"
        >
          <Value>
            {n(ai.used)}
            <Unit>
              {ai.limit === null
                ? t('overview.usage.unlimited')
                : t('overview.usage.ofLimit', { limit: fmt(ai.limit) })}
            </Unit>
          </Value>
          <UsageMeter
            value={ai.used}
            max={ai.limit}
            label={t('overview.usage.aiReplies')}
            valueText={ai.limit === null ? fmt(ai.used) : `${fmt(ai.used)} / ${fmt(ai.limit)}`}
          />
          <p className="text-footnote text-text-tertiary">{t('overview.usage.aiHelp')}</p>
        </Kpi>
      </div>
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  loading,
  testId,
  children,
}: {
  icon: typeof CalendarClock;
  label: string;
  loading: boolean;
  testId: string;
  children: ReactNode;
}) {
  return (
    <SpotlightCard className="surface-card rounded-2xl border p-5" data-testid={testId}>
      <div className="flex h-full flex-col gap-3">
        <p className="flex items-center gap-2 text-subheadline font-medium text-text-secondary">
          <Icon
            aria-hidden
            className="size-4 text-royal-300 light:text-primary"
            strokeWidth={1.75}
          />
          {label}
        </p>
        {loading ? (
          <div className="flex flex-col gap-3" aria-hidden>
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        ) : (
          children
        )}
      </div>
    </SpotlightCard>
  );
}

function Value({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-baseline gap-2 text-large-title font-semibold text-text-primary">
      {children}
    </p>
  );
}

function Unit({ children }: { children: ReactNode }) {
  return <span className="text-callout font-normal text-text-secondary">{children}</span>;
}
