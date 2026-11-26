// Unit tests for the `api` function with in-memory fakes (no network, no Supabase).
// Run: deno test --config supabase/functions/api/deno.json --allow-env supabase/functions
import { assert, assertEquals, assertMatch } from '@std/assert';
import { createApp, type Deps } from './app.ts';
import type { AuthUser, Db, RpcResult } from '../_shared/db.ts';
import type { Mailer, OutgoingEmail, SendResult } from '../_shared/email/resend.ts';
import type { Env } from '../_shared/env.ts';
import { createLogger } from '../_shared/log.ts';
import { sha256Hex } from '../_shared/crypto.ts';

const WS = '10000000-0000-4000-8000-00000000000a';
const OTHER_WS = '10000000-0000-4000-8000-00000000000b';
const INV = '20000000-0000-4000-8000-000000000001';
const USER: AuthUser = {
  id: '30000000-0000-4000-8000-000000000001',
  email: 'owner@test.local',
  emailConfirmed: true,
};
const ORIGIN = 'http://127.0.0.1:5173';

const env: Env = {
  supabaseUrl: 'http://127.0.0.1:54321',
  secretKey: 'sb_secret_test',
  publishableKey: 'sb_publishable_test',
  appUrl: ORIGIN,
  allowedOrigins: [ORIGIN],
  resend: null,
  isLocal: true,
};

interface Call {
  fn: string;
  args: Record<string, unknown>;
}

function fakeDb(
  handlers: Record<string, (args: Record<string, unknown>) => RpcResult<unknown>> = {},
) {
  const calls: Call[] = [];
  const db: Db = {
    rpc<T>(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      if (fn === 'hit_rate_limit' && !handlers[fn]) {
        return Promise.resolve({
          data: [{ allowed: true, remaining: 9, retry_after_seconds: 0 }] as T,
          error: null,
        });
      }
      const h = handlers[fn];
      return Promise.resolve((h ? h(args) : { data: null, error: null }) as RpcResult<T>);
    },
    invitationWorkspaceId: (id) => Promise.resolve(id === INV ? WS : null),
    workspaceName: () => Promise.resolve('Diwan <Cafe>'),
    profileName: () => Promise.resolve('Sara'),
  };
  return { db, calls };
}

function fakeMailer(result: SendResult | null): Mailer & { sent: OutgoingEmail[] } {
  const sent: OutgoingEmail[] = [];
  return {
    configured: result !== null && result.status !== 'not_configured',
    sent,
    send(email) {
      sent.push(email);
      return Promise.resolve(result ?? { status: 'not_configured' });
    },
  };
}

function app(over: Partial<Deps> = {}, user: AuthUser | null = USER) {
  const { db, calls } = fakeDb();
  const deps: Deps = {
    env,
    db,
    auth: { getUser: (jwt) => Promise.resolve(jwt === 'good' ? user : null) },
    mailer: fakeMailer(null),
    logger: createLogger({}, () => {}),
    ...over,
  };
  return { handle: createApp(deps), calls, deps };
}

function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://127.0.0.1:54321/functions/v1/api${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      authorization: 'Bearer good',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : null,
  });
}

const inviteRow = {
  id: INV,
  workspace_id: WS,
  email: 'new@test.local',
  role: 'agent',
  expires_at: '2026-12-03T00:00:00Z',
  locale: 'ar',
  email_status: 'pending',
};

Deno.test('health proves packages/shared is bundled (R-14) and needs no auth', async () => {
  const { handle } = app();
  const res = await handle(new Request('http://x/api/health'));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).product, 'AI CRM');
  assertMatch(res.headers.get('x-request-id') ?? '', /^req_/);
});

Deno.test('CORS: preflight echoes only allowed origins', async () => {
  const { handle } = app();
  const ok = await handle(req('OPTIONS', '/v1/workspaces'));
  assertEquals(ok.status, 204);
  assertEquals(ok.headers.get('access-control-allow-origin'), ORIGIN);
  const bad = await handle(
    req('OPTIONS', '/v1/workspaces', undefined, { origin: 'https://evil.example' }),
  );
  assertEquals(bad.headers.get('access-control-allow-origin'), null);
});

