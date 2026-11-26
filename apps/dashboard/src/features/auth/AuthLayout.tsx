import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router';
import { BRAND } from '@ai-crm/shared';
import { BrandMark } from '@/components/brand-mark';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeMenu } from '@/components/theme-menu';
import { BrandPanel } from './BrandPanel';

/** Split layout: form on the start side, brand panel on the end side (≥ lg). */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-dvh flex-col px-5 py-5 sm:px-10 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-accent">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeMenu />
          </div>
        </header>
        <main id="main" className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-[400px]">
            <Outlet />
          </div>
        </main>
        <footer className="text-footnote text-text-tertiary">
          <bdi dir="ltr">
            © {new Date().getFullYear()} {BRAND.productName}
          </bdi>
        </footer>
      </div>
      <BrandPanel />
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <h1 className="text-title-1 font-semibold tracking-[-0.01em] text-text-primary">{title}</h1>
      {subtitle ? <p className="text-callout text-text-secondary">{subtitle}</p> : null}
    </div>
  );
}
