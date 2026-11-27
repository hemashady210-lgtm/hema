import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Ellipsis, LogOut, RefreshCw, UserMinus, UserPlus, Users, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { INVITABLE_ROLES, type CreateInvitationResponse, type InvitableRole } from '@ai-crm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/auth';
import { usePreferences } from '@/app/preferences';
import { EmptyState } from '@/components/empty-state';
import { UsageMeter } from '@/components/usage-meter';
import { InlineAlert } from '@/components/inline-alert';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, Badge, Skeleton } from '@/components/ui/misc';
import { usePermissions } from '@/features/permissions/use-permissions';
import { useSeatUsage } from '@/features/billing/usage';
import { useWorkspace } from '@/features/workspaces/context';
import { membershipsKey, type Membership } from '@/features/workspaces/queries';
import { errorMessage } from '@/lib/errors';
import { formatDate, initials } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import { InviteDialog, InviteResult } from './InviteDialog';
import {
  useInvitations,
  useMemberMutations,
  useMembers,
  type InvitationRow,
  type MemberRow,
} from './queries';

const ROLE_TONE = { owner: 'primary', admin: 'info', agent: 'neutral', viewer: 'neutral' } as const;
const EMAIL_TONE = {
  pending: 'neutral',
  sent: 'success',
  failed: 'danger',
  not_configured: 'warning',
} as const;

