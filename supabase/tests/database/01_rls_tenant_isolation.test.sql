-- pgTAP: tenant isolation (run with `supabase test db`). Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

-- Fixtures: two workspaces, one owner each (inserted as the migration owner).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.workspaces (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'A', 'ws-a'),
  ('10000000-0000-0000-0000-00000000000b', 'B', 'ws-b');
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select w, p.id, 'active', 'manual', 'month', now()
  from public.plans p, unnest(array['10000000-0000-0000-0000-00000000000a',
                                    '10000000-0000-0000-0000-00000000000b']::uuid[]) w
  where p.code = 'growth';
insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'owner');
insert into public.bots (id, workspace_id, name) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Bot A'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'Bot B');
insert into public.knowledge_sources (id, workspace_id, type, title) values
  ('30000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'qa', 'FAQ B');

-- Act as user A.
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
end $$;

select results_eq($$ select slug from public.workspaces $$::text, $$ values ('ws-a') $$::text,
  'user A sees only workspace A');
select is((select count(*)::int from public.bots), 1, 'user A sees only own bots');
select is((select count(*)::int from public.knowledge_sources), 0, 'user A cannot see B knowledge sources');
select is((select count(*)::int from public.knowledge_chunks), 0, 'chunks are not client-readable');
select is((select count(*)::int from public.jobs), 0, 'jobs are not client-readable');
select is((select count(*)::int from public.payment_webhook_events), 0, 'webhook inbox not client-readable');

update public.bots set name = 'hacked' where id = '20000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.bots where name = 'hacked'), 0, 'cross-tenant update affects 0 rows');

select throws_ok(
  $$ insert into public.bots (workspace_id, name) values ('10000000-0000-0000-0000-00000000000b', 'x') $$,
  '42501', null, 'cannot insert a bot into another workspace');
select throws_ok(
  $$ update public.workspaces set status = 'active' $$,
  '42501', null, 'workspace.status is not client-updatable');
select throws_ok(
  $$ insert into public.messages (workspace_id, conversation_id, channel_connection_id, direction, sender_type, delivery_status)
     values ('10000000-0000-0000-0000-00000000000a', gen_random_uuid(), gen_random_uuid(), 'outbound', 'ai', 'queued') $$,
  '42501', null, 'messages are written by edge functions only');
select throws_ok(
  $$ select public.get_workspace_entitlements('10000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'cannot read another workspace''s entitlements');
select throws_ok(
  $$ select * from public.consume_ai_reply('10000000-0000-0000-0000-00000000000a', 'x') $$,
  '42501', null, 'metering RPC is service-role only');
select throws_ok(
  $$ select * from public.claim_jobs('ai', 'evil') $$,
  '42501', null, 'queue RPC is service-role only');
select is((select count(*)::int from public.plans), 3, 'public plans are readable (trial hidden)');

select * from finish();
rollback;
