import { Menu, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeMenu } from '@/components/theme-menu';
import { Button } from '@/components/ui/button';
import { Badge, Kbd } from '@/components/ui/misc';
import { useWorkspace } from '@/features/workspaces/context';
import { useSubscription } from '@/features/workspaces/queries';
import { daysUntil } from '@/lib/format';
import { NotificationsBell } from './NotificationsBell';
import { UserMenu } from './UserMenu';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

function PlanBadge() {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const { data: sub } = useSubscription(workspace.id);
  if (workspace.status !== 'active') {
    return (
      <Badge tone="danger" dot>
        {t('shell.readOnly')}
      </Badge>
    );
  }
  if (sub?.status === 'trialing' && sub.trial_ends_at) {
    const days = daysUntil(sub.trial_ends_at);
    return days > 0 ? (
      <Badge tone="info" dot className="tabular" data-testid="trial-badge">
        {t('shell.trialDaysLeft', { count: days })}
      </Badge>
    ) : (
      <Badge tone="warning" dot>
        {t('shell.trialEnded')}
      </Badge>
    );
  }
  return null;
}

export function TopBar({
  onOpenMenu,
  onOpenPalette,
}: {
  onOpenMenu(): void;
  onOpenPalette(): void;
}) {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className="material-thin sticky top-0 z-30 flex h-14 items-center gap-2 border-x-0 border-t-0 px-3 sm:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMenu}
        aria-label={t('shell.openMenu')}
      >
        <Menu aria-hidden />
      </Button>
      <WorkspaceSwitcher />
      <button
        type="button"
        onClick={onOpenPalette}
        aria-label={t('shell.jumpTo')}
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
        className="ms-2 hidden h-9 w-64 items-center gap-2 rounded-md border border-border bg-surface-2/70 px-3 text-callout text-text-tertiary transition-colors hover:border-border-strong hover:text-text-secondary focus-visible:outline-2 focus-visible:outline-accent md:flex"
      >
        <Search aria-hidden className="size-4" />
        <span className="flex-1 text-start">{t('shell.jumpTo')}</span>
        <span dir="ltr" className="flex items-center gap-0.5">
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <div className="ms-auto flex items-center gap-1 sm:gap-1.5">
        <div className="hidden sm:block">
          <PlanBadge />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onOpenPalette}
          aria-label={t('shell.jumpTo')}
        >
          <Search aria-hidden />
        </Button>
        <LanguageToggle compact />
        <div className="hidden sm:block">
          <ThemeMenu />
        </div>
        <NotificationsBell workspaceId={workspace.id} />
        <div className="ms-1">
          <UserMenu slug={workspace.slug} />
        </div>
      </div>
    </header>
  );
}
