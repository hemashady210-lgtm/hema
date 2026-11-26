import { useState } from 'react';
import { Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InlineAlert } from '@/components/inline-alert';
import { SettingsSection } from '@/features/settings/SettingsLayout';
import { useWorkspace } from '@/features/workspaces/context';
import { errorMessage } from '@/lib/errors';
import { useMemberMutations, useMembers } from './queries';

/** Owner-only: hand the workspace to another active member; the old owner becomes admin. */
export function TransferOwnershipSection() {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  return (
    <SettingsSection title={t('settings.danger.title')} tone="danger">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-callout font-semibold">{t('settings.danger.transferTitle')}</p>
            <p className="text-callout text-text-secondary">{t('settings.danger.transferBody')}</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setOpen(true)}
            disabled={workspace.status === 'pending_deletion'}
          >
            <Crown aria-hidden />
            {t('settings.danger.transferAction')}
          </Button>
        </div>
        <div className="h-px bg-border" />
        <div className="flex flex-col gap-1">
          <p className="text-callout font-semibold">{t('settings.danger.deleteTitle')}</p>
          <p className="text-callout text-text-secondary">{t('settings.danger.deleteBody')}</p>
        </div>
      </div>
      {open ? <TransferDialog onClose={() => setOpen(false)} /> : null}
    </SettingsSection>
  );
}

function TransferDialog({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const { data: members } = useMembers(workspace.id);
  const { transfer } = useMemberMutations(workspace.id);
  const [target, setTarget] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const candidates = (members ?? []).filter((m) => m.role !== 'owner');
  const chosen = candidates.find((m) => m.user_id === target);

  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => (o ? null : onClose())}
      title={t('members.transfer.title')}
      description={t('members.transfer.body')}
      confirmLabel={t('members.transfer.confirm')}
      destructive
      loading={transfer.isPending}
      confirmDisabled={!target}
      onConfirm={async () => {
        if (!target) return;
        setError(null);
        try {
          // mutateAsync: this section unmounts once the caller is no longer the owner.
          await transfer.mutateAsync(target);
          toast.success(
            t('members.transfer.done', { name: chosen?.full_name ?? chosen?.email ?? '' }),
          );
          onClose();
        } catch (err) {
          setError(errorMessage(t, err));
        }
      }}
    >
      {candidates.length === 0 ? (
        <InlineAlert tone="info">{t('members.transfer.noCandidates')}</InlineAlert>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transfer-target">{t('members.transfer.select')}</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="transfer-target">
              <SelectValue placeholder={t('members.transfer.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name ?? m.email} · {t(`members.roles.${m.role}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
    </ConfirmDialog>
  );
}
