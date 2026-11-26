import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import { overlayClass } from './dialog';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

/** Slides in from the start side (mobile navigation), mirrored in RTL. */
export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={overlayClass} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'material-chrome fixed inset-y-0 start-0 z-50 flex w-[min(20rem,86vw)] flex-col border-e shadow-e3',
        'data-[state=open]:animate-in data-[state=open]:duration-(--duration-emphasized) data-[state=closed]:animate-out data-[state=closed]:duration-(--duration-standard)',
        'ltr:data-[state=open]:slide-in-from-left ltr:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-right rtl:data-[state=closed]:slide-out-to-right',
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = 'SheetContent';
