import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from 'react';
import { DropdownMenu as M } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuGroup = M.Group;
export const DropdownMenuRadioGroup = M.RadioGroup;
export const DropdownMenuSub = M.Sub;

export const menuContentClass = cn(
  'material-regular z-50 min-w-48 overflow-hidden rounded-lg p-1 text-text-primary shadow-e3',
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
);
const itemClass = cn(
  'relative flex min-h-9 cursor-default select-none items-center gap-2.5 rounded-sm px-2.5 text-callout outline-none transition-colors',
  'data-[highlighted]:bg-surface-3 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-text-tertiary',
);

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof M.Content>,
  ComponentPropsWithoutRef<typeof M.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <M.Portal>
    <M.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(menuContentClass, className)}
      {...props}
    />
  </M.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof M.Item>,
  ComponentPropsWithoutRef<typeof M.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <M.Item
    ref={ref}
    className={cn(
      itemClass,
      destructive && 'text-danger data-[highlighted]:bg-danger/10 [&_svg]:text-danger',
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuRadioItem = forwardRef<
  ElementRef<typeof M.RadioItem>,
  ComponentPropsWithoutRef<typeof M.RadioItem>
>(({ className, children, ...props }, ref) => (
  <M.RadioItem ref={ref} className={cn(itemClass, 'pe-8', className)} {...props}>
    {children}
    <M.ItemIndicator className="absolute end-2.5">
      <Check aria-hidden className="!text-accent" />
    </M.ItemIndicator>
  </M.RadioItem>
));
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

export const DropdownMenuSubTrigger = forwardRef<
  ElementRef<typeof M.SubTrigger>,
  ComponentPropsWithoutRef<typeof M.SubTrigger>
>(({ className, ...props }, ref) => (
  <M.SubTrigger
    ref={ref}
    className={cn(itemClass, 'data-[state=open]:bg-surface-3', className)}
    {...props}
  />
));
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

export const DropdownMenuSubContent = forwardRef<
  ElementRef<typeof M.SubContent>,
  ComponentPropsWithoutRef<typeof M.SubContent>
>(({ className, ...props }, ref) => (
  <M.Portal>
    <M.SubContent ref={ref} className={cn(menuContentClass, className)} {...props} />
  </M.Portal>
));
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof M.Label>,
  ComponentPropsWithoutRef<typeof M.Label>
>(({ className, ...props }, ref) => (
  <M.Label
    ref={ref}
    className={cn('px-2.5 py-1.5 text-footnote text-text-tertiary', className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof M.Separator>,
  ComponentPropsWithoutRef<typeof M.Separator>
>(({ className, ...props }, ref) => (
  <M.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export function DropdownMenuShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ms-auto text-footnote text-text-tertiary', className)} {...props} />;
}
