import type { ReactNode } from 'react';
import { Hammer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FloatingShapes } from '@/components/effects/ambient';
import { Badge } from '@/components/ui/misc';
import { useDocumentTitle } from '@/lib/use-document-title';
import { ALL_ITEMS, ADMIN_ITEM, type SectionKey } from './nav';

/**
 * Honest placeholder for sections built in later phases: what the section will do, nothing fake
 * (DESIGN_SYSTEM §1.4). A calm, centred empty state; floating CSS 3D shapes behind it are the
 * only decoration (static under reduced motion, hidden under increased contrast). `children`
 * render between the title and the placeholder (Overview puts the real Plan & usage row there).
 */
export function ComingSoonPage({
  section,
  children,
}: {
  section: Exclude<SectionKey, 'settings'>;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const name = t(`shell.nav.${section}`);
  useDocumentTitle(name);
  const item = [...ALL_ITEMS, ADMIN_ITEM].find((i) => i.key === section);
  const Icon = item?.icon ?? Hammer;
  return (
    <section aria-labelledby="coming-soon-title" className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 id="coming-soon-title" className="text-title-1 font-semibold">
          {name}
        </h1>
      </header>
      {children}
      <div className="surface-card bg-aurora relative isolate overflow-hidden rounded-3xl border px-6 py-14 sm:px-10 sm:py-20">
        <FloatingShapes className="-z-10 opacity-80" />
        <div className="relative mx-auto flex max-w-lg flex-col items-center gap-5 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-[linear-gradient(145deg,#5a7bff,#2747d1)] text-white shadow-glow ring-1 ring-white/15">
            <Icon aria-hidden className="size-7" strokeWidth={1.5} />
          </span>
          <Badge tone="primary" dot>
            {t('comingSoon.badge')}
          </Badge>
          <div className="flex flex-col gap-2">
            <h2 className="text-title-2 font-semibold text-balance">
              {t('comingSoon.title', { section: name })}
            </h2>
            <p className="text-callout text-text-secondary">{t('comingSoon.body')}</p>
          </div>
          <p className="rounded-2xl bg-surface-2/80 px-5 py-4 text-body text-text-primary ring-1 ring-border">
            {t(`comingSoon.sections.${section}`)}
          </p>
        </div>
      </div>
    </section>
  );
}
