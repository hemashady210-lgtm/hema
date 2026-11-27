import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { canUseWebGL, useActive, usePrefersPlainSurfaces, whenIdle } from './env';
import './effects.css';

// three + react-three-fiber live in their own chunk; it is requested only after the page is idle
// and only when canUseWebGL() passes (desktop, no reduced motion, no Save-Data, WebGL2, ≥ 4 cores).
const BrandScene3D = lazy(() => import('./brand-scene-3d'));

/**
 * The assistant core of the signature scene (H2/H4). A CSS poster renders immediately at the same
 * size (no layout shift); on capable desktops the WebGL glass core fades in over it once its
 * first frame is drawn, and stops rendering while off-screen or in a hidden tab.
 */
export function BrandCore({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const [webgl, setWebgl] = useState(false);
  const [ready, setReady] = useState(false);
  // Increase Contrast / Reduce Transparency: the static poster only, without its glow.
  const plain = usePrefersPlainSurfaces();
  useEffect(() => (plain ? undefined : whenIdle(() => setWebgl(canUseWebGL()))), [plain]);
  return (
    <div ref={ref} aria-hidden className={cn('relative', className)}>
      <CorePoster
        plain={plain}
        className={cn('transition-opacity duration-700', ready && !plain && 'opacity-0')}
      />
      {webgl && !plain ? (
        <Suspense fallback={null}>
          <BrandScene3D
            active={active}
            onReady={() => setReady(true)}
            className={cn(
              'absolute inset-0 opacity-0 transition-opacity duration-700',
              ready && 'opacity-100',
            )}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

/** Static stand-in: a lit glass sphere with an orbit ring (also the reduced-motion frame). */
export function CorePoster({ className, plain = false }: { className?: string; plain?: boolean }) {
  return (
    <div className={cn('absolute inset-0 grid place-items-center', className)}>
      <div className="relative size-[46%]">
        {plain ? null : (
          <div
            data-testid="core-halo"
            className="decor-light absolute -inset-[30%] rounded-full bg-[radial-gradient(closest-side,rgb(61_99_240/0.35),transparent)]"
          />
        )}
        <div className="decor-glow absolute inset-0 rounded-full bg-[radial-gradient(circle_at_34%_28%,#ffffff_0%,#9fb4ff_14%,#3d63f0_48%,#1e3aa8_78%,#0f1c4d_100%)] shadow-[0_30px_60px_-20px_rgb(61_99_240/0.7),inset_0_-12px_30px_rgb(0_168_255/0.35)]" />
        <div className="absolute inset-[-22%] rounded-full border border-white/15 [transform:rotateX(70deg)_rotateZ(-18deg)]" />
        <div className="absolute inset-[-38%] rounded-full border border-electric-400/20 [transform:rotateX(72deg)_rotateZ(24deg)]" />
      </div>
    </div>
  );
}
