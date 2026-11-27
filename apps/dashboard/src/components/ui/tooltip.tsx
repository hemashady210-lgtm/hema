import type { ReactNode } from 'react';
import { Tooltip as T } from 'radix-ui';
import { cn } from '@/lib/utils';

export const TooltipProvider = T.Provider;

export function Tooltip({
  content,
  children,
  side = 'top',
  disabled,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 max-w-64 rounded-sm bg-elevated px-2.5 py-1.5 text-footnote text-text-primary shadow-e2 ring-1 ring-border',
            'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
