import { cn } from '@/lib/utils';

/**
 * A thin usage meter (role="meter"). Colour follows DESIGN_SYSTEM §8 (< 80 % primary, ≥ 80 %
 * warning, 100 % danger) but the numbers are always written next to it, so colour is never the
 * only signal. Fills from the inline start, so it mirrors in RTL.
 */
export function UsageMeter({
  value,
  max,
  label,
  valueText,
  className,
}: {
  value: number;
  max: number | null;
  label: string;
  valueText: string;
  className?: string;
}) {
  const share = max && max > 0 ? Math.min(value / max, 1) : 0;
  const tone = !max ? 'primary' : share >= 1 ? 'danger' : share >= 0.8 ? 'warning' : 'primary';
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max ?? undefined}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-(--duration-emphasized) ease-(--ease-emphasized)',
          tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-primary',
        )}
        style={{ width: `${max ? Math.max(share * 100, value > 0 ? 3 : 0) : 0}%` }}
      />
    </div>
  );
}
