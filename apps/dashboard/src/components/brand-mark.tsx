import { BRAND } from '@ai-crm/shared';
import { usePreferences } from '@/app/preferences';
import { cn } from '@/lib/utils';

/** Product mark: two overlapping speech shapes (customer ↔ assistant). Name from brand.ts only. */
export function BrandMark({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  const { locale } = usePreferences();
  const name = locale === 'ar' ? BRAND.productNameAr : BRAND.productName;
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-7 shrink-0">
        <rect width="32" height="32" rx="9" className="fill-primary" />
        <path
          d="M9 10.5h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-5l-3.5 2.8V20.5H9a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z"
          className="fill-white/95"
        />
        <circle
          cx="23.5"
          cy="10"
          r="3.2"
          className="fill-electric-500 stroke-primary"
          strokeWidth="1.6"
        />
      </svg>
      {showName ? (
        <span className="text-headline font-semibold tracking-[-0.01em] text-text-primary">
          {name}
        </span>
      ) : null}
    </span>
  );
}
