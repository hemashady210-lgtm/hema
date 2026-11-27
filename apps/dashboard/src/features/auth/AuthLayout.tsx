import { lazy, Suspense, type ReactNode } from 'react';
import { Link, Outlet } from 'react-router';
import { BRAND } from '@ai-crm/shared';
import { BrandMark } from '@/components/brand-mark';
import { useIsDesktop } from '@/components/effects/env';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeMenu } from '@/components/theme-menu';
import { cn } from '@/lib/utils';

// The brand panel (and its effects / WebGL chunks) is never downloaded below 1024 px.
const BrandPanel = lazy(() => import('./BrandPanel').then((m) => ({ default: m.BrandPanel })));

/**
 * Split layout: form on the start side, brand panel on the end side (≥ lg). Content is anchored
 * at a fixed top offset — not vertically centred — so headings stay put between auth steps
 * (HIG design principles › Flexibility: "Keep content and controls in consistent, predictable
 * positions"). Below lg a static aurora replaces the panel.
 */
export function AuthLayout() {
  const desktop = useIsDesktop();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative flex min-h-dvh flex-col px-5 py-5 max-lg:bg-aurora sm:px-10 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-accent">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeMenu />
          </div>
        </header>
        <main id="main" className="flex flex-1 justify-center pt-[clamp(40px,13vh,136px)] pb-12">
          <div className="w-full max-w-[400px]">
            <Outlet />
          </div>
        </main>
        <footer className="text-footnote text-text-tertiary">
          <bdi dir="ltr">
            © {new Date().getFullYear()} {BRAND.productName}
          </bdi>
        </footer>
      </div>
      {desktop ? (
        <Suspense fallback={<aside aria-hidden className="hidden bg-[#070b1f] lg:block" />}>
          <BrandPanel />
        </Suspense>
      ) : null}
    </div>
  );
}

/**
 * Page heading for auth screens. An optional icon sits beside the title (not above it), so every
 * step's title starts at the same height.
 */
export function AuthHeading({
  title,
  subtitle,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-8 flex flex-col gap-2', className)}>
      <div className="flex items-center gap-3">
        {icon}
        <h1 className="text-title-1 font-semibold text-text-primary">{title}</h1>
      </div>
      {subtitle ? <p className="text-callout text-text-secondary">{subtitle}</p> : null}
    </div>
  );
}

/** Icon tile used beside status headings (check email, link problems). Decorative. */
export function AuthStatusIcon({
  children,
  tone = 'brand',
}: {
  children: ReactNode;
  tone?: 'brand' | 'warning';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'brand-reveal grid size-10 shrink-0 place-items-center rounded-xl ring-1',
        tone === 'brand'
          ? 'bg-[linear-gradient(145deg,#5a7bff,#2747d1)] text-white shadow-glow ring-white/15'
          : 'bg-warning/12 text-warning ring-warning/30',
      )}
    >
      {children}
    </span>
  );
}
