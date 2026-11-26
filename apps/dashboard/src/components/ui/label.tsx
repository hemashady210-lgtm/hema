import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-subheadline font-medium text-text-primary select-none', className)}
    {...props}
  />
));
Label.displayName = 'Label';
