// Visual capture of every P3 screen: {ar, en} × {dark, light} × {desktop, mobile}.
// Run: E2E_SCREENSHOTS_DIR=… pnpm exec playwright test --project=screenshots
// Seeds its own users/workspace through Supabase Auth + the `api` function (local stack only).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createClient, type Session } from '@supabase/supabase-js';
import { MAILPIT_URL, PASSWORD, SUPABASE_URL } from './helpers';

const OUT = process.env.E2E_SCREENSHOTS_DIR ?? join(process.cwd(), 'test-results', 'screenshots');
const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:54321/functions/v1/api';
const PUB = process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? '';
const SECRET = process.env.E2E_SUPABASE_SECRET_KEY ?? '';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

type Locale = 'ar' | 'en';
type Theme = 'dark' | 'light';
type Viewport = 'desktop' | 'mobile';

const VIEWPORTS: Record<
  Viewport,
  {
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
    isMobile: boolean;
    hasTouch: boolean;
  }
> = {
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

interface Seed {
  slug: string;
  wsId: string;
  owner: { id: string; email: string; session: Session };
  agent: { id: string; email: string; session: Session };
  pendingToken: string;
}

const admin = () => createClient(SUPABASE_URL, SECRET, noSession);

async function api<T>(path: string, token: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: {
      authorization: `Bearer ${token}`,
      apikey: PUB,
      'content-type': 'application/json',
      'accept-language': 'en',
    },
    body: body ? JSON.stringify(body) : null,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function user(
  tag: string,
  name: string,
): Promise<{ id: string; email: string; session: Session }> {
  const email = `${tag}-${Date.now().toString(36)}@diwan.example`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name, locale: 'en' },
  });
  if (error) throw error;
  const { data: s, error: e2 } = await createClient(
    SUPABASE_URL,
    PUB,
    noSession,
  ).auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  return { id: data.user.id, email, session: s.session! };
}

async function seed(): Promise<Seed> {
  const owner = await user('sara', 'Sara Al-Harbi');
  const agent = await user('khalid', 'Khalid Mansour');
  const slug = `al-diwan-${Date.now().toString(36)}`;
  const { workspace } = await api<{ workspace: { id: string } }>(
    '/v1/workspaces',
    owner.session.access_token,
    {
      name: 'Al Diwan Café',
      slug,
      category: 'cafe',
      country_code: 'SA',
      timezone: 'Asia/Riyadh',
      default_locale: 'ar',
    },
  );
  await admin()
    .from('workspace_entitlement_overrides')
    .upsert({ workspace_id: workspace.id, key: 'max_users', value: 50, reason: 'screenshots' });
  const inv = await api<{ invite_url: string }>(
    `/v1/workspaces/${workspace.id}/invitations`,
    owner.session.access_token,
    {
      email: agent.email,
      role: 'agent',
      locale: 'ar',
    },
  );
  await api('/v1/invitations/accept', agent.session.access_token, {
    token: inv.invite_url.split('/invite/')[1],
  });
  const pending = await api<{ invite_url: string }>(
    `/v1/workspaces/${workspace.id}/invitations`,
    owner.session.access_token,
    {
      email: 'noura@diwan.example',
      role: 'viewer',
      locale: 'ar',
    },
  );
  return {
    slug,
    wsId: workspace.id,
    owner,
    agent,
    pendingToken: pending.invite_url.split('/invite/')[1]!,
  };
}

async function context(
  browser: Browser,
  locale: Locale,
  theme: Theme,
  vp: Viewport,
  session?: Session,
): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    ...VIEWPORTS[vp],
    colorScheme: theme,
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript(
    ([l, t, s]) => {
      localStorage.setItem('ai-crm.locale', l as string);
      localStorage.setItem('ai-crm.theme', t as string);
      if (s) localStorage.setItem('ai-crm.auth', s as string);
    },
    [locale, theme, session ? JSON.stringify(session) : ''],
  );
  return ctx;
}

async function shot(page: Page, name: string, tag: string) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, `${name}--${tag}.png`) });
}

