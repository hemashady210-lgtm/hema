import { useEffect, useMemo, useRef } from 'react';
import type { Locale } from '@ai-crm/shared';
import { intlLocale } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useActive, usePrefersReducedMotion } from './env';

/**
 * Counts up to a real value once it is on screen (KPI / usage cards). Formatting follows the
 * locale and the person's numeral style; screen readers only ever get the final value; width is
 * reserved up front so nothing shifts; reduced motion shows the value immediately.
 */
export function NumberTicker({
  value,
  locale,
  numerals = 'latin',
  options,
  className,
}: {
  value: number;
  locale: Locale;
  numerals?: 'latin' | 'arabic_indic';
  options?: Intl.NumberFormatOptions;
  className?: string;
}) {
  const fmt = useMemo(
    () => new Intl.NumberFormat(intlLocale(locale, numerals), options),
    [locale, numerals, options],
  );
  const finalText = fmt.format(value);
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const visible = useActive(ref, '0px');
  // What the person currently sees. A new run (value change, StrictMode re-run) continues from
  // here, so the count never jumps or restarts from 0 mid-way.
  const displayed = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = finalText;
      displayed.current = value;
      return;
    }
    if (!visible) return;
    const from = displayed.current;
    if (from === value) {
      el.textContent = finalText;
      return;
    }
    // A short ease-out count (no animation library: keeps Motion out of route bundles).
    // Timed on the frame clock itself: a frame's timestamp can precede performance.now() taken
    // here, which would make progress negative and briefly show a value below `from` (e.g. "-1").
    const duration = 900;
    let start = -1;
    let frame = 0;
    const tick = (now: number) => {
      if (start < 0) start = now;
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (value - from) * eased);
      displayed.current = current;
      el.textContent = fmt.format(current);
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        displayed.current = value;
        el.textContent = finalText;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, visible, reduced, fmt, finalText]);

  return (
    <span className={cn('relative inline-block tabular-nums', className)}>
      <span className="sr-only">{finalText}</span>
      <span
        aria-hidden
        ref={ref}
        className="inline-block"
        style={{ minWidth: `${finalText.length}ch` }}
      >
        {reduced ? finalText : fmt.format(0)}
      </span>
    </span>
  );
}
