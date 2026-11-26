-- pgTAP: behaviour of the P2 tables and reconciled columns (DECISIONS §E). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(55);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'o8@test.local'),
  ('00000000-0000-0000-0000-0000000008a3', 'g8@test.local'),
  ('00000000-0000-0000-0000-0000000008a4', 'v8@test.local');
insert into public.workspaces (id, name, slug) values
  ('10000000-0000-0000-0000-0000000008aa', 'A8', 'ws-beh-a'),
  ('10000000-0000-0000-0000-0000000008bb', 'B8', 'ws-beh-b');
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select w, p.id, 'active', 'manual', 'month', now()
  from public.plans p, unnest(array['10000000-0000-0000-0000-0000000008aa',
                                    '10000000-0000-0000-0000-0000000008bb']::uuid[]) w
  where p.code = 'enterprise';
insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-0000000008a1', 'owner'),
  ('10000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-0000000008a3', 'agent'),
  ('10000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-0000000008a4', 'viewer');
insert into public.bots (id, workspace_id, name) values
  ('20000000-0000-0000-0000-0000000008aa', '10000000-0000-0000-0000-0000000008aa', 'Bot A'),
  ('20000000-0000-0000-0000-0000000008bb', '10000000-0000-0000-0000-0000000008bb', 'Bot B');
insert into public.channels (id, workspace_id, bot_id, channel_type, status, connection_mode, external_account_id) values
  ('22000000-0000-0000-0000-0000000008a1', '10000000-0000-0000-0000-0000000008aa', '20000000-0000-0000-0000-0000000008aa', 'widget', 'connected', 'automatic', null),
  ('22000000-0000-0000-0000-0000000008a2', '10000000-0000-0000-0000-0000000008aa', '20000000-0000-0000-0000-0000000008aa', 'whatsapp', 'pending', 'manual', 'PHONE-1'),
  ('22000000-0000-0000-0000-0000000008b2', '10000000-0000-0000-0000-0000000008bb', '20000000-0000-0000-0000-0000000008bb', 'whatsapp', 'not_connected', 'manual', 'PHONE-1');
insert into public.customers (id, workspace_id) values ('30000000-0000-0000-0000-0000000008aa', '10000000-0000-0000-0000-0000000008aa');
insert into public.conversations (id, workspace_id, bot_id, channel_id, customer_id) values
  ('31000000-0000-0000-0000-0000000008aa', '10000000-0000-0000-0000-0000000008aa', '20000000-0000-0000-0000-0000000008aa',
   '22000000-0000-0000-0000-0000000008a1', '30000000-0000-0000-0000-0000000008aa');

-- Enum vocabularies (E4, E5, E10)
select results_eq($$ select unnest(enum_range(null::public.channel_status))::text $$,
  $$ values ('not_connected'), ('pending'), ('connected'), ('error'), ('disabled') $$, 'channel status values (E5)');
select results_eq($$ select unnest(enum_range(null::public.connection_mode))::text $$,
  $$ values ('automatic'), ('manual'), ('oauth') $$, 'connection_mode values (E5)');
select results_eq($$ select unnest(enum_range(null::public.conversation_status))::text $$,
  $$ values ('open'), ('pending'), ('closed') $$, 'conversation status values (E10)');
select results_eq($$ select unnest(enum_range(null::public.conversation_handler))::text $$,
  $$ values ('ai'), ('human') $$, 'conversation handler values (E10)');
select ok('grace' = any (enum_range(null::public.subscription_status)::text[]), 'subscription status includes grace (E4)');
select results_eq($$ select status::text, handler::text from public.conversations where id = '31000000-0000-0000-0000-0000000008aa' $$,
  $$ values ('open'::text, 'ai'::text) $$, 'new conversations start open and handled by AI');

-- bot_configs: versioned and immutable
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000008a1","role":"authenticated"}', true);
insert into public.bot_configs (workspace_id, bot_id, persona) values
  ('10000000-0000-0000-0000-0000000008aa', '20000000-0000-0000-0000-0000000008aa', 'v1'),
  ('10000000-0000-0000-0000-0000000008aa', '20000000-0000-0000-0000-0000000008aa', 'v2');
