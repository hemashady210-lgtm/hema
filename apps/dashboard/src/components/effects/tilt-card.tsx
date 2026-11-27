import { useRef, type PointerEvent, type ReactNode } from 'react';
import { LazyMotion, domAnimation, m, useMotionValue, useSpring, useTransform } from 'motion/react';
import { usePreferences } from '@/app/preferences';
import { cn } from '@/lib/utils';
import { useFinePointer, usePrefersReducedMotion } from './env';

const MAX_TILT = 8;

/**
 * 3D tilt that follows the pointer (≤ 8°) with a spring. At rest the card turns slightly
 * toward the inline-start side (where its form lives), so the resting pose mirrors in RTL;
 * the pointer-follow itself is physical and never mirrors. Static rest pose when reduced
 * motion or no fine pointer.
 */
export function TiltCard({ className, children }: { className?: string; children: ReactNode }) {
  const { dir } = usePreferences();
  const reduced = usePrefersReducedMotion();
  const fine = useFinePointer();
  const interactive = fine && !reduced;
  const restY = dir === 'rtl' ? 6 : -6;
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 170, damping: 22, mass: 0.6 };
  const rotateY = useSpring(
    useTransform(px, (v) => restY + (v - 0.5) * 2 * MAX_TILT),
    spring,
  );
  const rotateX = useSpring(
    useTransform(py, (v) => 4 - (v - 0.5) * 2 * MAX_TILT),
    spring,
  );
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => {
    px.set(0.5);
    py.set(0.5);
  };
  return (
    <div className={cn('[perspective:1100px]', className)}>
      <LazyMotion features={domAnimation} strict>
        <m.div
          ref={ref}
          onPointerMove={interactive ? onMove : undefined}
          onPointerLeave={interactive ? reset : undefined}
          style={
            interactive
              ? { rotateX, rotateY, transformStyle: 'preserve-3d' }
              : { transform: `rotateX(4deg) rotateY(${restY}deg)` }
          }
          className="will-change-transform"
        >
          {children}
        </m.div>
      </LazyMotion>
    </div>
  );
}
