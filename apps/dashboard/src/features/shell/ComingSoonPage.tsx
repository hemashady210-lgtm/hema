import { Hammer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/misc';
import { useDocumentTitle } from '@/lib/use-document-title';
import { ALL_ITEMS, ADMIN_ITEM, type SectionKey } from './nav';

/** Honest placeholder for sections built in later phases: what the section will do, nothing fake. */
export function ComingSoonPage({ section }: { section: Exclude<SectionKey, 'settings'> }) {
  const { t } = useTranslation();
  const name = t(`shell.nav.${section}`);
  useDocumentTitle(name);
  const item = [...ALL_ITEMS, ADMIN_ITEM].find((i) => i.key === section);
  const Icon = item?.icon ?? Hammer;
  return (
    <section aria-labelledby="coming-soon-title" className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 id="coming-soon-title" className="text-title-1 font-semibold tracking-[-0.01em]">
          {name}
        </h1>
      </header>
      <div className="relative overflow-hidden rounded-xl border bg-surface-1 p-6 sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
        />
        <div className="relative flex max-w-xl flex-col items-start gap-5">
          <span className="grid size-12 place-items-center rounded-xl bg-surface-2 text-royal-300 ring-1 ring-border light:text-primary">
            <Icon aria-hidden className="size-6" strokeWidth={1.5} />
          </span>
          <Badge tone="primary" dot>
            {t('comingSoon.badge')}
          </Badge>
          <div className="flex flex-col gap-2">
            <h2 className="text-title-3 font-semibold">
              {t('comingSoon.title', { section: name })}
            </h2>
            <p className="text-callout text-text-secondary">{t('comingSoon.body')}</p>
            <p className="text-body text-text-primary">{t(`comingSoon.sections.${section}`)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