select results_eq($$ select version, created_by::text from public.bot_configs where bot_id = '20000000-0000-0000-0000-0000000008aa' order by version $$,
  $$ values (1, '00000000-0000-0000-0000-0000000008a1'::text), (2, '00000000-0000-0000-0000-0000000008a1'::text) $$,
  'saving settings creates version n+1, stamped with the author');
select lives_ok($$ update public.bots set active_config_id = (select id from public.bot_configs where bot_id = '20000000-0000-0000-0000-0000000008aa' and version = 2)
  where id = '20000000-0000-0000-0000-0000000008aa' $$, 'owner can activate a version');
select throws_ok($$ update public.bots set status = 'active' where id = '20000000-0000-0000-0000-0000000008aa' $$,
  '42501', null, 'bot status is server-only (readiness gate, P11)');
select throws_ok($$ update public.bots set public_key = 'wk_x' where id = '20000000-0000-0000-0000-0000000008aa' $$,
  '42501', null, 'bot public key is server-only');
select throws_ok($$ insert into public.bots (workspace_id, name, status) values ('10000000-0000-0000-0000-0000000008aa', 'x', 'active') $$,
  '42501', null, 'a bot cannot be created already active');
reset role;
select throws_ok($$ update public.bot_configs set persona = 'edited' where bot_id = '20000000-0000-0000-0000-0000000008aa' $$,
  '42501', null, 'bot config versions are immutable, even for the service side');

-- Feature flags (E2)
select results_eq($$ select scope::text, enabled from public.feature_flags where key = 'meta_embedded_signup' and workspace_id is null $$,
  $$ values ('global'::text, false) $$, 'meta_embedded_signup is seeded OFF globally');
select ok(not private.feature_enabled('meta_embedded_signup', '10000000-0000-0000-0000-0000000008aa'), 'flag resolves OFF by default');
insert into public.feature_flags (key, scope, workspace_id, enabled) values
  ('meta_embedded_signup', 'workspace', '10000000-0000-0000-0000-0000000008aa', true);
select ok(private.feature_enabled('meta_embedded_signup', '10000000-0000-0000-0000-0000000008aa'), 'workspace override turns the flag on');
select ok(not private.feature_enabled('meta_embedded_signup', '10000000-0000-0000-0000-0000000008bb'), 'other workspaces keep the global value');
select ok(not private.feature_enabled('no_such_flag'), 'unknown flags are off');

-- Analytics partitions (create the current window first: the scheduler does this from P10)
select private.ensure_analytics_partitions(3);
insert into public.analytics_events (id, workspace_id, event_type) values
  ('40000000-0000-0000-0000-0000000008a1', '10000000-0000-0000-0000-0000000008aa', 'message.inbound');
select is((select tableoid::regclass::text from public.analytics_events where id = '40000000-0000-0000-0000-0000000008a1'),
  'private.analytics_events_' || to_char(now() at time zone 'UTC', 'YYYY_MM'), 'events land in the current monthly partition');
insert into public.analytics_events (id, workspace_id, event_type, occurred_at) values
  ('40000000-0000-0000-0000-0000000008a2', '10000000-0000-0000-0000-0000000008aa', 'message.inbound', now() + interval '28 months');
select is((select tableoid::regclass::text from public.analytics_events where id = '40000000-0000-0000-0000-0000000008a2'),
  'private.analytics_events_default', 'events beyond the created partitions land in the default partition');
select cmp_ok(private.ensure_analytics_partitions(30), '>', 0, 'ensure_analytics_partitions creates missing months');
select is((select tableoid::regclass::text from public.analytics_events where id = '40000000-0000-0000-0000-0000000008a2'),
  'private.analytics_events_' || to_char((now() + interval '28 months') at time zone 'UTC', 'YYYY_MM'),
  'rows waiting in the default partition move into the new month');
select throws_ok($$ insert into public.analytics_events (workspace_id, event_type) values ('10000000-0000-0000-0000-0000000008aa', 'Bad Type') $$,
  '23514', null, 'event_type follows the dotted naming rule');