Deno.test('unauthenticated → 401 envelope in the requested language', async () => {
  const { handle } = app();
  const res = await handle(
    req('POST', '/v1/workspaces', {}, { authorization: 'Bearer bad', 'accept-language': 'ar' }),
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error.code, 'unauthenticated');
  assertEquals(body.error.message, 'يرجى تسجيل الدخول مرة أخرى.');
  assertMatch(body.error.request_id, /^req_/);
});

Deno.test('new-style API keys are not accepted as user tokens', async () => {
  const { handle } = app();
  const res = await handle(
    req('GET', '/v1/config', undefined, { authorization: 'Bearer sb_secret_x' }),
  );
  assertEquals(res.status, 401);
});

Deno.test('create workspace: validation issues carry i18n keys', async () => {
  const { handle, calls } = app();
  const res = await handle(
    req('POST', '/v1/workspaces', {
      name: '',
      slug: '-',
      category: 'x',
      country_code: null,
      timezone: 'Asia/Riyadh',
      default_locale: 'ar',
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error.code, 'validation_failed');
  const paths = body.error.details.issues.map((i: { path: string }) => i.path).sort();
  assertEquals(paths, ['category', 'name', 'slug']);
  assert(!calls.some((c) => c.fn === 'create_workspace'));
});

Deno.test('create workspace: unverified email is refused before the database', async () => {
  const { handle, calls } = app({}, { ...USER, emailConfirmed: false });
  const res = await handle(req('POST', '/v1/workspaces', {}));
  assertEquals(res.status, 403);
  assertEquals((await res.json()).error.code, 'email_not_verified');
  assertEquals(calls.length, 0);
});

const validWorkspace = {
  name: 'Diwan',
  slug: 'Diwan',
  category: 'cafe',
  country_code: 'SA',
  timezone: 'Asia/Riyadh',
  default_locale: 'en',
};

Deno.test(
  'create workspace: passes the verified user id and normalized input to the RPC',
  async () => {
    const { db, calls } = fakeDb({
      create_workspace: (a) => ({
        data: { id: WS, name: a.p_name, slug: a.p_slug, status: 'active' },
        error: null,
      }),
    });
    const { handle } = app({ db });
    const res = await handle(req('POST', '/v1/workspaces', validWorkspace));
    assertEquals(res.status, 201);
    assertEquals((await res.json()).workspace.slug, 'diwan');
    const call = calls.find((c) => c.fn === 'create_workspace')!;
    assertEquals(call.args.p_user_id, USER.id);
    assertEquals(call.args.p_slug, 'diwan');
  },
);

Deno.test(
  'DB errors map to the envelope (slug taken 409, trial limit 402, plan limit 402)',
  async () => {
    for (const [message, status, code] of [
      ['app:slug_taken', 409, 'slug_taken'],
      ['app:trial_limit_reached', 402, 'trial_limit_reached'],
      ['plan_limit:max_users:3', 402, 'plan_limit_reached'],
      ['app:invalid_timezone', 400, 'validation_failed'],
      ['app:something_new', 500, 'internal'],
    ] as const) {
      const { db } = fakeDb({
        create_workspace: () => ({ data: null, error: { code: 'P0001', message } }),
      });
      const res = await app({ db }).handle(req('POST', '/v1/workspaces', validWorkspace));
      assertEquals(res.status, status, message);
      const body = await res.json();
      assertEquals(body.error.code, code, message);
      if (code === 'plan_limit_reached')
        assertEquals(body.error.details, { entitlement: 'max_users', limit: 3 });
    }
  },
);

Deno.test(
  'invite without Resend: link returned, status not_configured recorded, token only hashed',
  async () => {
    const { db, calls } = fakeDb({ create_invitation: () => ({ data: inviteRow, error: null }) });
    const { handle } = app({ db });
    const res = await handle(
      req('POST', `/v1/workspaces/${WS}/invitations`, { email: 'New@Test.local', role: 'agent' }),
    );
    assertEquals(res.status, 201);
    const body = await res.json();
    assertEquals(body.email_status, 'not_configured');
    const token = body.invite_url.split('/invite/')[1];
    assertMatch(token, /^[A-Za-z0-9_-]{43}$/);
    const create = calls.find((c) => c.fn === 'create_invitation')!;
    assertEquals(create.args.p_token_hash, await sha256Hex(token));
    assertEquals(create.args.p_actor_id, USER.id);
    assert(!JSON.stringify(create.args).includes(token), 'raw token never reaches the database');
    const status = calls.find((c) => c.fn === 'set_invitation_email_status')!;
    assertEquals(status.args, { p_invitation_id: INV, p_status: 'not_configured', p_error: null });
  },
);

Deno.test('invite with Resend: email sent in the invite locale, status sent', async () => {
  const { db, calls } = fakeDb({ create_invitation: () => ({ data: inviteRow, error: null }) });
  const mailer = fakeMailer({ status: 'sent', id: 'em_1' });
  const res = await app({ db, mailer }).handle(
    req('POST', `/v1/workspaces/${WS}/invitations`, {
      email: 'new@test.local',
      role: 'agent',
      locale: 'ar',
    }),
  );
  assertEquals(res.status, 201);
  assertEquals((await res.json()).email_status, 'sent');
  assertEquals(mailer.sent.length, 1);
  assertEquals(mailer.sent[0]!.to, 'new@test.local');
  assertMatch(mailer.sent[0]!.subject, /دعوة/);
  assert(mailer.sent[0]!.html.includes('Diwan &lt;Cafe&gt;'), 'workspace name escaped');
  assertEquals(calls.find((c) => c.fn === 'set_invitation_email_status')!.args.p_status, 'sent');
});

Deno.test('invite: a Resend failure keeps the invitation and records failed', async () => {
  const { db, calls } = fakeDb({ create_invitation: () => ({ data: inviteRow, error: null }) });
  const mailer = fakeMailer({ status: 'failed', error: 'resend 422: domain not verified' });
  const res = await app({ db, mailer }).handle(
    req('POST', `/v1/workspaces/${WS}/invitations`, { email: 'new@test.local', role: 'viewer' }),
  );
  assertEquals(res.status, 201);
  assertEquals((await res.json()).email_status, 'failed');
  assertEquals(
    calls.find((c) => c.fn === 'set_invitation_email_status')!.args.p_error,
    'resend 422: domain not verified',
  );
});

Deno.test('invite: no APP_URL on a hosted project → 500, never a wrong link', async () => {
  const { db } = fakeDb({ create_invitation: () => ({ data: inviteRow, error: null }) });
  const res = await app({ db, env: { ...env, appUrl: null } }).handle(
    req('POST', `/v1/workspaces/${WS}/invitations`, { email: 'a@b.co', role: 'agent' }),
  );
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error.details, { reason: 'app_url_not_configured' });
});

Deno.test('invite: owner role rejected by the schema', async () => {
  const res = await app().handle(
    req('POST', `/v1/workspaces/${WS}/invitations`, { email: 'a@b.co', role: 'owner' }),
  );
  assertEquals(res.status, 400);
});

Deno.test('renew/revoke: invitation must belong to the workspace in the path', async () => {
  const { handle } = app();
  const res = await handle(req('DELETE', `/v1/workspaces/${OTHER_WS}/invitations/${INV}`));
  assertEquals(res.status, 404);
  const bad = await handle(req('DELETE', `/v1/workspaces/not-a-uuid/invitations/${INV}`));
  assertEquals(bad.status, 404);
});

Deno.test('preview: masked email for anonymous visitors, full email for the invitee', async () => {
  const row = {
    invitation_id: INV,
    workspace_name: 'Diwan',
    role: 'agent',
    email: 'owner@test.local',
    inviter_name: 'Sara',
    expires_at: '2026-12-03T00:00:00Z',
    state: 'valid',
  };
  const { db } = fakeDb({ get_invitation_preview: () => ({ data: [row], error: null }) });
  const { handle } = app({ db });
  const token = 'a'.repeat(43);
  const anon = await handle(
    req('POST', '/v1/invitations/preview', { token }, { authorization: '' }),
  );
  assertEquals(anon.status, 200);
  const a = await anon.json();
  assertEquals(a.email, 'o***@test.local');
  assertEquals(a.email_matches_caller, null);
  const signedIn = await (await handle(req('POST', '/v1/invitations/preview', { token }))).json();
  assertEquals(signedIn.email, 'owner@test.local');
  assertEquals(signedIn.email_matches_caller, true);
});

Deno.test('preview: unknown token → invitation_not_found', async () => {
  const { db } = fakeDb({ get_invitation_preview: () => ({ data: [], error: null }) });
  const res = await app({ db }).handle(
    req('POST', '/v1/invitations/preview', { token: 'b'.repeat(43) }),
  );
  assertEquals(res.status, 404);
  assertEquals((await res.json()).error.code, 'invitation_not_found');
});

Deno.test('accept: returns where to go next', async () => {
  const { db } = fakeDb({
    accept_invitation: () => ({
      data: [{ workspace_id: WS, workspace_slug: 'diwan', member_role: 'agent' }],
      error: null,
    }),
  });
  const res = await app({ db }).handle(
    req('POST', '/v1/invitations/accept', { token: 'c'.repeat(43) }),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { workspace_id: WS, workspace_slug: 'diwan', role: 'agent' });
});

Deno.test('rate limit → 429 with Retry-After', async () => {
  const { db } = fakeDb({
    hit_rate_limit: () => ({
      data: [{ allowed: false, remaining: 0, retry_after_seconds: 42 }],
      error: null,
    }),
  });
  const res = await app({ db }).handle(
    req('POST', '/v1/invitations/accept', { token: 'c'.repeat(43) }),
  );
  assertEquals(res.status, 429);
  assertEquals(res.headers.get('retry-after'), '42');
});

Deno.test('rate limiter outage fails open', async () => {
  const { db } = fakeDb({
    hit_rate_limit: () => ({ data: null, error: { message: 'boom' } }),
    accept_invitation: () => ({
      data: [{ workspace_id: WS, workspace_slug: 'diwan', member_role: 'viewer' }],
      error: null,
    }),
  });
  const res = await app({ db }).handle(
    req('POST', '/v1/invitations/accept', { token: 'c'.repeat(43) }),
  );
  assertEquals(res.status, 200);
});

Deno.test('members: role change validated, owner role never assignable', async () => {
  const { db, calls } = fakeDb();
  const { handle } = app({ db });
  const target = '30000000-0000-4000-8000-000000000002';
  assertEquals(
    (await handle(req('PATCH', `/v1/workspaces/${WS}/members/${target}`, { role: 'owner' })))
      .status,
    400,
  );
  const ok = await handle(
    req('PATCH', `/v1/workspaces/${WS}/members/${target}`, { role: 'viewer' }),
  );
  assertEquals(ok.status, 200);
  assertEquals(calls.find((c) => c.fn === 'change_member_role')!.args, {
    p_actor_id: USER.id,
    p_workspace_id: WS,
    p_user_id: target,
    p_role: 'viewer',
  });
});

Deno.test('members: removal and transfer call the RPCs; DB rules surface as 409', async () => {
  const target = '30000000-0000-4000-8000-000000000002';
  const { db } = fakeDb({
    remove_member: () => ({
      data: null,
      error: { code: 'P0001', message: 'app:cannot_remove_owner' },
    }),
  });
  const res = await app({ db }).handle(req('DELETE', `/v1/workspaces/${WS}/members/${target}`));
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error.code, 'cannot_remove_owner');
  const t = await app().handle(req('POST', `/v1/workspaces/${WS}/ownership`, { user_id: target }));
  assertEquals(t.status, 200);
});

Deno.test('unknown routes and bodies', async () => {
  const { handle } = app();
  assertEquals((await handle(req('GET', '/v1/nope'))).status, 404);
  const notJson = await handle(
    new Request(`http://x/api/v1/invitations/accept`, {
      method: 'POST',
      headers: { authorization: 'Bearer good', 'content-type': 'text/plain' },
      body: 'x',
    }),
  );
  assertEquals(notJson.status, 400);
});

Deno.test('config reports email delivery from the real mailer state', async () => {
  const off = await (await app().handle(req('GET', '/v1/config'))).json();
  assertEquals(off.email_delivery, 'not_configured');
  const on = await (
    await app({ mailer: fakeMailer({ status: 'sent', id: 'x' }) }).handle(req('GET', '/v1/config'))
  ).json();
  assertEquals(on.email_delivery, 'configured');
});
