import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324';
const SECRET = process.env.E2E_SUPABASE_SECRET_KEY ?? '';

export const PASSWORD = 'Passw0rd-e2e';

export function uniqueEmail(tag: string): string {
  return `${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.local`;
}

interface MailpitSummary {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

/** Waits for an auth email in the local mail catcher and returns the first link in it. */
export async function emailLink(to: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    if (res.ok) {
      const data = (await res.json()) as { messages: MailpitSummary[] };
      const msg = data.messages?.[0];
      if (msg) {
        const full = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`)).json()) as {
          Text: string;
          HTML: string;
        };
        const body = `${full.Text}\n${full.HTML}`;
        const m = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/.exec(body);
        if (m) return m[0].replace(/&amp;/g, '&');
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email for ${to}`);
}

/**
 * Test-only: the trial allows 1 member, so the journey raises max_users for its own workspace
 * through the existing override table (owner decision #5, P3 plan). Service role, never in app code.
 */
export async function grantSeats(slug: string, seats: number): Promise<void> {
  if (!SECRET) throw new Error('E2E_SUPABASE_SECRET_KEY is required');
  const admin = createClient(SUPABASE_URL, SECRET, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: ws, error } = await admin.from('workspaces').select('id').eq('slug', slug).single();
  if (error) throw error;
  const { error: e2 } = await admin
    .from('workspace_entitlement_overrides')
    .upsert({ workspace_id: ws.id, key: 'max_users', value: seats, reason: 'e2e journey' });
  if (e2) throw e2;
}

/** axe: zero critical violations (ROADMAP P3 acceptance). Serious ones are reported, not fatal. */
export async function expectNoCriticalA11y(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical');
  const serious = results.violations.filter((v) => v.impact === 'serious');
  if (serious.length) {
    console.log(
      `[axe:${label}] serious:`,
      serious.map((v) => `${v.id} (${v.nodes.length})`).join(', '),
    );
  }
  expect(critical, `${label}: ${critical.map((v) => `${v.id}: ${v.help}`).join('; ')}`).toEqual([]);
}

export async function setLocale(page: Page, locale: 'ar' | 'en'): Promise<void> {
  await page.addInitScript((l) => {
    if (!localStorage.getItem('ai-crm.locale')) localStorage.setItem('ai-crm.locale', l);
  }, locale);
}
