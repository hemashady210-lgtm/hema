import { useId, useRef, type CSSProperties } from 'react';
import { usePreferences } from '@/app/preferences';
import { cn } from '@/lib/utils';
import { useActive } from './env';
import './effects.css';

export interface Beam {
  /** Start and end in a 0–100 logical coordinate space (x measured from the inline start). */
  from: [number, number];
  to: [number, number];
  /** Bend of the curve, in the same units (positive bends toward the block end). */
  curvature?: number;
  delay?: number;
  duration?: number;
}

/**
 * Light pulses travelling along curved paths toward their target (channels → assistant core).
 * Coordinates are logical: in RTL the drawing mirrors, and pulses still flow source → target.
 * Stroke widths do not scale with the box. Decorative: aria-hidden.
 */
export function AnimatedBeams({ beams, className }: { beams: Beam[]; className?: string }) {
  const { dir } = usePreferences();
  const id = useId().replace(/:/g, '');
  const ref = useRef<SVGSVGElement>(null);
  const active = useActive(ref);
  const x = (v: number) => (dir === 'rtl' ? 100 - v : v);
  return (
    <svg
      ref={ref}
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn(
        'fx-root pointer-events-none absolute inset-0 size-full',
        !active && 'fx-paused',
        className,
      )}
    >
      {beams.map((b, i) => {
        const [x1, y1] = [x(b.from[0]), b.from[1]];
        const [x2, y2] = [x(b.to[0]), b.to[1]];
        const mx = (x1 + x2) / 2;
        const c = b.curvature ?? 0;
        const d = `M${x1} ${y1} C${mx} ${y1 + c} ${mx} ${y2 - c} ${x2} ${y2}`;
        return (
          <g key={i}>
            <defs>
              <linearGradient
                id={`${id}-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
              >
                <stop offset="0" stopColor="#2EBBFF" stopOpacity="0.2" />
                <stop offset="0.5" stopColor="#2EBBFF" />
                <stop offset="1" stopColor="#7C95FF" />
              </linearGradient>
            </defs>
            <path
              d={d}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={d}
              fill="none"
              pathLength={100}
              stroke={`url(#${id}-${i})`}
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="fx-beam-pulse"
              style={
                {
                  '--fx-beam-delay': `${b.delay ?? i * 0.45}s`,
                  '--fx-beam-dur': `${b.duration ?? 2.8}s`,
                } as CSSProperties
              }
            />
          </g>
        );
      })}
    </svg>
  );
}
