import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Command } from 'cmdk';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Building2, Languages, LogOut, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/app/auth';
import { usePreferences } from '@/app/preferences';
import { overlayClass } from '@/components/ui/dialog';
import { THEME_ICONS } from '@/components/theme-menu';
import { useWorkspace } from '@/features/workspaces/context';
import { useIsPlatformAdmin } from '@/features/workspaces/queries';
import { storage } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { ADMIN_ITEM, ALL_ITEMS, sectionHref } from './nav';

const itemClass =
  'flex h-10 cursor-default select-none items-center gap-3 rounded-md px-3 text-callout text-text-secondary outline-none data-[selected=true]:bg-surface-3 data-[selected=true]:text-text-primary [&_svg]:size-4 [&_svg]:shrink-0';
const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-footnote [&_[cmdk-group-heading]]:text-text-tertiary';

/** ⌘K / Ctrl K: jump to any section, switch workspace, change language or appearance. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspace, memberships } = useWorkspace();
  const { locale } = usePreferences();
  const { setLocale, setTheme, signOut } = useAuth();
  const { data: isAdmin } = useIsPlatformAdmin();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  const other = locale === 'ar' ? 'en' : 'ar';
  const items = isAdmin ? [...ALL_ITEMS, ADMIN_ITEM] : ALL_ITEMS;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'material-regular fixed start-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl overflow-hidden rounded-xl shadow-e3',
            'ltr:-translate-x-1/2 rtl:translate-x-1/2',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        >
          <DialogPrimitive.Title className="sr-only">{t('shell.jumpTo')}</DialogPrimitive.Title>
          <Command loop label={t('shell.jumpTo')}>
            <Command.Input
              placeholder={t('palette.placeholder')}
              className="h-14 w-full border-b bg-transparent px-5 text-body text-text-primary outline-none placeholder:text-text-tertiary"
            />
            <Command.List className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-callout text-text-tertiary">
                {t('palette.empty')}
              </Command.Empty>
              <Command.Group heading={t('palette.navigation')} className={groupClass}>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.key}
                      value={`nav ${item.key} ${t(`shell.nav.${item.key}`)}`}
                      onSelect={() => run(() => navigate(sectionHref(workspace.slug, item)))}
                      className={itemClass}
                    >
                      <Icon aria-hidden />
                      {t(`shell.nav.${item.key}`)}
                    </Command.Item>
                  );
                })}
              </Command.Group>
              <Command.Group heading={t('palette.workspaces')} className={groupClass}>
                {memberships
                  .filter((m) => m.workspace.id !== workspace.id)
                  .map((m) => (
                    <Command.Item
                      key={m.workspace.id}
                      value={`ws ${m.workspace.name} ${m.workspace.slug}`}
                      onSelect={() =>
                        run(() => {
                          storage.set('last-workspace', m.workspace.slug);
                          navigate(`/w/${m.workspace.slug}`);
                        })
                      }
                      className={itemClass}
                    >
                      <Building2 aria-hidden />
                      <bdi>{m.workspace.name}</bdi>
                    </Command.Item>
                  ))}
                <Command.Item
                  value="create workspace"
                  onSelect={() => run(() => navigate('/onboarding/workspace'))}
                  className={itemClass}
                >
                  <Plus aria-hidden />
                  {t('shell.switcher.create')}
                </Command.Item>
              </Command.Group>
              <Command.Group heading={t('palette.preferences')} className={groupClass}>
                <Command.Item
                  value={`language ${other}`}
                  onSelect={() => run(() => setLocale(other))}
                  className={itemClass}
                >
                  <Languages aria-hidden />
                  {t('palette.switchLanguage', { language: t(`language.${other}`) })}
                </Command.Item>
                {(['dark', 'light', 'system'] as const).map((th) => {
                  const Icon = THEME_ICONS[th];
                  return (
                    <Command.Item
                      key={th}
                      value={`theme ${th}`}
                      onSelect={() => run(() => setTheme(th))}
                      className={itemClass}
                    >
                      <Icon aria-hidden />
                      {t('palette.useTheme', { theme: t(`theme.${th}`) })}
                    </Command.Item>
                  );
                })}
                <Command.Item
                  value="sign out"
                  onSelect={() =>
                    run(() => {
                      void signOut().then(() => navigate('/auth/sign-in', { replace: true }));
                    })
                  }
                  className={itemClass}
                >
                  <LogOut aria-hidden className="rtl-mirror" />
                  {t('shell.signOut')}
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
