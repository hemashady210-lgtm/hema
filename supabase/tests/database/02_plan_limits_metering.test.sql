-- pgTAP: plan limits enforced in the database + AI-reply metering. Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(57);

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

-- A released reply is re-reserved, never free (review fix 0013).
select is(
  (select reason from public.consume_ai_reply('10000000-0000-0000-0000-00000000000b', 'reply:7')),
  'ok', 'consume after release reserves again with the full checks');
select is(
  (select ai_replies_used from public.usage_periods where workspace_id = '10000000-0000-0000-0000-00000000000b'),
  100, 'the retried reply is counted');
select ok(exists (select 1 from public.usage_events where idempotency_key = 'reply:7:r2' and kind = 'ai_reply_reserved'),
  'the second attempt is booked under its own ledger key');
select is(
  (select reason from public.consume_ai_reply('10000000-0000-0000-0000-00000000000b', 'reply:7')),
  'already_reserved', 'replaying the active attempt is still idempotent');
select ok(public.release_ai_reply('reply:7'), 'release returns the latest attempt');
select is(
  (select reason from public.consume_ai_reply('10000000-0000-0000-0000-00000000000a', 'reply:8')),
  'idempotency_key_conflict', 'a key booked by another workspace is refused');
select is(
  (select reason from public.consume_ai_reply('10000000-0000-0000-0000-00000000000b', 'reply:9:released')),
  'invalid_idempotency_key', 'reserved key suffixes cannot be used as idempotency keys');

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

-- Feature gates on Starter (TESTING §3 rule 2)
select throws_like($$ insert into public.branches (workspace_id, name) values ('10000000-0000-0000-0000-00000000000a', '{"en":"B"}') $$,
  'plan_feature:multi_branch', 'Starter: branches need multi_branch');
select throws_like($$ insert into public.orders (workspace_id, customer_id, source, currency) values ('10000000-0000-0000-0000-00000000000a', gen_random_uuid(), 'ai', 'SAR') $$,
  'plan_feature:orders', 'Starter: orders not available');
select throws_like($$ insert into public.reservations (workspace_id, customer_id, source, party_size, reserved_at) values ('10000000-0000-0000-0000-00000000000a', gen_random_uuid(), 'ai', 2, now()) $$,
  'plan_feature:reservations', 'Starter: reservations not available');
select throws_like($$ insert into public.handoffs (workspace_id, conversation_id, requested_by) values ('10000000-0000-0000-0000-00000000000a', gen_random_uuid(), 'customer') $$,
  'plan_feature:human_handoff', 'Starter: handoffs not available');
select throws_like($$ insert into public.api_keys (workspace_id, name, key_prefix, key_hash) values ('10000000-0000-0000-0000-00000000000a', 'k', 'sk', 'h-limit-test') $$,
  'plan_feature:api_access', 'Starter: API keys not available');

-- Overrides raise a limit; expired overrides are ignored.
insert into public.workspace_entitlement_overrides (workspace_id, key, value, reason) values
  ('10000000-0000-0000-0000-00000000000a', 'max_bots', '2', 'test');
select lives_ok($$ insert into public.bots (workspace_id, name) values ('10000000-0000-0000-0000-00000000000a', 'Bot 2') $$,
  'override raises max_bots');
insert into public.workspace_entitlement_overrides (workspace_id, key, value, reason, expires_at) values
  ('10000000-0000-0000-0000-00000000000a', 'max_users', '5', 'test', now() - interval '1 day');
select throws_like(
  $$ insert into public.workspace_members (workspace_id, user_id, role)
     values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', 'agent') $$,
  'plan_limit:max_users:%', 'an expired override is ignored');

-- Growth overage (counted, not blocked)
insert into public.workspaces (id, name, slug) values ('10000000-0000-0000-0000-00000000000d', 'Growth WS', 'ws-growth');
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select '10000000-0000-0000-0000-00000000000d', id, 'active', 'manual', 'month', now() from public.plans where code = 'growth';
insert into public.workspace_entitlement_overrides (workspace_id, key, value, reason) values
  ('10000000-0000-0000-0000-00000000000d', 'ai_replies_per_period', '1', 'test');