-- Append-only tables, and workspace deletion still works
insert into public.billing_events (workspace_id, event_type, to_status, source, actor_type) values
  ('10000000-0000-0000-0000-0000000008bb', 'subscription.status_changed', 'active', 'system', 'system');
insert into public.audit_logs (workspace_id, actor_type, action) values ('10000000-0000-0000-0000-0000000008bb', 'system', 'test.event');
select throws_ok($$ update public.billing_events set source = 'user' $$, '42501', null, 'billing_events cannot be edited');
select throws_ok($$ delete from public.billing_events $$, '42501', null, 'billing_events cannot be deleted directly');
select throws_ok($$ update public.audit_logs set action = 'x' where action = 'test.event' $$, '42501', null, 'audit_logs cannot be edited');
select lives_ok($$ delete from public.workspaces where id = '10000000-0000-0000-0000-0000000008bb' $$,
  'deleting a workspace still works (cascades through append-only tables)');
select is((select count(*)::int from public.audit_logs where action = 'test.event' and workspace_id is null), 1,
  'audit rows survive workspace deletion, detached from the workspace');

-- Conversations: preview + assignee rule
insert into public.messages (workspace_id, conversation_id, channel_id, direction, sender, content, delivery_status) values
  ('10000000-0000-0000-0000-0000000008aa', '31000000-0000-0000-0000-0000000008aa', '22000000-0000-0000-0000-0000000008a1',
   'inbound', 'customer', E'Hi   there,\n do you   deliver?', 'received');
select is((select last_message_preview from public.conversations where id = '31000000-0000-0000-0000-0000000008aa'),
  'Hi there, do you deliver?', 'last_message_preview is set from the newest message (whitespace collapsed)');
insert into public.messages (workspace_id, conversation_id, channel_id, direction, sender, content, delivery_status) values
  ('10000000-0000-0000-0000-0000000008aa', '31000000-0000-0000-0000-0000000008aa', '22000000-0000-0000-0000-0000000008a1',
   'outbound', 'ai', repeat('x', 1000), 'sent');
select is((select char_length(last_message_preview) from public.conversations where id = '31000000-0000-0000-0000-0000000008aa'),
  280, 'preview is capped at 280 characters');
select throws_ok($$ update public.conversations set assigned_to = '00000000-0000-0000-0000-0000000008a4'
  where id = '31000000-0000-0000-0000-0000000008aa' $$, '23503', null, 'conversations cannot be assigned to a viewer');
select lives_ok($$ update public.conversations set assigned_to = '00000000-0000-0000-0000-0000000008a3', handler = 'human'
  where id = '31000000-0000-0000-0000-0000000008aa' $$, 'conversations can be assigned to an agent and taken over');

-- Channels: real status only (§11.5) + one live owner per external account
select throws_ok($$ update public.channels set status = 'connected' where id = '22000000-0000-0000-0000-0000000008a2' $$,
  '23514', null, 'a Meta channel cannot be connected without a passing health check');
select lives_ok($$ update public.channels set status = 'connected', health_status = 'passing', last_health_check_at = now()
  where id = '22000000-0000-0000-0000-0000000008a2' $$, 'connected after a passing health check');
insert into public.workspaces (id, name, slug) values ('10000000-0000-0000-0000-0000000008cc', 'C8', 'ws-beh-c');
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select '10000000-0000-0000-0000-0000000008cc', id, 'active', 'manual', 'month', now() from public.plans where code = 'enterprise';
insert into public.bots (id, workspace_id, name) values ('20000000-0000-0000-0000-0000000008cc', '10000000-0000-0000-0000-0000000008cc', 'C');
select throws_ok($$ insert into public.channels (workspace_id, bot_id, channel_type, status, connection_mode, external_account_id)
  values ('10000000-0000-0000-0000-0000000008cc', '20000000-0000-0000-0000-0000000008cc', 'whatsapp', 'pending', 'manual', 'PHONE-1') $$,
  '23505', null, 'the same WhatsApp number cannot be live in two workspaces');
select throws_ok($$ insert into public.whatsapp_templates (workspace_id, channel_id, name, language, status)
  values ('10000000-0000-0000-0000-0000000008aa', '22000000-0000-0000-0000-0000000008a1', 't', 'ar', 'APPROVED') $$,
  '23514', null, 'templates only attach to WhatsApp channels');

