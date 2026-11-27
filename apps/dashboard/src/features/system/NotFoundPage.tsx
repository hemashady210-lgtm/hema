import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@/components/brand-mark';
import { FloatingShapes } from '@/components/effects/ambient';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';

/**
 * Unknown or inaccessible address. Inside a workspace it renders within the app shell (so the
 * navigation stays); on its own it gets the brand mark. Two clear ways out; floating CSS 3D
 * shapes are the only decoration (static under reduced motion).
 */
export function NotFoundPage({ inShell = false }: { inShell?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t('notFound.title'));
  const body = (
    <div className="surface-card bg-aurora relative isolate w-full overflow-hidden rounded-3xl border px-6 py-16 sm:py-24">
      <FloatingShapes className="-z-10 opacity-80" />
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-[linear-gradient(145deg,#5a7bff,#2747d1)] text-white shadow-glow ring-1 ring-white/15">
          <Compass aria-hidden className="size-7" strokeWidth={1.5} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-title-1 font-semibold">{t('notFound.title')}</h1>
          <p className="text-callout text-text-secondary">{t('notFound.body')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link to="/">{t('notFound.home')}</Link>
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft aria-hidden className="rtl-mirror" />
            {t('common.back')}
          </Button>
        </div>
      </div>
    </div>
  );
  if (inShell) return body;
  return (
    <main className={cn('mx-auto flex min-h-dvh max-w-3xl flex-col gap-10 px-5 py-8 sm:py-12')}>
      <Link
        to="/"
        className="self-start rounded-md focus-visible:outline-2 focus-visible:outline-accent"
      >
        <BrandMark />
      </Link>
      <div className="flex flex-1 items-center">{body}</div>
    </main>
  );
}
