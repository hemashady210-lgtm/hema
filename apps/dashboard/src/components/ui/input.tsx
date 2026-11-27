import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const inputClass = cn(
  'flex h-10 w-full min-w-0 rounded-md border border-input bg-surface-2 px-3 text-callout text-text-primary',
  'placeholder:text-text-tertiary transition-[border-color,box-shadow] duration-(--duration-micro)',
  'hover:border-[color-mix(in_srgb,var(--border-strong)_100%,var(--text-tertiary)_15%)]',
  'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/25',
  'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25',
  'disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-surface-1 read-only:text-text-secondary',
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputClass, className)} {...props} />
  ),
);
Input.displayName = 'Input';
