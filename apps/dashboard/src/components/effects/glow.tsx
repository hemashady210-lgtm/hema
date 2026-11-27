import { useCallback, useRef, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useActive, useFinePointer } from './env';
import './effects.css';

/** A light that travels around the card's edge (plan / upgrade / preview cards only). */
export function GlowBorder({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  return (
    <div ref={ref} className={cn('fx-root fx-glow', !active && 'fx-paused', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Pointer-follow light for KPI and plan cards. CSS variables only (no re-render per move);
 * inert on touch and coarse pointers, hidden under reduced transparency / increased contrast.
 */
export function SpotlightCard({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const onMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--fx-x', `${e.clientX - r.left}px`);
    el.style.setProperty('--fx-y', `${e.clientY - r.top}px`);
  }, []);
  return (
    <div
      ref={ref}
      className={cn('fx-root fx-spotlight', className)}
      onPointerMove={fine ? onMove : undefined}
      onPointerEnter={fine ? () => ref.current?.style.setProperty('--fx-o', '1') : undefined}
      onPointerLeave={fine ? () => ref.current?.style.setProperty('--fx-o', '0') : undefined}
      {...props}
    >
      {children}
    </div>
  );
}
