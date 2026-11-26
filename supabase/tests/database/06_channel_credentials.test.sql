-- pgTAP: channel credential isolation (§6/§7, P5). Tokens live in Supabase Vault; the
-- channel_credentials row (Vault secret id) is readable by the service role only, and no
-- token outlives its credential row. Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000006a1', 'a6@test.local');
insert into public.workspaces (id, name, slug) values ('10000000-0000-0000-0000-0000000006aa', 'A6', 'ws-cred-a');
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select '10000000-0000-0000-0000-0000000006aa', id, 'active', 'manual', 'month', now() from public.plans where code = 'growth';
insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000006aa', '00000000-0000-0000-0000-0000000006a1', 'owner');
insert into public.bots (id, workspace_id, name) values
  ('20000000-0000-0000-0000-0000000006aa', '10000000-0000-0000-0000-0000000006aa', 'Bot');
insert into public.channels (id, workspace_id, bot_id, channel_type, status, connection_mode) values
  ('22000000-0000-0000-0000-0000000006a1', '10000000-0000-0000-0000-0000000006aa', '20000000-0000-0000-0000-0000000006aa', 'whatsapp', 'pending', 'manual'),
  ('22000000-0000-0000-0000-0000000006a2', '10000000-0000-0000-0000-0000000006aa', '20000000-0000-0000-0000-0000000006aa', 'messenger', 'pending', 'manual'),
  ('22000000-0000-0000-0000-0000000006a3', '10000000-0000-0000-0000-0000000006aa', '20000000-0000-0000-0000-0000000006aa', 'widget', 'connected', 'automatic');

create temp table s (k text primary key, id uuid) on commit drop;
insert into s values
  ('wa', vault.create_secret('wa-token-test')),
  ('fb', vault.create_secret('fb-token-test')),
  ('fb2', vault.create_secret('fb-token-rotated'));

select lives_ok(
  $$ insert into public.channel_credentials (workspace_id, channel_id, vault_secret_id, scopes)
     select '10000000-0000-0000-0000-0000000006aa', '22000000-0000-0000-0000-0000000006a1', id, '{whatsapp_business_messaging}'
     from s where k = 'wa' $$,
  'service side can store a credential reference for a Meta channel');
select throws_ok(
  $$ insert into public.channel_credentials (workspace_id, channel_id, vault_secret_id)
     values ('10000000-0000-0000-0000-0000000006aa', '22000000-0000-0000-0000-0000000006a3', gen_random_uuid()) $$,
  '23514', null, 'widget channels never get credentials');
select is_empty(
  $$ select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'channels'
       and column_name ~ '(token|secret|password|credential)' $$,
  'the member-readable channels table has no credential columns');

-- Client roles: no access at all.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
select throws_ok($$ select count(*) from public.channel_credentials $$, '42501', null,
  'workspace owner cannot read channel_credentials');
select throws_ok($$ select count(*) from vault.decrypted_secrets $$, '42501', null,
  'workspace owner cannot read Vault');
select is((select count(*)::int from public.channels), 3, 'owner still sees the channel rows (status only)');
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.channel_credentials $$, '42501', null, 'anon cannot read channel_credentials');
reset role;

-- Service role (edge functions) can read the reference.
set local role service_role;
select is((select count(*)::int from public.channel_credentials), 1, 'service role reads channel_credentials');
reset role;

-- Vault round trip (Supabase Vault on the real stack; plaintext stub on the local harness).
select is(
  (select d.decrypted_secret from vault.decrypted_secrets d join s on s.id = d.id where s.k = 'wa'),
  'wa-token-test', 'the token is stored in and read back from Vault');

-- No orphaned tokens: rotation, row deletion and channel deletion remove the old secret.
insert into public.channel_credentials (workspace_id, channel_id, vault_secret_id)
  select '10000000-0000-0000-0000-0000000006aa', '22000000-0000-0000-0000-0000000006a2', id from s where k = 'fb';
update public.channel_credentials set vault_secret_id = (select id from s where k = 'fb2')
  where channel_id = '22000000-0000-0000-0000-0000000006a2';
select is((select count(*)::int from vault.secrets v join s on s.id = v.id where s.k = 'fb'), 0,
  'replacing the secret reference deletes the old Vault secret');
select is((select count(*)::int from vault.secrets v join s on s.id = v.id where s.k = 'fb2'), 1,
  'the new Vault secret is kept');
delete from public.channel_credentials where channel_id = '22000000-0000-0000-0000-0000000006a2';
select is((select count(*)::int from vault.secrets v join s on s.id = v.id where s.k = 'fb2'), 0,
  'deleting the credential row deletes its Vault secret');
delete from public.channels where id = '22000000-0000-0000-0000-0000000006a1';
select is((select count(*)::int from public.channel_credentials), 0, 'deleting a channel deletes its credential row');
select is((select count(*)::int from vault.secrets v join s on s.id = v.id where s.k = 'wa'), 0,
  'deleting a channel deletes its Vault secret');

select * from finish();
rollback;
