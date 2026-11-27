import { useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { useActive, usePrefersPlainSurfaces } from './env';
import './effects.css';

/**
 * Soft Royal/Electric lights drifting behind a surface (auth panel, onboarding, empty states).
 * Decorative only: aria-hidden, no pointer events, paused off-screen, static when reduced.
 */
export function AnimatedGradient({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const plain = usePrefersPlainSurfaces();
  // Increase Contrast / Reduce Transparency: no ambient light at all (review finding 4).
  if (plain) return null;
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('fx-root fx-gradient', !active && 'fx-paused', className)}
    >
      <i />
      <i />
      <i />
    </div>
  );
}

export type ShapeKind = 'tile' | 'orb' | 'ring' | 'pill';

export interface FloatingShape {
  kind: ShapeKind;
  /** Logical position in % of the container (start = left in LTR, right in RTL). */
  start: number;
  top: number;
  /** Size in px. */
  size: number;
  /** Aspect for pills (height = size × aspect). */
  aspect?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  duration?: number;
  delay?: number;
}

/** A calm default composition for empty states (four glass objects at different depths). */
export const EMPTY_STATE_SHAPES: FloatingShape[] = [
  { kind: 'tile', start: 8, top: 16, size: 64, rx: 22, ry: -28, rz: -8, duration: 9 },
  { kind: 'orb', start: 78, top: 10, size: 46, duration: 11, delay: -3 },
  { kind: 'ring', start: 84, top: 58, size: 72, rx: 58, ry: 18, duration: 12, delay: -5 },
  {
    kind: 'pill',
    start: 14,
    top: 66,
    size: 70,
    aspect: 0.36,
    rx: 12,
    ry: 30,
    rz: 18,
    duration: 10,
  },
];

/**
 * CSS 3D glass objects floating behind content (H4: CSS 3D everywhere except the auth panel).
 * Positions use inset-inline-start, so the composition mirrors in RTL; shading stays lit from
 * the top so objects never look upside-down.
 */
export function FloatingShapes({
  shapes = EMPTY_STATE_SHAPES,
  className,
}: {
  shapes?: FloatingShape[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const plain = usePrefersPlainSurfaces();
  // Increase Contrast / Reduce Transparency: no floating glass (review finding 4).
  if (plain) return null;
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('fx-root fx-shapes', !active && 'fx-paused', className)}
    >
      {shapes.map((s, i) => (
        <span
          key={i}
          className={`fx-shape fx-shape--${s.kind}`}
          style={
            {
              insetInlineStart: `${s.start}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size * (s.aspect ?? 1),
              '--fx-rx': `${s.rx ?? 18}deg`,
              '--fx-ry': `${s.ry ?? -24}deg`,
              '--fx-rz': `${s.rz ?? 0}deg`,
              '--fx-float-dur': `${s.duration ?? 9}s`,
              '--fx-float-delay': `${s.delay ?? 0}s`,
            } as CSSProperties
          }
        >
          <b />
        </span>
      ))}
    </div>
  );
}
