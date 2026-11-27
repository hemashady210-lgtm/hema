import { act, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AnimatedGradient, FloatingShapes } from '@/components/effects/ambient';
import { AnimatedBeams } from '@/components/effects/animated-beam';
import { BrandCore } from '@/components/effects/brand-core';
import { TiltCard } from '@/components/effects/tilt-card';
import { canUseWebGL } from '@/components/effects/env';
import { NumberTicker } from '@/components/effects/number-ticker';
import { ShimmerButton } from '@/components/effects/shimmer-button';
import { BrandMark } from '@/components/brand-mark';
import { renderWithProviders } from './render';

function setLocale(l: 'ar' | 'en') {
  localStorage.setItem('ai-crm.locale', l);
}

/** Make one media query match (the setup stub matches nothing). */
function mockMedia(match: (q: string) => boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: match(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

describe('effects: accessibility and RTL', () => {
  it('decorative layers are hidden from assistive technology', () => {
    const { container } = render(
      <>
        <AnimatedGradient />
        <FloatingShapes />
      </>,
    );
    const layers = container.querySelectorAll('.fx-gradient, .fx-shapes');
    expect(layers).toHaveLength(2);
    layers.forEach((el) => expect(el).toHaveAttribute('aria-hidden', 'true'));
  });

  it('floating shapes are positioned with logical insets so they mirror in RTL', () => {
    const { container } = render(<FloatingShapes />);
    const shape = container.querySelector<HTMLElement>('.fx-shape');
    expect(shape?.style.insetInlineStart).toMatch(/%$/);
    expect(shape?.style.left).toBe('');
  });

  it('beams mirror their drawing in RTL but still flow toward the target', async () => {
    const beams = [{ from: [10, 20], to: [80, 50] }] as const;
    setLocale('en');
    const ltr = renderWithProviders(
      <AnimatedBeams beams={beams.map((b) => ({ from: [...b.from], to: [...b.to] }))} />,
    );
    const ltrPath = ltr.container.querySelector('path')?.getAttribute('d');
    ltr.unmount();
    setLocale('ar');
    const rtl = renderWithProviders(
      <AnimatedBeams beams={beams.map((b) => ({ from: [...b.from], to: [...b.to] }))} />,
    );
    const rtlPath = rtl.container.querySelector('path')?.getAttribute('d');
    expect(ltrPath).toMatch(/^M10 20 /);
    expect(ltrPath).toMatch(/ 80 50$/);
    // Mirrored x (100 − x), same source → target order.
    expect(rtlPath).toMatch(/^M90 20 /);
    expect(rtlPath).toMatch(/ 20 50$/);
  });

  it('tilt card rests turned toward the inline start (mirrors in RTL) when motion is reduced', () => {
    const restore = mockMedia((q) => q.includes('prefers-reduced-motion'));
    setLocale('en');
    const ltr = renderWithProviders(<TiltCard>card</TiltCard>);
    expect(ltr.getByText('card').getAttribute('style')).toContain('rotateY(-6deg)');
    ltr.unmount();
    setLocale('ar');
    const rtl = renderWithProviders(<TiltCard>card</TiltCard>);
    expect(rtl.getByText('card').getAttribute('style')).toContain('rotateY(6deg)');
    restore();
  });

  it('the brand lockup is an LTR island that never translates the name', () => {
    setLocale('ar');
    renderWithProviders(<BrandMark />);
    const name = screen.getByText('Pro Coders');
    const lockup = name.closest('[dir]');
    expect(lockup).toHaveAttribute('dir', 'ltr');
    expect(lockup).toHaveAttribute('translate', 'no');
  });
});

describe('effects: number ticker', () => {
  it('exposes only the final, locale-formatted value to screen readers', () => {
    render(<NumberTicker value={12500} locale="en" />);
    expect(screen.getByText('12,500')).toHaveClass('sr-only');
  });

  it('formats Arabic with Latin digits by default and Arabic-Indic digits on request', () => {
    render(
      <>
        <NumberTicker value={42} locale="ar" />
        <NumberTicker value={42} locale="ar" numerals="arabic_indic" />
      </>,
    );
    expect(screen.getByText('42')).toHaveClass('sr-only');
    expect(screen.getByText('٤٢')).toHaveClass('sr-only');
  });

  it('shows the final value immediately when reduced motion is on', () => {
    const restore = mockMedia((q) => q.includes('prefers-reduced-motion'));
    const { container } = render(<NumberTicker value={7} locale="en" />);
    expect(container.querySelector('[aria-hidden]')?.textContent).toBe('7');
    restore();
  });

  it('counts up to the real value', async () => {
    const { container } = render(<NumberTicker value={3} locale="en" />);
    await waitFor(() => expect(container.querySelector('[aria-hidden]')?.textContent).toBe('3'), {
      timeout: 4000,
    });
  });

  it('a new value counts on from what is shown — never back from 0 — and ends on it', async () => {
    const { container, rerender } = render(<NumberTicker value={40} locale="en" />);
    const shown = () => Number(container.querySelector('[aria-hidden]')?.textContent);
    await waitFor(() => expect(shown()).toBe(40), { timeout: 4000 });
    const seen: number[] = [];
    const observer = new MutationObserver(() => seen.push(shown()));
    observer.observe(container, { subtree: true, characterData: true, childList: true });
    rerender(<NumberTicker value={45} locale="en" />);
    await waitFor(() => expect(shown()).toBe(45), { timeout: 4000 });
    observer.disconnect();
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(40);
    expect(container.querySelector('.sr-only')?.textContent).toBe('45');
  });
});

describe('effects: Increase Contrast and Reduce Transparency (review finding 4)', () => {
  for (const query of ['prefers-contrast: more', 'prefers-reduced-transparency: reduce']) {
    it(`drops floating shapes, ambient light and the core halo under (${query})`, () => {
      const restore = mockMedia((q) => q.includes(query));
      const { container } = render(
        <>
          <AnimatedGradient />
          <FloatingShapes />
          <BrandCore className="size-40" />
        </>,
      );
      expect(container.querySelector('.fx-gradient, .fx-shapes')).toBeNull();
      expect(screen.queryByTestId('core-halo')).toBeNull();
      // The core itself stays (it is content-like branding), just without glow layers.
      expect(container.querySelector('.decor-glow')).not.toBeNull();
      restore();
    });
  }

  it('keeps them with default settings', () => {
    const { container } = render(
      <>
        <AnimatedGradient />
        <FloatingShapes />
        <BrandCore className="size-40" />
      </>,
    );
    expect(container.querySelectorAll('.fx-gradient, .fx-shapes')).toHaveLength(2);
    expect(screen.getByTestId('core-halo')).toBeInTheDocument();
  });
});

describe('effects: visibility and measuring', () => {
  it('uses the latest of batched intersection entries (scrolled out then back in = running)', () => {
    let notify: (entries: Array<{ isIntersecting: boolean }>) => void = () => {};
    const original = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        notify = cb;
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
    const { container } = render(<FloatingShapes />);
    const layer = () => container.querySelector('.fx-shapes')!;
    act(() => notify([{ isIntersecting: true }, { isIntersecting: false }]));
    expect(layer()).toHaveClass('fx-paused');
    act(() => notify([{ isIntersecting: false }, { isIntersecting: true }]));
    expect(layer()).not.toHaveClass('fx-paused');
    globalThis.IntersectionObserver = original;
  });

  it('beams are drawn in the measured pixel box from the first paint', () => {
    const w = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(400);
    const h = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(200);
    setLocale('en');
    const { container } = renderWithProviders(
      <AnimatedBeams beams={[{ from: [10, 20], to: [80, 50] }]} />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 400 200');
    expect(container.querySelector('path')?.getAttribute('d')).toMatch(/^M40 40 .* 320 100$/);
    w.mockRestore();
    h.mockRestore();
  });
});

describe('effects: heavy paths stay off', () => {
  it('never enables WebGL without a capable desktop (jsdom has no WebGL2)', () => {
    expect(canUseWebGL()).toBe(false);
  });

  it('the brand core renders its static poster and no canvas', () => {
    const { container } = render(<BrandCore className="size-40" />);
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('the shimmer button is a normal button with the sheen class', () => {
    render(<ShimmerButton>View plans</ShimmerButton>);
    expect(screen.getByRole('button', { name: 'View plans' })).toHaveClass('fx-shimmer');
  });
});
