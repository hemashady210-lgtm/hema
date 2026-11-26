import { useState } from 'react';
import { Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@/components/brand-mark';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { X } from 'lucide-react';
import { useWorkspace } from '@/features/workspaces/context';
import { storage } from '@/lib/storage';
import { CommandPalette } from './CommandPalette';
import { Sidebar, SidebarNav } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell() {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const [collapsed, setCollapsed] = useState(() => storage.get('sidebar-collapsed') === '1');
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toggle = () =>
    setCollapsed((c) => {
      storage.set('sidebar-collapsed', c ? '0' : '1');
      return !c;
    });

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t('common.skipToContent')}
      </a>
      <Sidebar slug={workspace.slug} collapsed={collapsed} onToggle={toggle} />
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent>
          <SheetTitle className="sr-only">{t('shell.navLabel')}</SheetTitle>
          <SheetDescription className="sr-only">{workspace.name}</SheetDescription>
          <div className="flex h-14 items-center justify-between border-b px-4">
            <BrandMark />
            <SheetClose
              aria-label={t('common.close')}
              className="grid size-9 place-items-center rounded-md text-text-tertiary hover:bg-surface-3 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X aria-hidden className="size-4" />
            </SheetClose>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav slug={workspace.slug} onNavigate={() => setMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => setMenuOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-10"
        >
          <div className="mx-auto w-full max-w-[1280px]">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
