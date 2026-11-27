import { forwardRef, type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import './effects.css';

/**
 * Primary button with an occasional sheen sweeping in reading direction. Reserved for the plan /
 * upgrade call to action (DESIGN_SYSTEM §14) — never in forms or dialogs. No sheen when reduced
 * motion, reduced transparency or increased contrast is on.
 */
export const ShimmerButton = forwardRef<HTMLButtonElement, ComponentProps<typeof Button>>(
  function ShimmerButton({ className, ...props }, ref) {
    return <Button ref={ref} className={cn('fx-root fx-shimmer', className)} {...props} />;
  },
);
