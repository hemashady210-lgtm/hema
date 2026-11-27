import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { Popover as P } from 'radix-ui';
import { cn } from '@/lib/utils';
import { menuContentClass } from './dropdown-menu';

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;

export const PopoverContent = forwardRef<
  ElementRef<typeof P.Content>,
  ComponentPropsWithoutRef<typeof P.Content>
>(({ className, align = 'end', sideOffset = 8, ...props }, ref) => (
  <P.Portal>
    <P.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(menuContentClass, 'w-80 p-0', className)}
      {...props}
    />
  </P.Portal>
));
PopoverContent.displayName = 'PopoverContent';