select results_eq($$ select allowed, is_overage from public.consume_ai_reply('10000000-0000-0000-0000-00000000000d', 'g:1') $$,
  $$ values (true, false) $$, 'Growth: included reply');
select results_eq($$ select allowed, is_overage from public.consume_ai_reply('10000000-0000-0000-0000-00000000000d', 'g:2') $$,
  $$ values (true, true) $$, 'Growth: beyond the included replies is allowed as overage');
select is((select overage_replies from public.usage_periods where workspace_id = '10000000-0000-0000-0000-00000000000d'),
  1, 'overage replies are counted for manual invoicing');

-- pending_activation never unlocks the target plan (review fix 0013).
select lives_ok(
  $$ insert into public.subscriptions (workspace_id, plan_id, status, provider)
     select '10000000-0000-0000-0000-00000000000b', id, 'pending_activation', 'paypal' from public.plans where code = 'enterprise' $$,
  'a pending subscription can sit beside the live trial');
select is(private.entitlement_int('10000000-0000-0000-0000-00000000000b', 'max_bots'), 1,
  'pending Enterprise does not raise limits');
select ok(not private.entitlement_bool('10000000-0000-0000-0000-00000000000b', 'api_access'),
  'pending Enterprise does not unlock features');

-- Upgrading mid-trial opens a new period on the new plan.
update public.subscriptions set status = 'expired', ended_at = now()
 where workspace_id = '10000000-0000-0000-0000-00000000000b' and status = 'trialing';
update public.subscriptions s set status = 'active', billing_interval = 'month', current_period_start = now(),
       plan_id = (select id from public.plans where code = 'growth')
 where s.workspace_id = '10000000-0000-0000-0000-00000000000b' and s.status = 'pending_activation';
select results_eq($$ select reason, included from public.consume_ai_reply('10000000-0000-0000-0000-00000000000b', 'after-upgrade:1') $$,
  $$ values ('ok'::text, 5000) $$, 'after upgrading, replies use the new plan''s period');

-- Content row limits are entitlements (owner decision F3)
select results_eq(
  $$ select p.code, pe.key, pe.value #>> '{}' from public.plan_entitlements pe join public.plans p on p.id = pe.plan_id
     where pe.key in ('max_faqs', 'max_catalog_items', 'knowledge_files_max') order by p.sort_order, pe.key $$,
  $$ values ('trial'::text, 'knowledge_files_max'::text, '5'::text), ('trial', 'max_catalog_items', '50'), ('trial', 'max_faqs', '30'),
            ('starter', 'knowledge_files_max', '20'), ('starter', 'max_catalog_items', '500'), ('starter', 'max_faqs', '200'),
            ('growth', 'knowledge_files_max', '100'), ('growth', 'max_catalog_items', '2000'), ('growth', 'max_faqs', '1000'),
            ('enterprise', 'knowledge_files_max', null), ('enterprise', 'max_catalog_items', null), ('enterprise', 'max_faqs', null) $$,
  'content limits per plan (Enterprise unlimited unless overridden)');
insert into public.workspaces (id, name, slug) values ('10000000-0000-0000-0000-0000000000c1', 'Content WS', 'ws-content');
insert into public.subscriptions (workspace_id, plan_id, status, provider, trial_ends_at)
  select '10000000-0000-0000-0000-0000000000c1', id, 'trialing', 'manual', now() + interval '7 days' from public.plans where code = 'trial';
insert into public.kb_sources (id, workspace_id, type, title) values
  ('33000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1', 'faq', 'FAQ'),
  ('33000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000c1', 'file', 'Files'),
  ('33000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-0000000000c1', 'manual', 'Notes');
