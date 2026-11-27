import { assert, assertEquals, assertThrows } from '@std/assert';
import { loadEnv } from './env.ts';
import { mapDbError } from './errors.ts';
import { functionPath, match, route } from './router.ts';
import { randomToken, sha256Hex } from './crypto.ts';
import { createResendMailer } from './email/resend.ts';
import { invitationEmail } from './email/invitation.ts';
import { bearerToken } from './auth.ts';
import { clientIp } from './http.ts';

Deno.test('env: new-style key dictionaries win over legacy keys (F5)', () => {
  const env = loadEnv(
    (n) =>
      ({
        SUPABASE_URL: 'https://abc.supabase.co',
        SUPABASE_SECRET_KEYS: '{"default":"sb_secret_new"}',
        SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_new"}',
        SUPABASE_SERVICE_ROLE_KEY: 'legacy-service',
        SUPABASE_ANON_KEY: 'legacy-anon',
        APP_URL: 'https://app.example.com/some/path',
        ALLOWED_ORIGINS: 'https://preview.example.com, not a url',
      })[n],
  );
  assertEquals(env.secretKey, 'sb_secret_new');
  assertEquals(env.publishableKey, 'sb_publishable_new');
  assertEquals(env.appUrl, 'https://app.example.com');
  assertEquals(env.allowedOrigins, ['https://app.example.com', 'https://preview.example.com']);
  assertEquals(env.isLocal, false);
  assertEquals(env.resend, null);
});

Deno.test('env: local stack falls back to legacy keys and the Vite origin', () => {
  const env = loadEnv(
    (n) =>
      ({
        SUPABASE_URL: 'http://kong:8000',
        SUPABASE_SERVICE_ROLE_KEY: 'legacy-service',
        SUPABASE_ANON_KEY: 'legacy-anon',
        APP_URL: '',
        RESEND_API_KEY: 're_x',
        RESEND_FROM_EMAIL: 'env(RESEND_FROM_EMAIL)',
      })[n],
  );
  assertEquals(env.secretKey, 'legacy-service');
  assertEquals(env.appUrl, 'http://127.0.0.1:5173');
  assert(env.allowedOrigins.includes('http://localhost:5173'));
  assertEquals(env.resend, null, 'an API key without a sender address is not configured');
});

Deno.test(
  'env: hosted project without APP_URL boots with no link origin and no CORS origins',
  () => {
    const env = loadEnv(
      (n) =>
        ({
          SUPABASE_URL: 'https://abc.supabase.co',
          SUPABASE_SECRET_KEY: 's',
          SUPABASE_PUBLISHABLE_KEY: 'p',
        })[n],
    );
    assertEquals(env.appUrl, null);
    assertEquals(env.allowedOrigins, []);
  },
);

Deno.test('env: missing keys refuse to start', () => {
  assertThrows(() => loadEnv((n) => ({ SUPABASE_URL: 'https://abc.supabase.co' })[n]));
});

Deno.test('mapDbError: app codes, plan limits, Postgres codes', () => {
  assertEquals(mapDbError({ message: 'app:not_found' }).code, 'not_found');
  assertEquals(mapDbError({ message: 'app:invalid_role' }).code, 'validation_failed');
  assertEquals(mapDbError({ message: 'plan_feature:orders' }).details, { entitlement: 'orders' });
  assertEquals(mapDbError({ code: '23505', message: 'dup' }).code, 'conflict');
  assertEquals(mapDbError({ code: '42501', message: 'rls' }).code, 'forbidden');
  assertEquals(mapDbError({ code: 'XX000', message: '?' }).code, 'internal');
});

Deno.test('router: params, method mismatch, function prefix', () => {
  const routes = [route<null>('GET', '/v1/w/:id', () => Promise.resolve(new Response()))];
  const m = match(routes, 'GET', '/v1/w/abc');
  assertEquals(m.kind === 'found' && m.params, { id: 'abc' });
  assertEquals(match(routes, 'POST', '/v1/w/abc').kind, 'method_not_allowed');
  assertEquals(match(routes, 'GET', '/v1/other').kind, 'not_found');
  assertEquals(functionPath('/functions/v1/api/v1/x', 'api'), '/v1/x');
  assertEquals(functionPath('/api/health', 'api'), '/health');
  assertEquals(functionPath('/api', 'api'), '/');
});