-- Orders, classification, hours, knowledge base
select throws_ok($$ insert into public.orders (workspace_id, customer_id, source, currency, subtotal_cents, delivery_fee_cents, total_cents)
  values ('10000000-0000-0000-0000-0000000008aa', '30000000-0000-0000-0000-0000000008aa', 'ai', 'SAR', 1000, 500, 1200) $$,
  '23514', null, 'order total must equal subtotal + delivery fee');
select throws_ok($$ insert into public.orders (workspace_id, customer_id, source, currency, type)
  values ('10000000-0000-0000-0000-0000000008aa', '30000000-0000-0000-0000-0000000008aa', 'ai', 'SAR', 'delivery') $$,
  '23514', null, 'delivery orders need an address');
select throws_ok($$ insert into public.question_classifications (message_id, workspace_id, category)
  select id, workspace_id, 'pricing' from public.messages where workspace_id = '10000000-0000-0000-0000-0000000008aa' limit 1 $$,
  '23514', null, 'question categories follow the §6 list');
select throws_ok($$ insert into public.working_hours (workspace_id, weekday, is_closed, open_time, close_time)
  values ('10000000-0000-0000-0000-0000000008aa', 5, true, '09:00', '17:00') $$,
  '23514', null, 'a closed day has no opening times');
insert into public.kb_sources (id, workspace_id, type, title) values
  ('33000000-0000-0000-0000-0000000008a1', '10000000-0000-0000-0000-0000000008aa', 'faq', 'FAQ');
select throws_ok($$ insert into public.kb_documents (workspace_id, source_id) values
  ('10000000-0000-0000-0000-0000000008aa', '33000000-0000-0000-0000-0000000008a1') $$,
  '23514', null, 'a KB document is either a file or a manual note');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000008a1","role":"authenticated"}', true);
select throws_ok($$ insert into public.kb_documents (workspace_id, source_id, body) values
  ('10000000-0000-0000-0000-0000000008aa', '33000000-0000-0000-0000-0000000008a1', 'note') $$,
  '42501', null, 'manual notes only go into manual sources');
reset role;

-- Review fixes (0013)
select throws_ok($$ update public.customers set workspace_id = '10000000-0000-0000-0000-0000000008cc'
  where id = '30000000-0000-0000-0000-0000000008aa' $$, '42501', null, 'rows cannot move to another workspace');
select throws_ok($$ insert into public.catalog_categories (workspace_id, name) values ('10000000-0000-0000-0000-0000000008aa', '{}') $$,
  '23514', null, 'localized text needs at least one non-empty language');
select throws_ok($$ insert into public.notifications (workspace_id, user_id, type, title)
  values ('10000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-0000000008a1', 'x.y', '{"en":"Only English"}') $$,
  '23514', null, 'notifications carry both languages');
select throws_ok($$ insert into public.catalog_items (workspace_id, name, price_cents, currency)
  values ('10000000-0000-0000-0000-0000000008aa', '{"en":"x"}', 100, 'sar') $$, '23514', null, 'currency is an ISO 4217 code');
select throws_ok($$ update public.bots set avatar_path = '10000000-0000-0000-0000-0000000008cc/a.png'
  where id = '20000000-0000-0000-0000-0000000008aa' $$, '23514', null, 'asset paths stay inside the workspace prefix');
select throws_ok($$ insert into public.kb_chunks (workspace_id, bot_id, source_id, source_type, chunk_index, content)
  values ('10000000-0000-0000-0000-0000000008aa', '20000000-0000-0000-0000-0000000008cc', '33000000-0000-0000-0000-0000000008a1', 'faq', 0, 'x') $$,
  '23503', null, 'chunks cannot reference another tenant''s bot');
select throws_ok($$ delete from public.bot_configs where bot_id = '20000000-0000-0000-0000-0000000008aa' $$,
  '42501', null, 'bot config versions cannot be deleted');

