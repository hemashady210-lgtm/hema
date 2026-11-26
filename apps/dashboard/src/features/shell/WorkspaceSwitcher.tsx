import { useNavigate } from 'react-router';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/misc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspace } from '@/features/workspaces/context';
import { initials } from '@/lib/format';
import { storage } from '@/lib/storage';

export function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspace, role, memberships } = useWorkspace();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('shell.switcher.label')}
          data-testid="workspace-switcher"
          className="flex h-9 min-w-0 max-w-[16rem] items-center gap-2.5 rounded-md px-2 text-start transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Avatar name={initials(workspace.name)} className="size-6 rounded-[7px] text-[10px]" />
          <span className="flex min-w-0 flex-col">
            <bdi className="truncate text-callout font-semibold leading-tight text-text-primary">
              {workspace.name}
            </bdi>
            <span className="truncate text-caption leading-tight text-text-tertiary">
              {t(`members.roles.${role}`)}
            </span>
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-text-tertiary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t('shell.switcher.yours')}</DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.workspace.id}
            onSelect={() => {
              storage.set('last-workspace', m.workspace.slug);
              navigate(`/w/${m.workspace.slug}`);
            }}
          >
            <Avatar
              name={initials(m.workspace.name)}
              className="size-6 rounded-[7px] text-[10px]"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <bdi className="truncate text-text-primary">{m.workspace.name}</bdi>
              <span className="text-caption text-text-tertiary">
                {t(`members.roles.${m.role}`)}
              </span>
            </span>
            {m.workspace.id === workspace.id ? (
              <Check aria-hidden className="!text-accent" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/onboarding/workspace')}>
          <Plus aria-hidden />
          {t('shell.switcher.create')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