export function MembersPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('members.title'));
  const { workspace } = useWorkspace();
  const perms = usePermissions();
  const canInvite = perms.canWrite('members.invite');
  const canSeeInvites = perms.can('members.invite');
  const members = useMembers(workspace.id);
  const invitations = useInvitations(workspace.id, canSeeInvites);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Same seat rule as Overview (members + open invitations, G4) from one shared hook.
  const { used, limit } = useSeatUsage(workspace.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-title-3 font-semibold">{t('members.title')}</h2>
          <p className="text-callout text-text-secondary">{t('members.subtitle')}</p>
          {members.data ? (
            <div className="mt-2 flex max-w-sm flex-col gap-2">
              <p className="tabular text-footnote text-text-tertiary" data-testid="seats">
                {limit === null
                  ? t('members.seatsUnlimited', { used })
                  : t('members.seats', { used, limit })}
                {canSeeInvites && limit !== null ? ` · ${t('members.seatsHelp')}` : ''}
              </p>
              {limit !== null ? (
                <UsageMeter
                  value={used}
                  max={limit}
                  label={t('overview.usage.seats')}
                  valueText={t('members.seats', { used, limit })}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        {canInvite ? (
          <Button onClick={() => setInviteOpen(true)} data-testid="invite-button">
            <UserPlus aria-hidden />
            {t('members.invite')}
          </Button>
        ) : null}
      </div>

      {!perms.can('members.manage') ? (
        <InlineAlert tone="info">{t('members.manageNotice')}</InlineAlert>
      ) : null}

      <div className="surface-card overflow-hidden rounded-2xl border">
        <table className="w-full text-start text-callout">
          <caption className="sr-only">{t('members.title')}</caption>
          <thead className="border-b bg-surface-2/60 text-footnote text-text-tertiary">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-medium sm:px-5">
                {t('members.columns.member')}
              </th>
              <th scope="col" className="hidden px-4 py-3 text-start font-medium sm:table-cell">
                {t('members.columns.role')}
              </th>
              <th scope="col" className="hidden px-4 py-3 text-start font-medium md:table-cell">
                {t('members.columns.joined')}
              </th>
              <th scope="col" className="w-12 px-4 py-3">
                <span className="sr-only">{t('members.columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.isPending
              ? Array.from({ length: 3 }, (_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-4" colSpan={4}>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <div className="flex flex-1 flex-col gap-2">
                          <Skeleton className="h-3.5 w-40" />
                          <Skeleton className="h-3 w-56" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              : members.data?.map((m) => <MemberTableRow key={m.user_id} member={m} />)}
          </tbody>
        </table>
        {members.error ? (
          <div className="p-5">
            <InlineAlert
              tone="danger"
              action={
                <Button variant="secondary" onClick={() => void members.refetch()}>
                  {t('common.retry')}
                </Button>
              }
            >
              {errorMessage(t, members.error)}
            </InlineAlert>
          </div>
        ) : null}
      </div>

      {canSeeInvites ? (
        // Same card language as the members table above (review: one layout per list).
        <section
          aria-labelledby="pending-title"
          className="surface-card overflow-hidden rounded-2xl border"
        >
          <h3
            id="pending-title"
            className="border-b bg-surface-2/60 px-4 py-3 text-footnote font-medium text-text-tertiary sm:px-5"
          >
            {t('members.pending.title')}
          </h3>
          <div className="px-4 sm:px-5">
            {invitations.isPending ? (
              <Skeleton className="my-4 h-10 w-full" />
            ) : invitations.data && invitations.data.length > 0 ? (
              <ul className="divide-y" data-testid="pending-invitations">
                {invitations.data.map((inv) => (
                  <PendingInvitation key={inv.id} invitation={inv} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={Users} title={t('members.pending.empty')} className="py-5" />
            )}
          </div>
        </section>
      ) : null}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function MemberTableRow({ member }: { member: MemberRow }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locale } = usePreferences();
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const { changeRole, remove, leave } = useMemberMutations(workspace.id);
  const [confirm, setConfirm] = useState<'remove' | 'leave' | null>(null);
  const isMe = member.user_id === user?.id;
  const name = member.full_name ?? member.email ?? '—';
  const target = { userId: member.user_id, role: member.role };
  // Role changes grant access (writable workspace only); removal only reduces it.
  const canChangeRole = perms.canManage(target);
  const removable = perms.canRemove(target);
  const leavable = isMe && perms.canLeave();

  // mutateAsync: the row may unmount when the list refreshes; the promise still settles.
  const onRole = async (role: InvitableRole) => {
    if (role === member.role) return;
    try {
      await changeRole.mutateAsync({ userId: member.user_id, role });
      toast.success(t('members.roleChanged', { name, role: t(`members.roles.${role}`) }));
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const onConfirm = async () => {
    try {
      if (confirm === 'leave') {
        await leave.mutateAsync(member.user_id);
        toast.success(t('members.left'));
        // Leave the page first, then drop the workspace from the cache (no "not found" flash).
        navigate('/', { replace: true });
        queryClient.setQueryData<Membership[]>(membershipsKey(user?.id), (old) =>
          old?.filter((m) => m.workspace.id !== workspace.id),
        );
        void queryClient.invalidateQueries({ queryKey: membershipsKey(user?.id) });
        return;
      }
      await remove.mutateAsync(member.user_id);
      toast.success(t('members.removed', { name }));
      setConfirm(null);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  return (
    <tr
      className="transition-colors hover:bg-surface-2/60"
      data-testid="member-row"
      data-role={member.role}
    >
      <td className="px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Avatar name={initials(member.full_name, member.email)} />
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-2">
              <bdi className="truncate font-medium text-text-primary">{name}</bdi>
              {isMe ? <Badge>{t('common.you')}</Badge> : null}
            </span>
            <span dir="ltr" className="truncate text-start text-footnote text-text-tertiary">
              {member.email}
            </span>
            <span className="mt-1 sm:hidden">
              <Badge tone={ROLE_TONE[member.role]}>{t(`members.roles.${member.role}`)}</Badge>
            </span>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <Badge tone={ROLE_TONE[member.role]}>{t(`members.roles.${member.role}`)}</Badge>
      </td>
      <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
        {formatDate(member.created_at, locale)}
      </td>
      <td className="px-4 py-3 text-end">
        {removable || leavable ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('members.actionsFor', { name })}
                data-testid="member-actions"
              >
                <Ellipsis aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {removable ? (
                <>
                  {canChangeRole ? (
                    <>
                      <DropdownMenuLabel>{t('members.changeRole')}</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={member.role}
                        onValueChange={(v) => void onRole(v as InvitableRole)}
                      >
                        {INVITABLE_ROLES.map((r) => (
                          <DropdownMenuRadioItem key={r} value={r} disabled={changeRole.isPending}>
                            {t(`members.roles.${r}`)}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem destructive onSelect={() => setConfirm('remove')}>
                    <UserMinus aria-hidden />
                    {t('members.remove')}
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem destructive onSelect={() => setConfirm('leave')}>
                  <LogOut aria-hidden className="rtl-mirror" />
                  {t('members.leave')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <ConfirmDialog
          open={confirm !== null}
          onOpenChange={(o) => (o ? null : setConfirm(null))}
          title={confirm === 'leave' ? t('members.leaveTitle') : t('members.removeTitle', { name })}
          description={confirm === 'leave' ? t('members.leaveBody') : t('members.removeBody')}
          confirmLabel={
            confirm === 'leave' ? t('members.leaveConfirm') : t('members.removeConfirm')
          }
          destructive
          loading={remove.isPending || leave.isPending}
          onConfirm={() => void onConfirm()}
        />
      </td>
    </tr>
  );
}

function PendingInvitation({ invitation }: { invitation: InvitationRow }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const { workspace } = useWorkspace();
  const perms = usePermissions();
  const { renew, revoke } = useMemberMutations(workspace.id);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [renewed, setRenewed] = useState<CreateInvitationResponse | null>(null);
  const expired = new Date(invitation.expires_at).getTime() <= Date.now();
  const canRenew = perms.canWrite('members.invite');
  const canRevoke = perms.can('members.invite'); // revoking only reduces access

  return (
    <li
      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"
      data-testid="pending-invitation"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span dir="ltr" className="truncate text-start font-medium text-text-primary">
          {invitation.email}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-footnote text-text-tertiary">
          <Badge tone={ROLE_TONE[invitation.role]}>{t(`members.roles.${invitation.role}`)}</Badge>
          <Badge tone={EMAIL_TONE[invitation.email_status]} dot data-testid="email-status">
            {t(`members.pending.emailStatus.${invitation.email_status}`)}
          </Badge>
          {expired ? (
            <Badge tone="danger">{t('members.pending.expired')}</Badge>
          ) : (
            <span>
              {t('members.pending.expires', { date: formatDate(invitation.expires_at, locale) })}
            </span>
          )}
        </span>
      </div>
      {canRenew || canRevoke ? (
        <div className="flex shrink-0 items-center gap-2">
          {canRenew ? (
            <Button
              variant="secondary"
              size="sm"
              loading={renew.isPending}
              onClick={async () => {
                try {
                  setRenewed(await renew.mutateAsync(invitation.id));
                  toast.success(t('members.pending.renewed'));
                } catch (err) {
                  toast.error(errorMessage(t, err));
                }
              }}
            >
              <RefreshCw aria-hidden />
              {t('members.pending.renew')}
            </Button>
          ) : null}
          {canRevoke ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(true)}>
              <XCircle aria-hidden />
              {t('members.pending.revoke')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title={t('members.pending.revokeTitle', { email: invitation.email })}
        description={t('members.pending.revokeBody')}
        confirmLabel={t('members.pending.revokeConfirm')}
        destructive
        loading={revoke.isPending}
        onConfirm={async () => {
          try {
            await revoke.mutateAsync(invitation.id);
            toast.success(t('members.pending.revoked'));
            setConfirmRevoke(false);
          } catch (err) {
            toast.error(errorMessage(t, err));
          }
        }}
      />
      <Dialog open={!!renewed} onOpenChange={(o) => (o ? null : setRenewed(null))}>
        <DialogContent>
          {renewed ? <InviteResult result={renewed} onDone={() => setRenewed(null)} /> : null}
        </DialogContent>
      </Dialog>
    </li>
  );
}
