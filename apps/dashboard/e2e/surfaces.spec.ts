// Decorative surfaces in a real browser (CSS media queries don't run in jsdom):
// the phone aurora on auth screens (review finding 5) and the Increase Contrast /
// Reduce Transparency fallbacks (review finding 4). Needs only the dashboard, no backend data.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { setLocale } from './helpers';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

async function open(
  browser: Browser,
  path: string,
  {
    viewport,
    locale = 'en',
    plain,
  }: {
    viewport: { width: number; height: number };
    locale?: 'ar' | 'en';
    plain?: 'contrast' | 'transparency';
  },
): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await setLocale(page, locale);
  if (plain === 'contrast') await page.emulateMedia({ contrast: 'more' });
  if (plain === 'transparency') {
    // Not in Playwright's emulateMedia options yet; Chromium supports it through CDP.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });
  }
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  return page;
}

/** The auth form column (the one that carries `max-lg:bg-aurora`). */
const formColumnBackground = (page: Page) =>
  page
    .locator('header')
    .first()
    .locator('..')
    .evaluate((el) => getComputedStyle(el).backgroundImage);

test.describe('auth aurora on phones (review finding 5)', () => {
  test('phone sign-in has the aurora light, mirrored in Arabic', async ({ browser }) => {
    const en = await open(browser, '/auth/sign-in', { viewport: PHONE, locale: 'en' });
    const ltr = await formColumnBackground(en);
    expect(ltr).toContain('radial-gradient');
    expect(ltr).toContain('15% 0%');
    const ar = await open(browser, '/auth/sign-in', { viewport: PHONE, locale: 'ar' });
    const rtl = await formColumnBackground(ar);
    expect(rtl).toContain('radial-gradient');
    expect(rtl).toContain('85% 0%');
  });

  test('desktop keeps the form column plain (the brand panel carries the light)', async ({
    browser,
  }) => {
    const page = await open(browser, '/auth/sign-in', { viewport: DESKTOP });
    expect(await formColumnBackground(page)).toBe('none');
  });
});

test.describe('Increase Contrast and Reduce Transparency (review finding 4)', () => {
  test('default settings show the ambient light, glows and floating shapes', async ({
    browser,
  }) => {
    const signIn = await open(browser, '/auth/sign-in', { viewport: DESKTOP });
    await expect(signIn.locator('.decor-glow').first()).toBeVisible();
    await expect(signIn.locator('.fx-gradient')).toHaveCount(1);
    await expect(signIn.getByTestId('core-halo')).toHaveCount(1);
    const notFound = await open(browser, '/nowhere', { viewport: DESKTOP });
    await expect(notFound.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(notFound.locator('.fx-shapes')).toHaveCount(1);
  });

  for (const plain of ['contrast', 'transparency'] as const) {
    test(`${plain}: no floating shapes, ambient light or glows`, async ({ browser }) => {
      const signIn = await open(browser, '/auth/sign-in', { viewport: DESKTOP, plain });
      // The brand panel is a lazy chunk: wait until it is on screen, so the checks below can't
      // pass just because it hasn't loaded yet.
      await expect(signIn.locator('.decor-glow').first()).toBeVisible();
      await expect(signIn.locator('.fx-gradient')).toHaveCount(0);
      await expect(signIn.getByTestId('core-halo')).toHaveCount(0);
      const tokens = await signIn.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        return ['--glow-primary', '--glow-accent', '--elevation-glow', '--card-sheen'].map((v) =>
          s.getPropertyValue(v).trim(),
        );
      });
      expect(tokens.at(-1)).toBe('none');
      if (plain === 'transparency') expect(tokens).toEqual(['none', 'none', 'none', 'none']);
      // Increase Contrast swaps each glow for a crisp 2 px ring (DESIGN_SYSTEM §2.2a): an edge,
      // no blur or bloom. (Production CSS may shorten the hex, e.g. #6688ff → #68f.)
      else
        for (const t of tokens.slice(0, 3))
          expect(t).toMatch(/^0 0 0 2px #(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
      // Glowing decoration that remains as content (the core sphere) loses its glow.
      const glows = await signIn
        .locator('.decor-glow')
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).boxShadow));
      expect(glows.length).toBeGreaterThan(0);
      expect(glows.every((g) => g === 'none')).toBe(true);

      const notFound = await open(browser, '/nowhere', { viewport: DESKTOP, plain });
      await expect(notFound.getByRole('heading', { name: 'Page not found' })).toBeVisible();
      await expect(notFound.locator('.fx-shapes')).toHaveCount(0);

      // The phone aurora is decoration too: it is fully transparent here.
      const phone = await open(browser, '/auth/sign-in', { viewport: PHONE, plain });
      const aurora = await phone.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--aurora-1').trim(),
      );
      expect(aurora).toBe('transparent');
    });
  }
});