Deno.test('crypto: tokens are 43-char base64url and unique; sha256 hex', async () => {
  const a = randomToken();
  assert(/^[A-Za-z0-9_-]{43}$/.test(a));
  assert(a !== randomToken());
  assertEquals(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

Deno.test('auth: bearer parsing ignores API keys', () => {
  const r = (v: string) => new Request('http://x', { headers: { authorization: v } });
  assertEquals(bearerToken(r('Bearer eyJabc')), 'eyJabc');
  assertEquals(bearerToken(r('Bearer sb_publishable_x')), null);
  assertEquals(bearerToken(r('Basic xyz')), null);
});

Deno.test('resend: not configured, success, HTTP failure, network failure', async () => {
  assertEquals(
    (await createResendMailer(null).send({ to: 'a@b.co', subject: 's', html: 'h', text: 't' }))
      .status,
    'not_configured',
  );
  let seen: RequestInit | undefined;
  const ok = createResendMailer(
    { apiKey: 're_k', from: 'App <no-reply@example.com>' },
    (_u, init) => {
      seen = init;
      return Promise.resolve(new Response('{"id":"em_1"}', { status: 200 }));
    },
  );
  assertEquals(
    await ok.send({ to: 'a@b.co', subject: 's', html: 'h', text: 't', idempotencyKey: 'k1' }),
    { status: 'sent', id: 'em_1' },
  );
  const headers = seen?.headers as Record<string, string>;
  assertEquals(headers.authorization, 'Bearer re_k');
  assertEquals(headers['idempotency-key'], 'k1');
  assertEquals(JSON.parse(seen?.body as string).to, ['a@b.co']);
  const bad = createResendMailer({ apiKey: 'k', from: 'f' }, () =>
    Promise.resolve(new Response('{"message":"invalid"}', { status: 422 })),
  );
  const r = await bad.send({ to: 'a@b.co', subject: 's', html: 'h', text: 't' });
  assertEquals(r.status, 'failed');
  const down = createResendMailer({ apiKey: 'k', from: 'f' }, () =>
    Promise.reject(new Error('offline')),
  );
  assertEquals(
    (await down.send({ to: 'a@b.co', subject: 's', html: 'h', text: 't' })).status,
    'failed',
  );
});

Deno.test('invitation email: ar is RTL, names escaped and isolated, URL kept LTR', () => {
  const ar = invitationEmail({
    locale: 'ar',
    workspaceName: 'مطعم <الديوان>',
    inviterName: 'Sara "S"',
    role: 'agent',
    url: 'https://app.example.com/invite/tok',
    expiresAt: new Date('2026-12-03T00:00:00Z'),
  });
  assert(ar.html.includes('dir="rtl"'));
  assert(ar.html.includes('<bdi>مطعم &lt;الديوان&gt;</bdi>'));
  assert(ar.html.includes('<bdi>Sara &quot;S&quot;</bdi>'));
  assert(!ar.html.includes('<الديوان>'));
  assert(ar.text.includes('https://app.example.com/invite/tok'));
  assert(ar.subject.includes('دعوة'));
  assert(!ar.subject.includes('الديوان'), 'workspace name stays out of the subject');
  const en = invitationEmail({
    locale: 'en',
    workspaceName: 'Diwan',
    inviterName: null,
    role: 'viewer',
    url: 'https://x/i/t',
    expiresAt: new Date(),
  });
  assert(en.html.includes('dir="ltr"'));
  assert(en.text.includes("You've been invited"));
});

Deno.test(
  'clientIp: proxy-appended address, not the client-supplied first X-Forwarded-For entry',
  () => {
    const r = (h: Record<string, string>) => new Request('http://x', { headers: h });
    assertEquals(clientIp(r({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' })), '203.0.113.7');
    assertEquals(
      clientIp(r({ 'cf-connecting-ip': '198.51.100.1', 'x-forwarded-for': '6.6.6.6' })),
      '198.51.100.1',
    );
    assertEquals(clientIp(r({})), 'unknown');
    assertEquals(clientIp(r({ 'x-forwarded-for': 'evil-bucket-key' })), 'unknown');
  },
);

Deno.test(
  'invitation email: link-like or bidi-spoofed names are dropped; subject has no user text',
  async () => {
    const { safeDisplayName } = await import('./email/invitation.ts');
    assertEquals(safeDisplayName('  Al Diwan  Café '), 'Al Diwan Café');
    assertEquals(safeDisplayName('Account locked – verify at evil.example'), null);
    assertEquals(safeDisplayName('https://x.io'), null);
    assertEquals(safeDisplayName('Sara\u202eevil'), 'Saraevil');
    const mail = invitationEmail({
      locale: 'en',
      workspaceName: 'Verify now at evil.example',
      inviterName: 'Support <www.evil.example>',
      role: 'admin',
      url: 'https://app.example.com/invite/t',
      expiresAt: new Date(),
    });
    assert(!mail.subject.includes('evil'), 'subject carries no user text');
    assert(
      !mail.html.includes('evil') && !mail.text.includes('evil'),
      'unsafe names never reach the email',
    );
    assert(mail.text.includes('join a workspace'));
  },
);
