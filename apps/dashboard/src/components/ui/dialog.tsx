import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const overlayClass =
  'fixed inset-0 z-50 bg-[rgb(3_5_10/0.6)] backdrop-blur-[2px] light:bg-[rgb(15_28_77/0.25)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0';

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => {
  const { t } = useTranslation();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'material-thick fixed start-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-y-1/2 gap-5 overflow-y-auto rounded-xl p-6 shadow-e3',
          'ltr:-translate-x-1/2 rtl:translate-x-1/2',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:duration-(--duration-emphasized)',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97]',
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            aria-label={t('common.close')}
            className="absolute end-4 top-4 grid size-8 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X aria-hidden className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 pe-8', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-title-3 font-semibold text-text-primary', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-callout text-text-secondary', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';
