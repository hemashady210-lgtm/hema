-- pgTAP: plan limits enforced in the database + AI-reply metering. Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local');
insert into public.workspaces (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Starter WS', 'ws-starter'),
  ('10000000-0000-0000-0000-00000000000b', 'Trial WS', 'ws-trial');
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select '10000000-0000-0000-0000-00000000000a', id, 'active', 'manual', 'month', now() from public.plans where code = 'starter';
insert into public.subscriptions (workspace_id, plan_id, status, provider, trial_ends_at)
  select '10000000-0000-0000-0000-00000000000b', id, 'trialing', 'manual', now() + interval '7 days' from public.plans where code = 'trial';
insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'owner');
insert into public.bots (id, workspace_id, name) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Bot A'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'Bot T');

-- Limits (Starter: 1 user, 1 bot, 1 Meta channel, no handoff/orders)
select throws_like(
  $$ insert into public.workspace_members (workspace_id, user_id, role)
     values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', 'agent') $$,
  'plan_limit:max_users:%', 'Starter: second user rejected');
select throws_like(
  $$ insert into public.bots (workspace_id, name) values ('10000000-0000-0000-0000-00000000000a', 'Bot 2') $$,
  'plan_limit:max_bots:%', 'Starter: second bot rejected');
select throws_like(
  $$ update public.bots set handoff_enabled = true where id = '20000000-0000-0000-0000-00000000000a' $$,
  'plan_feature:human_handoff', 'Starter: handoff not available');
select throws_like(
  $$ insert into public.channel_connection_requests (workspace_id, bot_id, channel_type, requested_by, contact_name, contact_email, business_name)
     values ('10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'whatsapp',
             '00000000-0000-0000-0000-00000000000a', 'n', 'n@test.local', 'biz') $$,
  'plan_feature:channel_whatsapp', 'Trial: Meta channels not available');
select lives_ok(
  $$ insert into public.channel_connection_requests (workspace_id, bot_id, channel_type, requested_by, contact_name, contact_email, business_name)
     values ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'whatsapp',
             '00000000-0000-0000-0000-00000000000a', 'n', 'n@test.local', 'biz') $$,
  'Starter: first Meta channel request accepted');
select throws_like(
  $$ insert into public.channel_connection_requests (workspace_id, bot_id, channel_type, requested_by, contact_name, contact_email, business_name)
     values ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'instagram',
             '00000000-0000-0000-0000-00000000000a', 'n', 'n@test.local', 'biz') $$,
  'plan_limit:max_meta_channels:%', 'Starter: second Meta channel rejected');

-- Metering (Trial: 100 replies, hard stop)
select is(
  (select count(*)::int from generate_series(1, 105) g,
     lateral public.consume_ai_reply('10000000-0000-0000-0000-00000000000b', 'reply:' || g) c
   where c.allowed),
  100, 'Trial: exactly 100 AI replies allowed');
select is(
  (select reason from public.consume_ai_reply('10000000-0000-0000-0000-00000000000b', 'reply:extra')),
  'trial_quota_exhausted', 'Trial: hard stop reason');
select results_eq(
  $$ select threshold_pct from public.usage_alerts where workspace_id = '10000000-0000-0000-0000-00000000000b' order by 1 $$::text,
  $$ values (80), (100) $$::text, 'alerts recorded once at 80 % and 100 %');
select is(
  (select reason from public.consume_ai_reply('10000000-0000-0000-0000-00000000000b', 'reply:7')),
  'already_reserved', 'idempotent replay does not double-count');
select ok(public.release_ai_reply('reply:7'), 'release returns the reply to the quota');
select ok(not public.release_ai_reply('reply:7'), 'double release is a no-op');
select is(
  (select ai_replies_used from public.usage_periods where workspace_id = '10000000-0000-0000-0000-00000000000b'),
  99, 'usage counter reflects the release');

-- Model routing (decision A15)
select is(
  (select count(*)::int from public.plans p
   where exists (select 1 from public.plan_entitlements pe where pe.plan_id = p.id and pe.key = 'ai_model_profile')),
  0, 'no plan overrides ai_model_profile (all plans use the default)');
select is(
  private.get_entitlement('10000000-0000-0000-0000-00000000000a', 'ai_model_profile') #>> '{}',
  'standard', 'Starter resolves to the standard profile');
select results_eq(
  $$ select generation_model, classifier_model, escalation_model from public.ai_model_profiles where code = 'standard' $$::text,
  $$ values ('claude-haiku-5-5'::text, 'claude-haiku-5-5'::text, 'claude-sonnet-5-5'::text) $$::text,
  'standard = Haiku replies + classification, Sonnet escalation');
insert into public.workspaces (id, name, slug) values ('10000000-0000-0000-0000-00000000000e', 'Ent WS', 'ws-ent');
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select '10000000-0000-0000-0000-00000000000e', id, 'active', 'manual', 'month', now() from public.plans where code = 'enterprise';
insert into public.workspace_entitlement_overrides (workspace_id, key, value, reason)
  values ('10000000-0000-0000-0000-00000000000e', 'ai_model_profile', '"premium"', 'contract');
select is(
  private.get_entitlement('10000000-0000-0000-0000-00000000000e', 'ai_model_profile') #>> '{}',
  'premium', 'Enterprise contract override assigns the premium profile');
select throws_ok(
  $$ insert into public.ai_runs (workspace_id, provider, model, escalated, escalation_reason)
     values ('10000000-0000-0000-0000-00000000000e', 'anthropic', 'm', true, 'bored') $$,
  '23514', null, 'escalation_reason is constrained');

-- Grace (E4): service keeps running during the 3-day grace window.
insert into public.workspaces (id, name, slug) values ('10000000-0000-0000-0000-00000000000f', 'Grace WS', 'ws-grace');
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start, grace_ends_at)
  select '10000000-0000-0000-0000-00000000000f', id, 'grace', 'manual', 'month', now(), now() + interval '3 days'
  from public.plans where code = 'starter';
select is(
  (select reason from public.consume_ai_reply('10000000-0000-0000-0000-00000000000f', 'grace:1')),
  'ok', 'grace: AI replies still allowed');
select throws_ok(
  $$ insert into public.subscriptions (workspace_id, plan_id, status, provider)
     select '10000000-0000-0000-0000-00000000000e', id, 'grace', 'manual' from public.plans where code = 'starter' $$,
  '23514', null, 'grace requires grace_ends_at');
select is(
  (select value #>> '{}' from public.platform_settings where key = 'subscription_grace_days'),
  '3', 'grace period is data (3 days)');

-- Playground runs are never billed (§13).
insert into public.ai_runs (id, workspace_id, provider, model, is_test) values
  ('40000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'anthropic', 'm', true),
  ('40000000-0000-0000-0000-00000000000e', '10000000-0000-0000-0000-00000000000e', 'anthropic', 'm', false);
select is(
  (select reason from public.consume_ai_reply('10000000-0000-0000-0000-00000000000a', 'test:1',
     '40000000-0000-0000-0000-00000000000a')),
  'test_run_not_billable', 'test runs never consume quota');
select is(
  (select reason from public.consume_ai_reply('10000000-0000-0000-0000-00000000000a', 'xws:1',
     '40000000-0000-0000-0000-00000000000e')),
  'ai_run_not_found', 'an AI run from another workspace cannot be billed here');
select throws_ok(
  $$ update public.ai_runs set billed = true where id = '40000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'a test run can never be marked billed');

select * from finish();
rollback;
