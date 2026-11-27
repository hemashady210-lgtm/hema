import { useId } from 'react';
import { BRAND } from '@ai-crm/shared';
import { cn } from '@/lib/utils';

/**
 * Pro Coders mark: a speech bubble holding a code prompt (›_) on a Royal → Electric tile —
 * conversations, built by coders. Geometry is shared with scripts/brand/build-wordmark.py
 * (favicon + docs/brand/*.svg); keep both in sync. Logos never mirror in RTL
 * (HIG right-to-left › "Don't flip logos"), so the lockup is an LTR island in every locale.
 */
export function BrandGlyph({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 40 40" aria-hidden focusable="false" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id={`${id}g`} x1="4" y1="2" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5A7BFF" />
          <stop offset=".55" stopColor="#3D63F0" />
          <stop offset="1" stopColor="#1E3AA8" />
        </linearGradient>
        <radialGradient id={`${id}r`} cx="35" cy="37" r="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2EBBFF" stopOpacity=".95" />
          <stop offset="1" stopColor="#2EBBFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={TILE} fill={`url(#${id}g)`} />
      <path d={TILE} fill={`url(#${id}r)`} opacity=".75" />
      <path
        d={TILE}
        fill="none"
        stroke="#fff"
        strokeOpacity=".16"
        transform="translate(.5 .5) scale(.975)"
      />
      <path d={BUBBLE} fill="#fff" />
      <path
        d="M15.3 15.4L18.8 18.15L15.3 20.9"
        stroke="#2747D1"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M20.9 20.9H25.6" stroke="#3D63F0" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

const TILE =
  'M12.4 0H27.6C35.2 0 40 4.8 40 12.4V27.6C40 35.2 35.2 40 27.6 40H12.4C4.8 40 0 35.2 0 27.6V12.4C0 4.8 4.8 0 12.4 0Z';
const BUBBLE =
  'M14.6 9.8H25.4C28.5 9.8 31 12.3 31 15.4V20.9C31 24 28.5 26.5 25.4 26.5H18L13.1 30.4C12.4 30.95 11.4 30.4 11.55 29.5L12.05 26.1C10.3 25.2 9 23.2 9 20.9V15.4C9 12.3 11.5 9.8 14.6 9.8Z';

/** Mark + wordmark lockup. The name comes from brand.ts only and stays Latin in Arabic (H1). */
export function BrandMark({
  className,
  showName = true,
  size = 'md',
}: {
  className?: string;
  showName?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span
      dir="ltr"
      translate="no"
      className={cn('inline-flex items-center', size === 'lg' ? 'gap-3' : 'gap-2.5', className)}
    >
      <BrandGlyph className={size === 'lg' ? 'size-10' : size === 'sm' ? 'size-6' : 'size-7'} />
      {showName ? (
        <span
          className={cn(
            'wordmark font-semibold whitespace-nowrap text-text-primary',
            size === 'lg' ? 'text-title-3' : 'text-headline',
          )}
        >
          {BRAND.productName}
        </span>
      ) : null}
    </span>
  );
}
