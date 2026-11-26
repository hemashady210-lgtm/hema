import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-3 py-2', className)}>
      {Icon ? (
        <span className="grid size-10 place-items-center rounded-lg bg-surface-2 text-text-secondary ring-1 ring-border">
          <Icon aria-hidden className="size-5" strokeWidth={1.5} />
        </span>
      ) : null}
      <div className="flex max-w-prose flex-col gap-1">
        <p className="text-headline font-semibold text-text-primary">{title}</p>
        {body ? <p className="text-callout text-text-secondary">{body}</p> : null}
      </div>
      {children}
      {action}
    </div>
  );
}
