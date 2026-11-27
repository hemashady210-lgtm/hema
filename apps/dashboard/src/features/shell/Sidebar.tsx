import { NavLink } from 'react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@/components/brand-mark';
import { Tooltip } from '@/components/ui/tooltip';
import { usePreferences } from '@/app/preferences';
import { useIsPlatformAdmin } from '@/features/workspaces/queries';
import { cn } from '@/lib/utils';
import { ADMIN_ITEM, NAV, sectionHref, type NavItem } from './nav';

interface SidebarNavProps {
  slug: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ slug, collapsed = false, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation();
  const { data: isAdmin } = useIsPlatformAdmin();
  const groups = isAdmin ? [...NAV, { key: 'manage' as const, items: [ADMIN_ITEM] }] : NAV;
  return (
    <nav aria-label={t('shell.navLabel')} className="flex flex-col gap-5">
      {groups.map((group, gi) => (
        <div key={`${group.key}-${gi}`} className="flex flex-col gap-0.5">
          {collapsed ? (
            gi > 0 ? (
              <span aria-hidden className="mx-3 mb-2 h-px bg-border" />
            ) : null
          ) : group.items[0]?.key !== 'admin' ? (
            <p className="mb-1 px-3 text-footnote text-text-tertiary">
              {t(`shell.groups.${group.key}`)}
            </p>
          ) : null}
          {group.items.map((item) => (
            <SidebarLink
              key={item.key}
              item={item}
              slug={slug}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function SidebarLink({
  item,
  slug,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  slug: string;
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const { dir } = usePreferences();
  const label = t(`shell.nav.${item.key}`);
  const soon = item.comingSoon ? t('comingSoon.badge') : null;
  const Icon = item.icon;
  const link = (
    <NavLink
      to={sectionHref(slug, item)}
      end={item.path === ''}
      onClick={onNavigate}
      aria-label={collapsed ? (soon ? `${label} (${soon})` : label) : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-3 rounded-md px-3 text-callout font-medium text-text-secondary transition-colors duration-(--duration-micro)',
          'hover:bg-surface-3 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent',
          isActive && 'bg-primary/12 text-text-primary light:bg-primary/10',
          collapsed && 'justify-center px-0',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={cn(
              'absolute inset-y-2 start-0 w-0.5 rounded-full bg-primary transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon
            aria-hidden
            className={cn(
              'size-[18px] shrink-0',
              isActive ? 'text-royal-300 light:text-primary' : '',
            )}
            strokeWidth={1.75}
          />
          {collapsed ? null : <span className="truncate">{label}</span>}
          {/* "Coming soon" is announced with the link and shown in words on hover/focus —
              never a bare dot (HIG accessibility › "Convey information with more than color"). */}
          {!collapsed && soon ? (
            <>
              <span className="sr-only"> ({soon})</span>
              <span
                aria-hidden
                className="ms-auto rounded-full px-1.5 text-caption text-text-tertiary opacity-0 transition-opacity duration-(--duration-micro) group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {soon}
              </span>
            </>
          ) : null}
        </>
      )}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip content={label} side={dir === 'rtl' ? 'left' : 'right'}>
      {link}
    </Tooltip>
  ) : (
    link
  );
}

export function Sidebar({
  slug,
  collapsed,
  onToggle,
}: {
  slug: string;
  collapsed: boolean;
  onToggle(): void;
}) {
  const { t } = useTranslation();
  const { dir } = usePreferences();
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-e bg-surface-1 transition-[width] duration-(--duration-standard) ease-(--ease-standard) lg:flex',
        collapsed ? 'w-[72px]' : 'w-[264px]',
      )}
      data-collapsed={collapsed}
    >
      <div
        className={cn('flex h-14 items-center border-b px-4', collapsed && 'justify-center px-0')}
      >
        <BrandMark showName={!collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarNav slug={slug} collapsed={collapsed} />
      </div>
      <div className="border-t p-3">
        <Tooltip
          content={collapsed ? t('shell.expand') : t('shell.collapse')}
          side={dir === 'rtl' ? 'left' : 'right'}
          disabled={!collapsed}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? t('shell.expand') : t('shell.collapse')}
            aria-expanded={!collapsed}
            className={cn(
              'flex h-9 w-full items-center gap-3 rounded-md px-3 text-callout text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="rtl-mirror size-[18px]" />
            ) : (
              <PanelLeftClose aria-hidden className="rtl-mirror size-[18px]" />
            )}
            {collapsed ? null : <span>{t('shell.collapse')}</span>}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
