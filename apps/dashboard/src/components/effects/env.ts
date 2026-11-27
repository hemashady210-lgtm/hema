import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

/**
 * Shared guards for decorative effects (DESIGN_SYSTEM §14): every effect renders its final,
 * static frame under reduced motion, pauses off-screen and in hidden tabs, and heavy ones load
 * only when the device can afford them.
 */

function mediaStore(query: string) {
  return {
    subscribe(cb: () => void) {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener?.('change', cb);
      return () => mql.removeEventListener?.('change', cb);
    },
    get() {
      return typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
    },
  };
}

const reducedMotion = mediaStore('(prefers-reduced-motion: reduce)');
const reducedTransparency = mediaStore('(prefers-reduced-transparency: reduce)');
const moreContrast = mediaStore('(prefers-contrast: more)');
const desktop = mediaStore('(min-width: 1024px)');
const finePointer = mediaStore('(hover: hover) and (pointer: fine)');

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(reducedMotion.subscribe, reducedMotion.get, () => false);
}

/** Glows and translucency are dropped when people ask for less transparency or more contrast. */
export function usePrefersPlainSurfaces(): boolean {
  const a = useSyncExternalStore(
    reducedTransparency.subscribe,
    reducedTransparency.get,
    () => false,
  );
  const b = useSyncExternalStore(moreContrast.subscribe, moreContrast.get, () => false);
  return a || b;
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(desktop.subscribe, desktop.get, () => false);
}

/** Pointer-driven effects (spotlight, tilt) only make sense with a hovering, precise pointer. */
export function useFinePointer(): boolean {
  return useSyncExternalStore(finePointer.subscribe, finePointer.get, () => false);
}

const visibility = {
  subscribe(cb: () => void) {
    document.addEventListener('visibilitychange', cb);
    return () => document.removeEventListener('visibilitychange', cb);
  },
  get: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
};

/** True while the element is on screen and the tab is visible (no observer → assume visible). */
export function useActive(ref: RefObject<Element | null>, rootMargin = '120px'): boolean {
  const [inView, setInView] = useState(true);
  const pageVisible = useSyncExternalStore(visibility.subscribe, visibility.get, () => true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true), {
      rootMargin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView && pageVisible;
}

type NetworkInformation = { saveData?: boolean };

/**
 * WebGL budget gate (H4): desktop width, no reduced motion, no Save-Data, ≥ 4 logical cores and
 * a working WebGL2 context. Evaluated once per mount; never true in tests (no canvas).
 */
export function canUseWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  if (!desktop.get() || reducedMotion.get()) return false;
  const nav = navigator as Navigator & { connection?: NetworkInformation };
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 0) < 4) return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Runs `cb` when the browser is idle (falls back to a short timeout). */
export function whenIdle(cb: () => void, timeout = 1200): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(cb, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, 300);
  return () => window.clearTimeout(id);
}