select lives_ok($$ insert into public.faqs (workspace_id, source_id, question, answer)
  select '10000000-0000-0000-0000-0000000000c1', '33000000-0000-0000-0000-0000000000c1', 'q' || g, 'a' from generate_series(1, 30) g $$,
  'Trial: 30 FAQs');
select throws_like($$ insert into public.faqs (workspace_id, source_id, question, answer)
  values ('10000000-0000-0000-0000-0000000000c1', '33000000-0000-0000-0000-0000000000c1', 'q31', 'a') $$,
  'plan_limit:max_faqs:30', 'Trial: the 31st FAQ is rejected');
select lives_ok($$ insert into public.catalog_items (workspace_id, name, price_cents)
  select '10000000-0000-0000-0000-0000000000c1', jsonb_build_object('en', 'item ' || g), 100 from generate_series(1, 50) g $$,
  'Trial: 50 catalog items');
select throws_like($$ insert into public.catalog_items (workspace_id, name, price_cents)
  values ('10000000-0000-0000-0000-0000000000c1', '{"en":"item 51"}', 100) $$,
  'plan_limit:max_catalog_items:50', 'Trial: the 51st catalog item is rejected');
select lives_ok($$ insert into public.kb_documents (workspace_id, source_id, storage_path, mime_type, size_bytes)
  select '10000000-0000-0000-0000-0000000000c1', '33000000-0000-0000-0000-0000000000c2', 'c1/f' || g || '.pdf', 'application/pdf', 1000
  from generate_series(1, 5) g $$, 'Trial: 5 knowledge files');
select throws_like($$ insert into public.kb_documents (workspace_id, source_id, storage_path, mime_type, size_bytes)
  values ('10000000-0000-0000-0000-0000000000c1', '33000000-0000-0000-0000-0000000000c2', 'c1/f6.pdf', 'application/pdf', 1000) $$,
  'plan_limit:knowledge_files_max:5', 'Trial: the 6th file is rejected');
select lives_ok($$ insert into public.kb_documents (workspace_id, source_id, body)
  values ('10000000-0000-0000-0000-0000000000c1', '33000000-0000-0000-0000-0000000000c3', 'manual note') $$,
  'manual notes do not count as files');
update public.plan_entitlements set value = '10' where key = 'knowledge_files_max'
  and plan_id = (select id from public.plans where code = 'trial');
select throws_like($$ insert into public.kb_documents (workspace_id, source_id, storage_path, mime_type, size_bytes)
  values ('10000000-0000-0000-0000-0000000000c1', '33000000-0000-0000-0000-0000000000c2', 'c1/big.pdf', 'application/pdf', 11 * 1048576) $$,
  'plan_limit:knowledge_file_max_mb:10', 'files above the plan size limit are rejected');
insert into public.workspace_entitlement_overrides (workspace_id, key, value, reason) values
  ('10000000-0000-0000-0000-0000000000c1', 'max_faqs', '40', 'custom contract');
select lives_ok($$ insert into public.faqs (workspace_id, source_id, question, answer)
  values ('10000000-0000-0000-0000-0000000000c1', '33000000-0000-0000-0000-0000000000c1', 'q31', 'a') $$,
  'a per-workspace override (Enterprise custom) raises the limit');

-- Monthly period bounds (UTC, month-end anchors)
select results_eq($$ select * from private.monthly_period_bounds('2027-01-31 10:00Z', '2027-02-28 12:00Z') $$,
  $$ values ('2027-02-28 10:00Z'::timestamptz, '2027-03-31 10:00Z'::timestamptz) $$,
  'a Jan 31 anchor never yields a period that already ended');
select results_eq($$ select * from private.monthly_period_bounds('2026-11-26 08:00Z', '2026-12-27 00:00Z') $$,
  $$ values ('2026-12-26 08:00Z'::timestamptz, '2027-01-26 08:00Z'::timestamptz) $$,
  'monthly periods follow the subscription anchor');

select * from finish();
rollback;
