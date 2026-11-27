// WCAG AA contrast for the design tokens (DESIGN_SYSTEM §2.2: "a contrast test runs in CI from P3").
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Vitest runs with the package as cwd (pnpm -r) or the repo root.
const candidates = [
  join(process.cwd(), 'src/styles/tokens.css'),
  join(process.cwd(), 'apps/dashboard/src/styles/tokens.css'),
];
const css = readFileSync(
  candidates.find((p) => existsSync(p))!,
  'utf8',
);

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  );
}

const dark = block(':root');
const light = { ...dark, ...block("[data-theme='light']") };

function resolve(vars: Record<string, string>, name: string): string {
  let v = vars[name]!;
  while (v?.startsWith('var(')) v = vars[v.slice(6, -1)]!;
  return v.split(/\s/)[0]!;
}

function lum(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(a: string, b: string): number {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

const SURFACES = ['background', 'surface-1', 'surface-2', 'surface-3', 'elevated'];
const TEXT = [
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'danger',
  'success',
  'warning',
  'info',
];

describe.each([
  ['dark', dark],
  ['light', light],
])('%s theme', (_name, vars) => {
  it.each(TEXT.flatMap((t) => SURFACES.map((s) => [t, s])))('%s on %s ≥ 4.5:1', (text, surface) => {
    expect(ratio(resolve(vars, text), resolve(vars, surface))).toBeGreaterThanOrEqual(4.5);
  });

  it('primary-foreground on primary ≥ 4.5:1', () => {
    expect(
      ratio(resolve(vars, 'primary-foreground'), resolve(vars, 'primary')),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('focus ring (accent) on surfaces ≥ 3:1 (UI component)', () => {
    for (const s of SURFACES)
      expect(ratio(resolve(vars, 'accent'), resolve(vars, s))).toBeGreaterThanOrEqual(3);
  });
});
