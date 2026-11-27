import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
 * Coordinates are logical (0–100 of the measured box): in RTL the drawing mirrors and pulses still
 * flow source → target. Decorative: aria-hidden.
 */
export function AnimatedBeams({ beams, className }: { beams: Beam[]; className?: string }) {
  const { dir } = usePreferences();
  const id = useId().replace(/:/g, '');
  const ref = useRef<SVGSVGElement>(null);
  const active = useActive(ref);
  // Draw in real pixels, so dash lengths and stroke widths stay true at any size.
  const [box, setBox] = useState({ w: 100, h: 100 });
  // Measured before paint (no 100×100 first frame); layout size, so ancestor transforms
  // don't skew it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (w: number, h: number) => {
      if (w && h) setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
    };
    measure(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const x = (v: number) => ((dir === 'rtl' ? 100 - v : v) * box.w) / 100;
  const y = (v: number) => (v * box.h) / 100;
  return (
    <svg
      ref={ref}
      aria-hidden
      viewBox={`0 0 ${box.w} ${box.h}`}
      className={cn(
        'fx-root pointer-events-none absolute inset-0 size-full',
        !active && 'fx-paused',
        className,
      )}
    >
      {beams.map((b, i) => {
        const [x1, y1] = [x(b.from[0]), y(b.from[1])];
        const [x2, y2] = [x(b.to[0]), y(b.to[1])];
        const mx = (x1 + x2) / 2;
        const c = y(b.curvature ?? 0);
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
            <path d={d} fill="none" stroke="rgb(148 170 255 / 0.16)" strokeWidth="1" />
            <path
              d={d}
              fill="none"
              pathLength={100}
              stroke={`url(#${id}-${i})`}
              strokeWidth="2"
              strokeLinecap="round"
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