/** Newest auth email to `email` created after `since` → its verify link. */
async function latestLink(email: string, since: number): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const r = (await (
      await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    ).json()) as {
      messages: { ID: string; Created: string }[];
    };
    const msg = r.messages?.find((m) => new Date(m.Created).getTime() >= since - 2000);
    if (msg) {
      const full = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`)).json()) as {
        Text: string;
        HTML: string;
      };
      const m = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/.exec(
        `${full.Text}\n${full.HTML}`,
      );
      if (m) return m[0].replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('no email');
}

test.describe.configure({ mode: 'serial' });

test('capture P3 screens', async ({ browser }) => {
  test.setTimeout(30 * 60_000);
  mkdirSync(OUT, { recursive: true });
  const s = await seed();
  const wsPath = `/w/${s.slug}`;

  for (const locale of ['ar', 'en'] as const) {
    for (const theme of ['dark', 'light'] as const) {
      // The profile wins over local storage after sign-in: align both users with this run.
      await admin().from('profiles').update({ locale, theme }).in('id', [s.owner.id, s.agent.id]);
      for (const vp of ['desktop', 'mobile'] as const) {
        const tag = `${locale}-${theme}-${vp}`;
        const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

        // Signed out --------------------------------------------------------------------
        const anon = await context(browser, locale, theme, vp);
        const p = await anon.newPage();
        await p.goto('/auth/sign-in');
        await shot(p, '01-sign-in', tag);
        await p.goto('/auth/sign-up');
        await p.getByRole('button', { name: L('إنشاء الحساب', 'Create account') }).click();
        await expect(p.getByRole('alert').first()).toBeVisible();
        await shot(p, '02-sign-up-validation', tag);
        await p.goto(`/auth/check-email?email=${encodeURIComponent('sara@diwan.example')}`);
        await shot(p, '03-check-email', tag);
        await p.goto('/auth/forgot-password');
        await shot(p, '04-forgot-password', tag);
        await p.goto('/auth/callback?error=access_denied&error_description=expired');
        await shot(p, '06-link-failed', tag);
        await p.goto(`/invite/${s.pendingToken}`);
        await expect(p.getByTestId('accept-invite')).toBeVisible();
        await shot(p, '07-accept-invite', tag);
        await p.goto('/does-not-exist');
        await shot(p, '18-not-found', tag);
        // Real PKCE recovery: requested from this browser, link opened in this browser.
        await p.goto('/auth/forgot-password');
        const since = Date.now();
        await p.getByLabel(L('بريد العمل', 'Work email')).fill(s.agent.email);
        await p.getByRole('button', { name: L('أرسل الرابط', 'Send reset link') }).click();
        await expect(p.getByRole('status').first()).toBeVisible();
        await p.goto(await latestLink(s.agent.email, since));
        await expect(
          p.getByLabel(L('كلمة المرور الجديدة', 'New password'), { exact: true }),
        ).toBeVisible();
        await shot(p, '05-reset-password', tag);
        await anon.close();

        // Owner -------------------------------------------------------------------------
        const ownerCtx = await context(browser, locale, theme, vp, s.owner.session);
        const o = await ownerCtx.newPage();
        await o.goto('/onboarding/workspace');
        await shot(o, '08-create-workspace', tag);
        await o.goto(wsPath);
        await expect(o.getByRole('heading', { level: 1 })).toBeVisible();
        await shot(o, '09-overview-coming-soon', tag);
        if (vp === 'desktop') {
          await o.keyboard.press('Control+k');
        } else {
          await o.getByRole('button', { name: L('انتقل إلى…', 'Jump to…') }).click();
        }
        await expect(o.getByRole('dialog')).toBeVisible();
        await shot(o, '10-command-palette', tag);
        await o.keyboard.press('Escape');
        if (vp === 'mobile') {
          await o.getByRole('button', { name: L('فتح القائمة', 'Open menu') }).click();
          await expect(o.getByRole('dialog')).toBeVisible();
          await shot(o, '11-navigation', tag);
          await o.keyboard.press('Escape');
        } else {
          await o.getByTestId('workspace-switcher').click();
          await expect(o.getByRole('menu')).toBeVisible();
          await shot(o, '11-navigation', tag);
          await o.keyboard.press('Escape');
        }
        await o.goto(`${wsPath}/settings`);
        await shot(o, '12-settings-owner', tag);
        await o.goto(`${wsPath}/settings/members`);
        await expect(o.getByTestId('pending-invitation').first()).toBeVisible();
        await shot(o, '13-members-owner', tag);
        await o.getByTestId('invite-button').click();
        await shot(o, '14-invite-dialog', tag);
        const dialog = o.getByRole('dialog');
        await dialog.getByLabel(L('البريد الإلكتروني', 'Email')).fill(`reem.${tag}@diwan.example`);
        await dialog.getByRole('button', { name: L('إرسال الدعوة', 'Send invitation') }).click();
        await expect(o.getByTestId('invite-result')).toBeVisible();
        await shot(o, '15-invite-link', tag);
        await o.keyboard.press('Escape');
        await o.goto(`${wsPath}/account`);
        await shot(o, '17-account', tag);
        await ownerCtx.close();
        // Keep the pending list stable for the next run.
        const { data: extra } = await admin()
          .from('workspace_invitations')
          .select('id')
          .eq('workspace_id', s.wsId)
          .like('email', 'reem.%')
          .is('revoked_at', null);
        for (const row of extra ?? []) {
          await api(
            `/v1/workspaces/${s.wsId}/invitations/${row.id}`,
            s.owner.session.access_token,
            undefined,
            'DELETE',
          );
        }

        // Agent (role-restricted) ----------------------------------------------------------
        const agentCtx = await context(browser, locale, theme, vp, s.agent.session);
        const a = await agentCtx.newPage();
        await a.goto(`${wsPath}/settings/members`);
        await expect(a.getByTestId('member-row').first()).toBeVisible();
        await shot(a, '16-members-agent', tag);
        await agentCtx.close();
      }
    }
  }
});
