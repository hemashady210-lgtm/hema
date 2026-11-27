import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * A thin bar at the top while a lazy page loads (route code splitting adds that wait). Appears
 * only after 150 ms so fast navigations don't flash; screen readers hear "Loading…". Grows from
 * the inline start, so it mirrors in Arabic; static under reduced motion.
 */
export function NavigationProgress() {
  const { t } = useTranslation();
  const busy = useNavigation().state === 'loading';
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!busy) {
      setShown(false);
      return;
    }
    const id = setTimeout(() => setShown(true), 150);
    return () => clearTimeout(id);
  }, [busy]);
  return (
    <>
      <div
        aria-hidden
        data-testid="navigation-progress"
        data-state={shown ? 'loading' : 'idle'}
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-(--duration-standard)',
          shown ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="h-full w-1/3 bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] motion-safe:animate-[nav-progress_1.1s_var(--ease-standard)_infinite] rtl:bg-[linear-gradient(270deg,transparent,var(--accent),transparent)]" />
      </div>
      <span role="status" className="sr-only">
        {shown ? t('common.loading') : ''}
      </span>
    </>
  );
}
