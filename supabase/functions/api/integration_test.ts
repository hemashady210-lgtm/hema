// Integration test: real Supabase local stack (Auth, PostgREST, RLS, RPCs) + the served `api`.
// Skipped unless API_INTEGRATION_URL is set. Required env:
//   API_INTEGRATION_URL   e.g. http://127.0.0.1:54321/functions/v1/api (edge runtime)
//                         or   http://127.0.0.1:54399/api (host Deno, scripts/dev/serve-api.sh)
//   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY  (from `supabase status -o env`)
import { assert, assertEquals } from '@std/assert';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const API = Deno.env.get('API_INTEGRATION_URL');
const URL_ = Deno.env.get('SUPABASE_URL') ?? '';
const PUB = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const SECRET = Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
const run = !!API && !!URL_ && !!PUB && !!SECRET;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

async function call(
  path: string,
  init: { method?: string; token?: string; body?: unknown; lang?: string } = {},
) {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      'accept-language': init.lang ?? 'en',
      apikey: PUB,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function makeUser(admin: SupabaseClient, tag: string) {
  const email = `${tag}-${crypto.randomUUID().slice(0, 8)}@it.local`;
  const password = 'Passw0rd-it';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `IT ${tag}`, locale: 'en' },
  });
  if (error) throw error;
  const client = createClient(URL_, PUB, noSession);
  const { data: s, error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, email, token: s.session!.access_token, client };
}

Deno.test({
  name: 'P3 flow: create workspace → invite → accept → roles → RLS reads',
  ignore: !run,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const admin = createClient(URL_, SECRET, noSession);
    const a = await makeUser(admin, 'owner');
    const b = await makeUser(admin, 'agent');
    const slug = `it-${crypto.randomUUID().slice(0, 8)}`;

    // Profile created by the auth trigger, readable by its owner (RLS).
    const { data: prof } = await a.client
      .from('profiles')
      .select('full_name, locale, email')
      .eq('id', a.id)
      .single();
    assertEquals(prof, { full_name: 'IT owner', locale: 'en', email: a.email });

    // Create workspace (trial) and hit the one-trial-per-user rule.
    const created = await call('/v1/workspaces', {
      token: a.token,
      body: {
        name: 'IT Cafe',
        slug,
        category: 'cafe',
        country_code: 'SA',
        timezone: 'Asia/Riyadh',
        default_locale: 'en',
      },
    });
    assertEquals(created.status, 201, JSON.stringify(created.body));
    const ws = created.body.workspace.id as string;
    const again = await call('/v1/workspaces', {
      token: a.token,
      body: {
        name: 'Second',
        slug: `${slug}-2`,
        category: 'cafe',
        country_code: null,
        timezone: 'Asia/Riyadh',
        default_locale: 'ar',
      },
      lang: 'ar',
    });
    assertEquals(again.status, 402);
    assertEquals(again.body.error.code, 'trial_limit_reached');
    assert((again.body.error.message as string).includes('تجربتك'));
    const avail = await call(`/v1/workspaces/slug-availability?slug=${slug}`, { token: a.token });
    assertEquals(avail.body.available, false);

    // Trial = 1 user: inviting is refused with the plan limit.
    const blocked = await call(`/v1/workspaces/${ws}/invitations`, {
      token: a.token,
      body: { email: b.email, role: 'agent', locale: 'en' },
    });
    assertEquals(blocked.status, 402);
    assertEquals(blocked.body.error.details, { entitlement: 'max_users', limit: 1 });

    // Test-only override (owner decision #5), then invite.
    const { error: oe } = await admin
      .from('workspace_entitlement_overrides')
      .insert({ workspace_id: ws, key: 'max_users', value: 3, reason: 'integration test' });
    assertEquals(oe, null);
    const inv = await call(`/v1/workspaces/${ws}/invitations`, {
      token: a.token,
      body: { email: b.email.toUpperCase(), role: 'agent', locale: 'en' },
    });
    assertEquals(inv.status, 201, JSON.stringify(inv.body));
    assertEquals(inv.body.email_status, 'not_configured');
    const token = (inv.body.invite_url as string).split('/invite/')[1]!;

    // Members read through RLS; token_hash never readable.
    const { data: invRows } = await a.client
      .from('workspace_invitations')
      .select('email, email_status')
      .eq('workspace_id', ws);
    assertEquals(invRows, [{ email: b.email, email_status: 'not_configured' }]);
    const { error: hashErr } = await a.client.from('workspace_invitations').select('token_hash');
    assert(hashErr, 'token_hash must not be selectable');

    // Preview: masked for anonymous, full for the invitee. Accept.
    const anon = await call('/v1/invitations/preview', { body: { token } });
    assertEquals(anon.status, 200);
    assert((anon.body.email as string).includes('***'));
    assertEquals(anon.body.state, 'valid');
    const mine = await call('/v1/invitations/preview', { token: b.token, body: { token } });
    assertEquals(mine.body.email_matches_caller, true);
    const wrong = await call('/v1/invitations/accept', { token: a.token, body: { token } });
    assertEquals(wrong.status, 403);
    assertEquals(wrong.body.error.code, 'invitation_email_mismatch');
    const accepted = await call('/v1/invitations/accept', { token: b.token, body: { token } });
    assertEquals(accepted.status, 200, JSON.stringify(accepted.body));
    assertEquals(accepted.body, { workspace_id: ws, workspace_slug: slug, role: 'agent' });

    // B now sees the workspace and both members through RLS.
    const { data: members } = await b.client
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', ws)
      .order('role');
    assertEquals(members?.length, 2);
    const { data: teammate } = await b.client
      .from('profiles')
      .select('email')
      .eq('id', a.id)
      .single();
    assertEquals(teammate?.email, a.email);

    // Role rules: agent cannot invite; owner demotes agent to viewer; viewer cannot remove owner.
    const agentInvite = await call(`/v1/workspaces/${ws}/invitations`, {
      token: b.token,
      body: { email: 'x@it.local', role: 'viewer' },
    });
    assertEquals(agentInvite.status, 403);
    const demote = await call(`/v1/workspaces/${ws}/members/${b.id}`, {
      method: 'PATCH',
      token: a.token,
      body: { role: 'viewer' },
    });
    assertEquals(demote.status, 200);
    const removeOwner = await call(`/v1/workspaces/${ws}/members/${a.id}`, {
      method: 'DELETE',
      token: b.token,
    });
    assertEquals(removeOwner.status, 403);
    // Viewer cannot update workspace settings directly (RLS + column grants).
    const { data: upd } = await b.client
      .from('workspaces')
      .update({ name: 'Hacked' })
      .eq('id', ws)
      .select('id');
    assertEquals(upd, []);
    // Viewer leaves.
    const leave = await call(`/v1/workspaces/${ws}/members/${b.id}`, {
      method: 'DELETE',
      token: b.token,
    });
    assertEquals(leave.status, 204);

    // Cleanup users (workspace rows stay on the throwaway local stack).
    await admin.auth.admin.deleteUser(b.id);
  },
});
