import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from 'react';
import { Avatar as A, Separator as S, Tabs as Tb } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Avatar --------------------------------------------------------------------------------
export function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  return (
    <A.Root
      className={cn(
        'relative inline-flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-royal-900 text-caption font-semibold text-royal-100 ring-1 ring-border light:bg-royal-100 light:text-royal-800',
        className,
      )}
    >
      {src ? <A.Image src={src} alt="" className="size-full object-cover" /> : null}
      <A.Fallback delayMs={src ? 300 : 0}>{name}</A.Fallback>
    </A.Root>
  );
}

// Badge / status pill (DESIGN_SYSTEM §8: dot + label, color is never the only signal) -------
export const badgeVariants = cva(
  'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-caption font-medium ring-1 ring-inset',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-text-secondary ring-border',
        primary: 'bg-primary/12 text-royal-200 ring-primary/30 light:text-royal-700',
        info: 'bg-info/10 text-info ring-info/25',
        success: 'bg-success/10 text-success ring-success/25',
        warning: 'bg-warning/10 text-warning ring-warning/25',
        danger: 'bg-danger/10 text-danger ring-danger/25',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  tone,
  dot,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

// Skeleton --------------------------------------------------------------------------------
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-md bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--surface-3)_50%,var(--surface-2)_100%)] bg-[length:200%_100%] motion-safe:animate-[shimmer_1.6s_ease-in-out_infinite]',
        className,
      )}
      {...props}
    />
  );
}

// Separator ---------------------------------------------------------------------------------
export const Separator = forwardRef<
  ElementRef<typeof S.Root>,
  ComponentPropsWithoutRef<typeof S.Root>
>(({ className, orientation = 'horizontal', ...props }, ref) => (
  <S.Root
    ref={ref}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
));
Separator.displayName = 'Separator';

// Tabs (segmented) ----------------------------------------------------------------------------
export const Tabs = Tb.Root;
export const TabsContent = Tb.Content;

export const TabsList = forwardRef<
  ElementRef<typeof Tb.List>,
  ComponentPropsWithoutRef<typeof Tb.List>
>(({ className, ...props }, ref) => (
  <Tb.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center gap-1 rounded-md bg-surface-2 p-1 ring-1 ring-border',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<
  ElementRef<typeof Tb.Trigger>,
  ComponentPropsWithoutRef<typeof Tb.Trigger>
>(({ className, ...props }, ref) => (
  <Tb.Trigger
    ref={ref}
    className={cn(
      'inline-flex h-8 flex-1 items-center justify-center rounded-sm px-3 text-subheadline font-medium text-text-secondary transition-colors duration-(--duration-micro)',
      'hover:text-text-primary data-[state=active]:bg-elevated data-[state=active]:text-text-primary data-[state=active]:shadow-e1',
      'focus-visible:outline-2 focus-visible:outline-accent',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

// Kbd -----------------------------------------------------------------------------------------
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      dir="ltr"
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border-strong bg-surface-1 px-1 font-sans text-caption text-text-tertiary',
        className,
      )}
      {...props}
    />
  );
}