-- Human takeover is the human_handoff feature.
insert into public.workspaces (id, name, slug) values ('10000000-0000-0000-0000-0000000008dd', 'S8', 'ws-beh-s');
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select '10000000-0000-0000-0000-0000000008dd', id, 'active', 'manual', 'month', now() from public.plans where code = 'starter';
insert into public.bots (id, workspace_id, name) values ('20000000-0000-0000-0000-0000000008dd', '10000000-0000-0000-0000-0000000008dd', 'S');
insert into public.channels (id, workspace_id, bot_id, channel_type, status, connection_mode) values
  ('22000000-0000-0000-0000-0000000008d1', '10000000-0000-0000-0000-0000000008dd', '20000000-0000-0000-0000-0000000008dd', 'widget', 'connected', 'automatic');
insert into public.customers (id, workspace_id) values ('30000000-0000-0000-0000-0000000008dd', '10000000-0000-0000-0000-0000000008dd');
insert into public.conversations (id, workspace_id, bot_id, channel_id, customer_id) values
  ('31000000-0000-0000-0000-0000000008dd', '10000000-0000-0000-0000-0000000008dd', '20000000-0000-0000-0000-0000000008dd',
   '22000000-0000-0000-0000-0000000008d1', '30000000-0000-0000-0000-0000000008dd');
select throws_like($$ update public.conversations set handler = 'human' where id = '31000000-0000-0000-0000-0000000008dd' $$,
  'plan_feature:human_handoff', 'Starter: taking a conversation over needs human_handoff');

-- Manual Meta connect on Starter (1 Meta channel): request → channel pending → connected.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000008d1', 'sd@test.local');
select lives_ok($$ insert into public.channel_connection_requests (id, workspace_id, bot_id, channel_type, requested_by, contact_name, contact_email, business_name)
  values ('23000000-0000-0000-0000-0000000008dd', '10000000-0000-0000-0000-0000000008dd', '20000000-0000-0000-0000-0000000008dd', 'whatsapp',
          '00000000-0000-0000-0000-0000000008d1', 'n', 'n@test.local', 'biz') $$, 'Starter files its one WhatsApp request');
select lives_ok($$ insert into public.channels (id, workspace_id, bot_id, channel_type, status, connection_mode, external_account_id)
  values ('22000000-0000-0000-0000-0000000008d2', '10000000-0000-0000-0000-0000000008dd', '20000000-0000-0000-0000-0000000008dd',
          'whatsapp', 'pending', 'manual', 'PHONE-S') $$, 'admin creates the channel that fulfils the request');
select lives_ok($$ update public.channel_connection_requests set channel_id = '22000000-0000-0000-0000-0000000008d2', status = 'completed'
  where id = '23000000-0000-0000-0000-0000000008dd' $$, 'request linked and completed');
select lives_ok($$ update public.channels set status = 'connected', health_status = 'passing', last_health_check_at = now()
  where id = '22000000-0000-0000-0000-0000000008d2' $$, 'channel connected after a passing health check');
select throws_like($$ insert into public.channel_connection_requests (workspace_id, bot_id, channel_type, requested_by, contact_name, contact_email, business_name)
  values ('10000000-0000-0000-0000-0000000008dd', '20000000-0000-0000-0000-0000000008dd', 'instagram',
          '00000000-0000-0000-0000-0000000008d1', 'n', 'n@test.local', 'biz') $$,
  'plan_limit:max_meta_channels:%', 'the next Meta channel is over the Starter limit');

-- Deleting a workspace with structured knowledge (re-index triggers) works.
insert into public.business_profiles (workspace_id, display_name) values ('10000000-0000-0000-0000-0000000008dd', '{"en":"S"}');
insert into public.working_hours (workspace_id, weekday, open_time, close_time) values ('10000000-0000-0000-0000-0000000008dd', 1, '09:00', '17:00');
insert into public.policies (workspace_id, type, content) values ('10000000-0000-0000-0000-0000000008dd', 'refund', '{"en":"No"}');
insert into public.catalog_items (workspace_id, name, price_cents) values ('10000000-0000-0000-0000-0000000008dd', '{"en":"Tea"}', 300);
select lives_ok($$ delete from public.workspaces where id = '10000000-0000-0000-0000-0000000008dd' $$,
  'a workspace with profile, hours, policies and catalog can be deleted');

select * from finish();
rollback;
