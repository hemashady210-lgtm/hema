import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/page-header';
import { useWorkspace } from '@/features/workspaces/context';
import { cn } from '@/lib/utils';

export function SettingsLayout() {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const tabs = [
    { to: `/w/${workspace.slug}/settings`, label: t('settings.tabs.general'), end: true },
    { to: `/w/${workspace.slug}/settings/members`, label: t('settings.tabs.members'), end: false },
  ];
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('settings.title')} />
      <nav aria-label={t('settings.title')} className="-mt-2 flex gap-1 border-b">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'relative -mb-px border-b-2 border-transparent px-3 pb-3 pt-1 text-callout font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent',
                isActive && 'border-primary text-text-primary',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  children,
  footer,
  tone = 'default',
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <section
      className={cn(
        'surface-card grid gap-6 rounded-2xl border lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]',
        tone === 'danger' && 'border-danger/30',
      )}
    >
      <div className="flex flex-col gap-1 p-6 pb-0 lg:pb-6">
        <h2 className="text-headline font-semibold">{title}</h2>
        {description ? <p className="text-callout text-text-secondary">{description}</p> : null}
      </div>
      <div className="flex flex-col">
        <div className="p-6 pt-0 lg:pt-6">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t bg-surface-2/40 px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </section>
  );
}
