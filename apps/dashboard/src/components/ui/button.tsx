import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-(--duration-micro) ease-(--ease-standard)',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-e1 hover:bg-[color-mix(in_srgb,var(--primary)_88%,white)] light:hover:bg-[color-mix(in_srgb,var(--primary)_90%,black)]',
        secondary: 'border border-border-strong bg-surface-2 text-text-primary hover:bg-surface-3',
        ghost: 'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
        outline: 'border border-border-strong bg-transparent text-text-primary hover:bg-surface-2',
        destructive:
          'bg-destructive text-white shadow-e1 hover:bg-[color-mix(in_srgb,var(--danger)_88%,black)]',
        link: 'h-auto px-0 text-royal-300 underline-offset-4 hover:underline light:text-primary active:scale-100',
      },
      size: {
        sm: 'h-8 px-3 text-subheadline',
        md: 'h-10 px-4 text-callout',
        lg: 'h-11 px-5 text-body',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean | undefined;
  loading?: boolean | undefined;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
