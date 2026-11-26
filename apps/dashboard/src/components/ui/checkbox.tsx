import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-border-strong bg-surface-2',
      'transition-colors duration-(--duration-micro) data-[state=checked]:border-primary data-[state=checked]:bg-primary',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-invalid:border-destructive',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="text-primary-foreground">
      <Check aria-hidden className="size-3.5" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';
