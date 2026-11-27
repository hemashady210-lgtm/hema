import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CalendarClock, CircleAlert, Sparkles, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '@/app/preferences';
import { SpotlightCard } from '@/components/effects/glow';
import { NumberTicker } from '@/components/effects/number-ticker';
import { ShimmerButton } from '@/components/effects/shimmer-button';
import { UsageMeter } from '@/components/usage-meter';
import { Button } from '@/components/ui/button';
import { Badge, Skeleton } from '@/components/ui/misc';
import { useAiReplyUsage, useSeatUsage } from '@/features/billing/usage';
import { useWorkspace } from '@/features/workspaces/context';
import { useSubscription } from '@/features/workspaces/queries';
import { daysUntil, formatDate } from '@/lib/format';

/** Subscription status → badge (DESIGN_SYSTEM §8 status language). */
const STATUS_TONE = {
  active: 'success',
  past_due: 'warning',
  grace: 'warning',
  suspended: 'danger',
} as const;
type PaidStatus = keyof typeof STATUS_TONE;
const isPaidStatus = (s: string): s is PaidStatus => s in STATUS_TONE;

/**
 * "Plan & usage" (DECISIONS H6): real numbers from the workspace's subscription, entitlements
 * and usage period. Every card has explicit loading, error (with retry) and empty states — a
 * failed or empty query never renders a default such as "Active", "0" or "no limit"
 * (CLAUDE.md: never fake a status). Counters animate once on screen (static under reduced
 * motion); every value is also plain text for screen readers.
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
  const n = (value: number) => <NumberTicker value={value} locale={locale} numerals={numerals} />;
  const fmt = (value: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en').format(value);

  const s = sub.data;
  const trialing = s?.status === 'trialing';

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
          error={sub.error}
          onRetry={() => void sub.refetch()}
          testId="kpi-plan"
        >
          {workspace.status !== 'active' ? (
            <Badge tone="danger" dot className="self-start">
              {t('shell.readOnly')}
            </Badge>
          ) : !s ? (
            <Empty>{t('overview.usage.noPlan')}</Empty>
          ) : trialing ? (
            s.trial_ends_at ? (
              <>
                <Value>
                  {n(Math.max(daysUntil(s.trial_ends_at), 0))}
                  <Unit>
                    {t('overview.usage.daysLeft', {
                      count: Math.max(daysUntil(s.trial_ends_at), 0),
                    })}
                  </Unit>
                </Value>
                <p className="text-footnote text-text-tertiary">
                  {t('overview.usage.endsOn', { date: formatDate(s.trial_ends_at, locale) })}
                </p>
              </>
            ) : (
              <Badge tone="info" dot className="self-start">
                {t('overview.usage.trial')}
              </Badge>
            )
          ) : isPaidStatus(s.status) ? (
            <>
              <Badge tone={STATUS_TONE[s.status]} dot className="self-start">
                {t(`overview.usage.status.${s.status}`)}
              </Badge>
              {s.status === 'active' && s.current_period_end ? (
                <p className="text-footnote text-text-tertiary">
                  {t('overview.usage.renewsOn', { date: formatDate(s.current_period_end, locale) })}
                </p>
              ) : null}
            </>
          ) : (
            <Empty>{t('overview.usage.noPlan')}</Empty>
          )}
          <ShimmerButton asChild size="sm" className="mt-1 self-start">
            <Link to={`/w/${workspace.slug}/billing`}>{t('overview.usage.viewPlans')}</Link>
          </ShimmerButton>
        </Kpi>

        <Kpi
          icon={UsersRound}
          label={t('overview.usage.seats')}
          loading={seats.loading}
          error={seats.error}
          onRetry={seats.refetch}
          testId="kpi-seats"
        >
          {seats.members === 0 ? (
            <Empty>{t('overview.usage.noMembers')}</Empty>
          ) : (
            <>
              <Value>
                {n(seats.used)}
                <Unit>
                  {!seats.limitKnown
                    ? t('overview.usage.limitUnknown')
                    : seats.limit === null
                      ? t('overview.usage.unlimited')
                      : t('overview.usage.ofLimit', { limit: fmt(seats.limit) })}
                </Unit>
              </Value>
              {seats.limitKnown && seats.limit !== null ? (
                <UsageMeter
                  value={seats.used}
                  max={seats.limit}
                  label={t('overview.usage.seats')}
                  valueText={t('members.seats', {
                    used: fmt(seats.used),
                    limit: fmt(seats.limit),
                  })}
                />
              ) : null}
              <p className="text-footnote text-text-tertiary">
                {seats.includesInvites
                  ? t('members.seatsHelp')
                  : t('overview.usage.seatsMembersOnly')}
              </p>
            </>
          )}
        </Kpi>

        <Kpi
          icon={Sparkles}
          label={t('overview.usage.aiReplies')}
          loading={ai.loading}
          error={ai.error}
          onRetry={ai.refetch}
          testId="kpi-ai"
        >
          {ai.period === null || ai.used === null ? (
            // No metered reply yet this period: an empty state, plus the real allowance.
            <>
              <Empty>{t('overview.usage.aiNone')}</Empty>
              <p className="text-footnote text-text-tertiary">
                {!ai.limitKnown
                  ? t('overview.usage.limitUnknown')
                  : ai.limit === null
                    ? t('overview.usage.aiAllowanceUnlimited')
                    : t('overview.usage.aiAllowance', { limit: fmt(ai.limit) })}
              </p>
            </>
          ) : (
            <>
              <Value>
                {n(ai.used)}
                <Unit>
                  {ai.limit === null
                    ? t('overview.usage.unlimited')
                    : t('overview.usage.ofLimit', { limit: fmt(ai.limit) })}
                </Unit>
              </Value>
              {ai.limit !== null ? (
                <UsageMeter
                  value={ai.used}
                  max={ai.limit}
                  label={t('overview.usage.aiReplies')}
                  valueText={`${fmt(ai.used)} / ${fmt(ai.limit)}`}
                />
              ) : null}
              <p className="text-footnote text-text-tertiary">{t('overview.usage.aiHelp')}</p>
            </>
          )}
        </Kpi>
      </div>
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  loading,
  error,
  onRetry,
  testId,
  children,
}: {
  icon: typeof CalendarClock;
  label: string;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  testId: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
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
        ) : error ? (
          <div role="alert" className="flex flex-col items-start gap-3" data-state="error">
            <p className="flex items-start gap-2 text-callout text-text-secondary">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              {t('overview.usage.loadError')}
            </p>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {t('common.retry')}
            </Button>
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

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="text-headline font-semibold text-text-primary" data-state="empty">
      {children}
    </p>
  );
}
