import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  info: { icon: Info, cls: 'border-info/25 bg-info/8 [&_svg]:text-info' },
  success: { icon: CircleCheck, cls: 'border-success/25 bg-success/8 [&_svg]:text-success' },
  warning: { icon: TriangleAlert, cls: 'border-warning/25 bg-warning/8 [&_svg]:text-warning' },
  danger: { icon: CircleAlert, cls: 'border-danger/25 bg-danger/8 [&_svg]:text-danger' },
} as const;

export function InlineAlert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof TONES;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { icon: Icon, cls } = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-callout',
        cls,
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title ? <p className="font-semibold text-text-primary">{title}</p> : null}
        {children ? <div className="text-text-secondary">{children}</div> : null}
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}
