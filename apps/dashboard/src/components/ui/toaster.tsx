import { Toaster as Sonner } from 'sonner';
import { usePreferences } from '@/app/preferences';

/** Toasts at the end-bottom corner; theme and direction aware. */
export function Toaster() {
  const { resolvedTheme, dir } = usePreferences();
  return (
    <Sonner
      theme={resolvedTheme}
      dir={dir}
      position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'}
      closeButton={false}
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-lg !border !border-border !bg-elevated !text-text-primary !shadow-e3 !font-[inherit] !text-callout',
          description: '!text-text-secondary',
          success: '[&_[data-icon]]:!text-success',
          error: '[&_[data-icon]]:!text-danger',
        },
      }}
    />
  );
}
