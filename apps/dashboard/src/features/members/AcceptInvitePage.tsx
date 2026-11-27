import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  INVITATION_TOKEN_PATTERN,
  type AcceptInvitationResponse,
  type InvitationPreviewResponse,
} from '@ai-crm/shared';
import { useAuth } from '@/app/auth';
import { usePreferences } from '@/app/preferences';
import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { GlowBorder } from '@/components/effects/glow';
import { Badge, Skeleton } from '@/components/ui/misc';
import { AuthHeading } from '@/features/auth/AuthLayout';
import { membershipsKey } from '@/features/workspaces/queries';
import { api, ApiClientError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate, initials } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

/** /invite/:token — public. Shows who invited you, then sign in / sign up / accept. */
export function AcceptInvitePage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const { session, user, loading, signOut } = useAuth();
  const { locale } = usePreferences();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const validToken = INVITATION_TOKEN_PATTERN.test(token);
  const next = `/invite/${token}`;

  const preview = useQuery({
    queryKey: ['invitation-preview', token, user?.id ?? null],
    enabled: validToken && !loading,
    queryFn: () =>
      api<InvitationPreviewResponse>('/v1/invitations/preview', {
        body: { token },
        auth: !!session,
      }),
    retry: false,
  });
  const p = preview.data;
  useDocumentTitle(p ? t('accept.title', { workspace: p.workspace_name }) : t('accept.loading'));

  if (
    !validToken ||
    (preview.error instanceof ApiClientError && preview.error.code === 'invitation_not_found')
  ) {
    return <Ended message={t('accept.notFound')} />;
  }
  if (loading || preview.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy aria-label={t('accept.loading')}>
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-4 h-24 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }
  if (preview.error || !p) {
    return (
      <InlineAlert
        tone="danger"
        action={
          <Button variant="secondary" onClick={() => void preview.refetch()}>
            {t('common.retry')}
          </Button>
        }
      >
        {errorMessage(t, preview.error)}
      </InlineAlert>
    );
  }
  if (p.state !== 'valid') {
    return <Ended message={t(`accept.${p.state}`)} />;
  }

  const role = t(`members.roles.${p.role}`);
  const accept = async () => {
    setError(null);
    setAccepting(true);
    try {
      const res = await api<AcceptInvitationResponse>('/v1/invitations/accept', {
        body: { token },
      });
      await queryClient.invalidateQueries({ queryKey: membershipsKey(user?.id) });
      toast.success(t('accept.joined', { workspace: p.workspace_name }));
      navigate(`/w/${res.workspace_slug}`, { replace: true });
    } catch (err) {
      setError(errorMessage(t, err));
      setAccepting(false);
    }
  };

  return (
    <div className="flex flex-col" data-testid="accept-invite">
      <AuthHeading
        title={t('accept.title', { workspace: p.workspace_name })}
        subtitle={
          p.inviter_name
            ? t('accept.invitedBy', { name: p.inviter_name, role })
            : t('accept.invitedAs', { role })
        }
      />
      {/* The invitation is the hero of this page: one card, the glow reserved for it (H2). */}
      <GlowBorder className="mb-8 rounded-2xl">
        <div className="surface-card rounded-2xl border p-5">
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,#5a7bff,#2747d1)] text-headline font-semibold text-white shadow-glow"
            >
              {initials(p.workspace_name)}
            </span>
            <div className="flex min-w-0 flex-col items-start gap-1">
              <p
                dir="auto"
                className="w-full truncate text-headline font-semibold text-text-primary"
              >
                {p.workspace_name}
              </p>
              <Badge tone="primary">{role}</Badge>
            </div>
          </div>
          <dl className="flex flex-col gap-2.5 border-t pt-4 text-callout">
            <div className="flex items-center gap-3 text-text-secondary">
              <Mail aria-hidden className="size-4 shrink-0 text-text-tertiary" />
              <dt className="sr-only">{t('invite.email')}</dt>
              <dd>{t('accept.sentTo', { email: '\u2066' + p.email + '\u2069' })}</dd>
            </div>
            <div className="flex items-center gap-3 text-text-secondary">
              <CalendarClock aria-hidden className="size-4 shrink-0 text-text-tertiary" />
              <dt className="sr-only">{t('accept.expiresLabel')}</dt>
              <dd>{t('accept.expires', { date: formatDate(p.expires_at, locale) })}</dd>
            </div>
          </dl>
        </div>
      </GlowBorder>
      {error ? (
        <InlineAlert tone="danger" className="mb-4">
          {error}
        </InlineAlert>
      ) : null}
      {!session ? (
        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link to={`/auth/sign-in?next=${encodeURIComponent(next)}`}>
              {t('accept.signInToAccept')}
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to={`/auth/sign-up?next=${encodeURIComponent(next)}`}>
              {t('accept.signUpToAccept')}
            </Link>
          </Button>
        </div>
      ) : p.email_matches_caller ? (
        <Button size="lg" onClick={accept} loading={accepting} data-testid="accept-button">
          {accepting ? t('accept.accepting') : t('accept.accept')}
        </Button>
      ) : (
        <div className="flex flex-col gap-4">
          <InlineAlert tone="warning">
            {t('accept.wrongAccount', { email: user?.email ?? '' })}
          </InlineAlert>
          <Button
            size="lg"
            variant="secondary"
            onClick={async () => {
              await signOut();
              navigate(`/auth/sign-in?next=${encodeURIComponent(next)}`, { replace: true });
            }}
          >
            {t('accept.switchAccount')}
          </Button>
        </div>
      )}
    </div>
  );
}

function Ended({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <InlineAlert tone="warning">{message}</InlineAlert>
      <Button asChild variant="secondary">
        <Link to="/">{t('accept.goHome')}</Link>
      </Button>
    </div>
  );
}
