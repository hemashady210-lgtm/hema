-- pgTAP: role matrix for EVERY tenant table (DATABASE.md §4 is the spec).
-- For each table × operation (select / insert / update / delete) the set of roles that are
-- allowed is computed by actually attempting the operation as:
--   o = owner, a = admin, g = agent, v = viewer (all of workspace A),
--   x = owner of workspace B (cross-tenant), n = anon.
-- Every attempt runs in its own sub-transaction that is always rolled back.
-- Outcome rules: select/update/delete are "allowed" when they touch ≥ 1 row of workspace A;
-- insert is "allowed" unless it fails with 42501 (privilege or RLS WITH CHECK). RLS is
-- checked before NOT NULL / CHECK constraints, so a constraint error means the role got
-- past the security checks. Any other error on select/update/delete shows up as '!'.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Helper: run one statement in a sub-transaction, report rows or SQLSTATE, roll back.
-- ---------------------------------------------------------------------------
create schema test_helpers;
grant usage on schema test_helpers to public;
create function test_helpers.attempt(p_sql text) returns text
language plpgsql set search_path = '' as $$
declare
  n bigint;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0T01', message = n::text;
  exception
    when sqlstate 'P0T01' then return 'rows:' || sqlerrm;
    when others then return 'error:' || sqlstate;
  end;
end $$;
grant execute on function test_helpers.attempt(text) to public;

-- ---------------------------------------------------------------------------
-- Fixtures: one row (at least) in every tenant table of workspace A.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin-a@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'agent-a@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'viewer-a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Owner A'), ('00000000-0000-0000-0000-0000000000a2', 'Admin A'),
  ('00000000-0000-0000-0000-0000000000a3', 'Agent A'), ('00000000-0000-0000-0000-0000000000a4', 'Viewer A'),
  ('00000000-0000-0000-0000-0000000000b1', 'Owner B')
-- profiles are auto-created by the auth.users trigger (0015); set the display names.
on conflict (id) do update set full_name = excluded.full_name;
insert into public.workspaces (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'A', 'ws-matrix-a'),
  ('10000000-0000-0000-0000-00000000000b', 'B', 'ws-matrix-b'),
  ('10000000-0000-0000-0000-00000000000c', 'S', 'ws-matrix-s');
-- A is Enterprise so no plan gate interferes with the security checks under test.
insert into public.subscriptions (id, workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select '3d000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', id, 'active', 'manual', 'month', now()
  from public.plans where code = 'enterprise';
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select '10000000-0000-0000-0000-00000000000b', id, 'active', 'manual', 'month', now()
  from public.plans where code = 'growth';
-- S: a Starter workspace already at its bot limit (probe for plan-information leaks).
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select '10000000-0000-0000-0000-00000000000c', id, 'active', 'manual', 'month', now()
  from public.plans where code = 'starter';
insert into public.bots (workspace_id, name) values ('10000000-0000-0000-0000-00000000000c', 'S bot');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'admin'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'agent'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'viewer'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');
insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by) values
  ('10000000-0000-0000-0000-00000000000a', 'new@test.local', 'agent', 'hash-matrix-1', '00000000-0000-0000-0000-0000000000a1');
insert into public.workspace_onboarding (workspace_id) values ('10000000-0000-0000-0000-00000000000a');
insert into public.branches (id, workspace_id, name) values
  ('11000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '{"en":"Main"}');
insert into public.business_profiles (workspace_id, display_name) values
  ('10000000-0000-0000-0000-00000000000a', '{"en":"A"}');
insert into public.working_hours (workspace_id, weekday, open_time, close_time) values
  ('10000000-0000-0000-0000-00000000000a', 0, '09:00', '17:00');
insert into public.working_hours_overrides (workspace_id, date) values ('10000000-0000-0000-0000-00000000000a', '2026-12-25');
insert into public.policies (workspace_id, type, content) values
  ('10000000-0000-0000-0000-00000000000a', 'refund', '{"en":"Refunds within 7 days"}');
insert into public.bots (id, workspace_id, name) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Bot A');
insert into public.bot_configs (id, workspace_id, bot_id) values
  ('21000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a');
update public.bots set active_config_id = '21000000-0000-0000-0000-00000000000a'
  where id = '20000000-0000-0000-0000-00000000000a';
insert into public.channels (id, workspace_id, bot_id, channel_type, status, connection_mode) values
  ('22000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'widget', 'connected', 'automatic'),
  ('22000000-0000-0000-0000-00000000001a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'whatsapp', 'pending', 'manual');
insert into public.widget_settings (channel_id, workspace_id) values
  ('22000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a');
insert into public.channel_credentials (workspace_id, channel_id, vault_secret_id) values
  ('10000000-0000-0000-0000-00000000000a', '22000000-0000-0000-0000-00000000001a', vault.create_secret('matrix-test-token'));
insert into public.whatsapp_templates (workspace_id, channel_id, name, language, status) values
  ('10000000-0000-0000-0000-00000000000a', '22000000-0000-0000-0000-00000000001a', 'hello', 'ar', 'APPROVED');
insert into public.channel_connection_requests (id, workspace_id, bot_id, channel_type, requested_by, contact_name, contact_email, business_name) values
  ('23000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'instagram',
   '00000000-0000-0000-0000-0000000000a1', 'n', 'n@test.local', 'biz');
insert into public.channel_connection_events (workspace_id, request_id, to_status, actor_type) values
  ('10000000-0000-0000-0000-00000000000a', '23000000-0000-0000-0000-00000000000a', 'pending', 'user');
insert into public.customers (id, workspace_id, display_name) values
  ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Customer');
insert into public.customer_identities (workspace_id, customer_id, channel_type, external_user_id) values
  ('10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'widget', 'visitor-1');
insert into public.customer_notes (workspace_id, customer_id, author_id, body) values
  ('10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'VIP');
insert into public.conversations (id, workspace_id, bot_id, channel_id, customer_id) values
  ('31000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a',
   '22000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a');
insert into public.conversation_notes (workspace_id, conversation_id, author_id, body) values
  ('10000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'call back');
insert into public.messages (id, workspace_id, conversation_id, channel_id, direction, sender, content, delivery_status) values
  ('32000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-00000000000a',
   '22000000-0000-0000-0000-00000000000a', 'inbound', 'customer', 'hello', 'received');
insert into public.message_attachments (workspace_id, message_id, storage_path, mime_type, size_bytes) values
  ('10000000-0000-0000-0000-00000000000a', '32000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a/x.png', 'image/png', 1);
insert into public.handoffs (workspace_id, conversation_id, requested_by) values
  ('10000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-00000000000a', 'customer');
insert into public.kb_sources (id, workspace_id, type, title) values
  ('33000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'manual', 'Notes'),
  ('33000000-0000-0000-0000-00000000001a', '10000000-0000-0000-0000-00000000000a', 'faq', 'FAQ');
insert into public.kb_documents (id, workspace_id, source_id, body) values
  ('34000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '33000000-0000-0000-0000-00000000000a', 'manual note');
insert into public.faqs (workspace_id, source_id, question, answer) values
  ('10000000-0000-0000-0000-00000000000a', '33000000-0000-0000-0000-00000000001a', 'Parking?', 'Yes');
insert into public.kb_chunks (workspace_id, source_id, source_type, chunk_index, content) values
  ('10000000-0000-0000-0000-00000000000a', '33000000-0000-0000-0000-00000000001a', 'faq', 0, 'Parking? Yes');
insert into public.catalog_categories (id, workspace_id, name) values
  ('35000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '{"en":"Food"}');
insert into public.catalog_items (id, workspace_id, category_id, name, price_cents) values
  ('36000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '35000000-0000-0000-0000-00000000000a', '{"en":"Burger"}', 1000);
insert into public.knowledge_gaps (workspace_id, question) values ('10000000-0000-0000-0000-00000000000a', 'Do you deliver at night?');
insert into public.orders (id, workspace_id, customer_id, source, currency, subtotal_cents, total_cents) values
  ('37000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'ai', 'SAR', 1000, 1000);
insert into public.order_items (workspace_id, order_id, catalog_item_id, name_snapshot, quantity, unit_price_cents, line_total_cents) values
  ('10000000-0000-0000-0000-00000000000a', '37000000-0000-0000-0000-00000000000a', '36000000-0000-0000-0000-00000000000a', '{"en":"Burger"}', 1, 1000, 1000);
insert into public.reservations (workspace_id, customer_id, source, party_size, reserved_at) values
  ('10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'ai', 2, now() + interval '1 day');
insert into public.ai_runs (id, workspace_id, bot_id, conversation_id, trigger_message_id, provider, model) values
  ('38000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a',
   '31000000-0000-0000-0000-00000000000a', '32000000-0000-0000-0000-00000000000a', 'anthropic', 'claude-haiku-5-5');
insert into public.question_classifications (message_id, workspace_id, category) values
  ('32000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'prices');
insert into public.analytics_events (workspace_id, event_type) values ('10000000-0000-0000-0000-00000000000a', 'message.inbound');
insert into public.analytics_daily (workspace_id, date) values ('10000000-0000-0000-0000-00000000000a', current_date);
insert into public.bot_test_cases (id, workspace_id, bot_id, question) values
  ('3c000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'When do you open?');
insert into public.bot_tests (id, workspace_id, bot_id, bot_config_id) values
  ('3b000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '21000000-0000-0000-0000-00000000000a');
insert into public.bot_test_results (workspace_id, bot_test_id, test_case_id, question, passed) values
  ('10000000-0000-0000-0000-00000000000a', '3b000000-0000-0000-0000-00000000000a', '3c000000-0000-0000-0000-00000000000a', 'When do you open?', true);
insert into public.workspace_entitlement_overrides (workspace_id, key, value, reason) values
  ('10000000-0000-0000-0000-00000000000a', 'widget_remove_branding', 'true', 'matrix fixture');
insert into public.billing_customers (workspace_id, provider, provider_customer_id) values
  ('10000000-0000-0000-0000-00000000000a', 'paypal', 'PAYER-MATRIX');
insert into public.payment_transactions (id, workspace_id, subscription_id, type, status, provider, amount_cents, currency) values
  ('3a000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '3d000000-0000-0000-0000-00000000000a',
   'subscription_payment', 'completed', 'manual', 29900, 'USD');
insert into public.manual_payment_requests (workspace_id, requested_by, plan_id, contact_name, contact_email)
  select '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', id, 'n', 'n@test.local'
  from public.plans where code = 'growth';
insert into public.usage_periods (id, workspace_id, subscription_id, period_start, period_end) values
  ('39000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '3d000000-0000-0000-0000-00000000000a',
   now() - interval '1 day', now() + interval '29 days');
insert into public.usage_alerts (usage_period_id, workspace_id, threshold_pct) values
  ('39000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 80);
insert into public.usage_events (workspace_id, usage_period_id, kind, quantity, idempotency_key) values
  ('10000000-0000-0000-0000-00000000000a', '39000000-0000-0000-0000-00000000000a', 'ai_reply_reserved', 1, 'matrix-k1');
insert into public.billing_events (workspace_id, subscription_id, event_type, to_status, source, actor_type) values
  ('10000000-0000-0000-0000-00000000000a', '3d000000-0000-0000-0000-00000000000a', 'subscription.status_changed', 'active', 'system', 'system');
insert into public.invoices_records (workspace_id, usage_period_id, amount_cents) values
  ('10000000-0000-0000-0000-00000000000a', '39000000-0000-0000-0000-00000000000a', 1000);
insert into public.jobs (workspace_id, type) values ('10000000-0000-0000-0000-00000000000a', 'ai_reply');
insert into public.webhook_events (provider, event_id, event_type, workspace_id, signature_valid, payload) values
  ('paypal', 'EV-MATRIX-1', 'TEST', '10000000-0000-0000-0000-00000000000a', true, '{}'),
  ('meta', 'EV-MATRIX-2', 'messages', '10000000-0000-0000-0000-00000000000a', true, '{"text":"hello"}');
insert into public.platform_events (event_type, workspace_id) values ('workspace.created', '10000000-0000-0000-0000-00000000000a');
insert into public.internal_notes (workspace_id, entity_type, entity_id, body, author_id) values
  ('10000000-0000-0000-0000-00000000000a', 'workspace', '10000000-0000-0000-0000-00000000000a', 'admin only', '00000000-0000-0000-0000-0000000000a1');
insert into public.audit_logs (workspace_id, actor_type, actor_id, action) values
  ('10000000-0000-0000-0000-00000000000a', 'user', '00000000-0000-0000-0000-0000000000a1', 'member.role_change');
insert into public.api_keys (workspace_id, name, key_prefix, key_hash) values
  ('10000000-0000-0000-0000-00000000000a', 'k', 'sk_test', 'hash-matrix-key');
insert into public.data_requests (workspace_id, kind, requested_by) values
  ('10000000-0000-0000-0000-00000000000a', 'export', '00000000-0000-0000-0000-0000000000a1');
insert into public.notifications (workspace_id, user_id, type, title) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'handoff.requested', '{"ar":"تحويل","en":"Handoff"}');
insert into public.feature_flags (key, scope, workspace_id, enabled) values
  ('meta_embedded_signup', 'workspace', '10000000-0000-0000-0000-00000000000a', true);

-- ---------------------------------------------------------------------------
-- Expected matrix. key = column holding the workspace id; upd = column used for the no-op
-- update (`set c = c`); ins = insert statement ({ws}, {uid} placeholders) when the generic
-- `insert (workspace_id) values ({ws})` does not fit.
-- ---------------------------------------------------------------------------
create temp table m (
  t   text primary key,
  key text not null default 'workspace_id',
  upd text not null default 'workspace_id',
  ins text,
  s   text not null,
  i   text not null,
  u   text not null,
  d   text not null
);
grant select on m to public;
insert into m (t, key, upd, ins, s, i, u, d) values
  ('workspaces',                      'id',           'name',          $$insert into public.workspaces (name, slug) values ('x', 'ws-matrix-x')$$, 'oagv', '', 'oa', ''),
  ('workspace_members',               'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('workspace_invitations',           'workspace_id', 'workspace_id',  null, 'oa', '', '', ''),
  ('workspace_onboarding',            'workspace_id', 'current_step',  null, 'oagv', 'oa', 'oa', ''),
  ('branches',                        'workspace_id', 'name',          null, 'oagv', 'oa', 'oa', 'oa'),
  ('business_profiles',               'workspace_id', 'tone',          null, 'oagv', 'oa', 'oa', 'oa'),
  ('working_hours',                   'workspace_id', 'weekday',       null, 'oagv', 'oa', 'oa', 'oa'),
  ('working_hours_overrides',         'workspace_id', 'date',          null, 'oagv', 'oa', 'oa', 'oa'),
  ('policies',                        'workspace_id', 'sort_order',    null, 'oagv', 'oa', 'oa', 'oa'),
  ('bots',                            'workspace_id', 'name',          null, 'oagv', 'oa', 'oa', ''),
  ('bot_configs',                     'workspace_id', 'workspace_id',  null, 'oagv', 'oa', '', ''),
  ('channels',                        'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('channel_credentials',             'workspace_id', 'workspace_id',  null, '', '', '', ''),
  ('channel_connection_requests',     'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('channel_connection_events',       'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('widget_settings',                 'workspace_id', 'theme',         null, 'oagv', '', 'oa', ''),
  ('whatsapp_templates',              'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('customers',                       'workspace_id', 'tags',          null, 'oagv', '', 'oag', ''),
  ('customer_identities',             'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('customer_notes',                  'workspace_id', 'body',
     $$insert into public.customer_notes (workspace_id, customer_id, author_id, body) values ({ws}, '30000000-0000-0000-0000-00000000000a', {uid}, 'n')$$,
     'oagv', 'oag', 'o', 'o'),
  ('conversations',                   'workspace_id', 'handler',       null, 'oagv', '', 'oag', ''),
  ('conversation_notes',              'workspace_id', 'body',
     $$insert into public.conversation_notes (workspace_id, conversation_id, author_id, body) values ({ws}, '31000000-0000-0000-0000-00000000000a', {uid}, 'n')$$,
     'oagv', 'oag', 'o', 'o'),
  ('messages',                        'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('message_attachments',             'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('handoffs',                        'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('kb_sources',                      'workspace_id', 'title',
     $$insert into public.kb_sources (workspace_id, type, title) values ({ws}, 'faq', 'x')$$, 'oagv', 'oa', 'oa', 'oa'),
  ('kb_documents',                    'workspace_id', 'title',
     $$insert into public.kb_documents (workspace_id, source_id, body) values ({ws}, '33000000-0000-0000-0000-00000000000a', 'n')$$,
     'oagv', 'oa', 'oa', 'oa'),
  ('faqs',                            'workspace_id', 'answer',        null, 'oagv', 'oa', 'oa', 'oa'),
  ('kb_chunks',                       'workspace_id', 'workspace_id',  null, '', '', '', ''),
  ('catalog_categories',              'workspace_id', 'sort_order',    null, 'oagv', 'oa', 'oa', 'oa'),
  ('catalog_items',                   'workspace_id', 'price_cents',   null, 'oagv', 'oa', 'oa', 'oa'),
  ('knowledge_gaps',                  'workspace_id', 'status',        null, 'oagv', '', 'oa', ''),
  ('orders',                          'workspace_id', 'status',        null, 'oagv', '', 'oag', ''),
  ('order_items',                     'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('reservations',                    'workspace_id', 'status',        null, 'oagv', '', 'oag', ''),
  ('ai_runs',                         'workspace_id', 'workspace_id',  null, 'oa', '', '', ''),
  ('question_classifications',        'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('analytics_events',                'workspace_id', 'workspace_id',  null, '', '', '', ''),
  ('analytics_daily',                 'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('bot_test_cases',                  'workspace_id', 'question',      null, 'oagv', 'oa', 'oa', 'oa'),
  ('bot_tests',                       'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('bot_test_results',                'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('workspace_entitlement_overrides', 'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('subscriptions',                   'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('billing_customers',               'workspace_id', 'workspace_id',  null, 'o', '', '', ''),
  ('payment_transactions',            'workspace_id', 'workspace_id',  null, 'oa', '', '', ''),
  ('manual_payment_requests',         'workspace_id', 'workspace_id',  null, 'oa', '', '', ''),
  ('usage_periods',                   'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('usage_alerts',                    'workspace_id', 'workspace_id',  null, 'oagv', '', '', ''),
  ('usage_events',                    'workspace_id', 'workspace_id',  null, '', '', '', ''),
  ('billing_events',                  'workspace_id', 'workspace_id',  null, 'oa', '', '', ''),
  ('invoices_records',                'workspace_id', 'workspace_id',  null, 'oa', '', '', ''),
  ('jobs',                            'workspace_id', 'workspace_id',  null, '', '', '', ''),
  ('webhook_events',                  'workspace_id', 'workspace_id',  null, '', '', '', ''),
  ('platform_events',                 'workspace_id', 'workspace_id',  null, '', '', '', ''),
  ('internal_notes',                  'workspace_id', 'workspace_id',  null, '', '', '', ''),
  ('audit_logs',                      'workspace_id', 'workspace_id',  null, 'oa', '', '', ''),
  ('api_keys',                        'workspace_id', 'workspace_id',  null, 'oa', '', '', ''),
  ('data_requests',                   'workspace_id', 'workspace_id',  null, 'o', '', '', ''),
  ('notifications',                   'workspace_id', 'read_at',       null, 'o', '', 'o', ''),
  ('feature_flags',                   'workspace_id', 'workspace_id',  null, 'oagv', '', '', '');

-- ---------------------------------------------------------------------------
-- Run every attempt as every role.
-- ---------------------------------------------------------------------------
create temp table r (t text, op text, who text, outcome text);
grant insert, select on r to public;

do $$
declare
  w   record;
  q   record;
  ws  constant text := '10000000-0000-0000-0000-00000000000a';
  ins text;
begin
  for w in
    select * from (values
      ('o', 'authenticated', '00000000-0000-0000-0000-0000000000a1'),
      ('a', 'authenticated', '00000000-0000-0000-0000-0000000000a2'),
      ('g', 'authenticated', '00000000-0000-0000-0000-0000000000a3'),
      ('v', 'authenticated', '00000000-0000-0000-0000-0000000000a4'),
      ('x', 'authenticated', '00000000-0000-0000-0000-0000000000b1'),
      ('n', 'anon', null)) as t(who, role_name, uid)
  loop
    perform set_config('request.jwt.claim.sub', coalesce(w.uid, ''), true);
    perform set_config('request.jwt.claims',
      case when w.uid is null then '{"role":"anon"}'
           else json_build_object('sub', w.uid, 'role', 'authenticated')::text end, true);
    execute format('set local role %I', w.role_name);
    for q in select * from pg_temp.m loop
      ins := coalesce(
        replace(replace(q.ins, '{ws}', quote_literal(ws)), '{uid}', coalesce(quote_literal(w.uid), 'null')),
        format('insert into public.%I (workspace_id) values (%L)', q.t, ws));
      insert into pg_temp.r values
        (q.t, 's', w.who, test_helpers.attempt(format('select 1 from public.%I where %I = %L', q.t, q.key, ws))),
        (q.t, 'i', w.who, test_helpers.attempt(ins)),
        (q.t, 'u', w.who, test_helpers.attempt(format('update public.%I set %I = %I where %I = %L', q.t, q.upd, q.upd, q.key, ws))),
        (q.t, 'd', w.who, test_helpers.attempt(format('delete from public.%I where %I = %L', q.t, q.key, ws)));
    end loop;
    reset role;
  end loop;
end $$;

select plan((select count(*)::int * 4 from m) + 37);

-- Coverage: every table with a workspace_id column (plus workspaces) is in the matrix.
select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
       and (exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'workspace_id')
            or c.relname = 'workspaces')
       and c.relname not in (select t from pg_temp.m) $$,
  'role matrix covers every tenant table');

select is(
  coalesce((
    select string_agg(x.letter, '' order by position(x.who in 'oagvxn'))
    from (
      select r.who,
             case
               when r.outcome like 'rows:%' then case when substr(r.outcome, 6)::bigint > 0 then r.who end
               when r.outcome = 'error:42501' then null
               when e.op = 'i' then r.who
               else '!' || r.who || '(' || r.outcome || ')'
             end as letter
      from pg_temp.r r
      where r.t = e.t and r.op = e.op
    ) x where x.letter is not null), ''),
  e.expected,
  format('%s %s: allowed roles', e.t, case e.op when 's' then 'select' when 'i' then 'insert'
                                              when 'u' then 'update' else 'delete' end))
from (
  select m.t, o.op, o.ord,
         case o.op when 's' then m.s when 'i' then m.i when 'u' then m.u else m.d end as expected
  from m cross join (values ('s', 1), ('i', 2), ('u', 3), ('d', 4)) as o(op, ord)
  order by m.t, o.ord
  offset 0
) e;

-- Another tenant's limits never leak: security checks run before plan checks (0013).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(test_helpers.attempt($$ insert into public.bots (workspace_id, name) values ('10000000-0000-0000-0000-00000000000c', 'x') $$),
  'error:42501', 'outsider at another tenant''s bot limit gets 42501, not plan_limit');
select is(test_helpers.attempt($$ insert into public.bots (workspace_id, name, handoff_enabled) values ('10000000-0000-0000-0000-00000000000c', 'x', true) $$),
  'error:42501', 'outsider probing a feature gets 42501, not plan_feature');
select is(test_helpers.attempt($$ insert into public.branches (workspace_id, name) values ('10000000-0000-0000-0000-00000000000c', '{"en":"x"}') $$),
  'error:42501', 'outsider probing branches gets 42501');
reset role;

-- Platform tables: no client writes at all.
create temp table pm (t text primary key, c text not null) on commit drop;
grant select on pm to public;
insert into pm values ('platform_admins', 'role'), ('plans', 'sort_order'), ('plan_prices', 'amount_cents'),
  ('plan_entitlements', 'value'), ('entitlement_definitions', 'description'), ('one_time_products', 'amount_cents'),
  ('provider_price_refs', 'external_id'), ('ai_model_profiles', 'effort'), ('ai_model_prices', 'source_note'),
  ('platform_settings', 'description');
create temp table pr (t text, who text, op text, outcome text);
grant insert, select on pr to public;
do $$
declare
  w record;
  q record;
begin
  for w in select * from (values ('o', 'authenticated', '00000000-0000-0000-0000-0000000000a1'), ('n', 'anon', null)) as t(who, role_name, uid) loop
    perform set_config('request.jwt.claims',
      case when w.uid is null then '{"role":"anon"}' else json_build_object('sub', w.uid, 'role', 'authenticated')::text end, true);
    execute format('set local role %I', w.role_name);
    for q in select * from pg_temp.pm loop
      insert into pg_temp.pr values
        (q.t, w.who, 'i', test_helpers.attempt(format('insert into public.%I default values', q.t))),
        (q.t, w.who, 'u', test_helpers.attempt(format('update public.%I set %I = %I', q.t, q.c, q.c))),
        (q.t, w.who, 'd', test_helpers.attempt(format('delete from public.%I', q.t)));
    end loop;
    reset role;
  end loop;
end $$;
select is(
  coalesce((select string_agg(r.who || r.op || '=' || r.outcome, ', ') from pg_temp.pr r
            where r.t = p.t and not (r.outcome = 'error:42501' or r.outcome = 'rows:0')), ''),
  '', p.t || ': no client insert / update / delete')
from (select t from pm order by t offset 0) p;

-- File knowledge sources are removed through `api` only (storage cleanup).
insert into public.kb_sources (id, workspace_id, type, title) values
  ('33000000-0000-0000-0000-00000000002a', '10000000-0000-0000-0000-00000000000a', 'file', 'Menu PDF');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(test_helpers.attempt($$ delete from public.kb_sources where id = '33000000-0000-0000-0000-00000000002a' $$),
  'rows:0', 'owner cannot delete a file source directly');
reset role;

-- profiles: you see yourself and teammates; you edit only yourself.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles), 4, 'profiles: owner sees self + 3 teammates, not other tenants');
select is(test_helpers.attempt($$ update public.profiles set full_name = 'x' where id = '00000000-0000-0000-0000-0000000000a2' $$),
  'rows:0', 'profiles: cannot edit a teammate');
select is(test_helpers.attempt($$ update public.profiles set full_name = 'Owner A2' where id = '00000000-0000-0000-0000-0000000000a1' $$),
  'rows:1', 'profiles: can edit own profile');
reset role;

-- A read-only workspace (trial ended / unpaid) blocks writes but keeps reads.
update public.workspaces set status = 'read_only' where id = '10000000-0000-0000-0000-00000000000a';
set local role authenticated;
select is(test_helpers.attempt($$ update public.bots set name = 'n' where workspace_id = '10000000-0000-0000-0000-00000000000a' $$),
  'rows:0', 'read-only workspace: owner cannot update bots');
select is(test_helpers.attempt($$ insert into public.faqs (workspace_id, source_id, question, answer)
    values ('10000000-0000-0000-0000-00000000000a', '33000000-0000-0000-0000-00000000001a', 'q', 'a') $$),
  'error:42501', 'read-only workspace: owner cannot add FAQs');
select is((select count(*)::int from public.bots), 1, 'read-only workspace: data stays readable');
reset role;

-- Workspace deletion (C10 + owner decision F1): soft delete keeps only the billing records,
-- detached from tenant content, until the retention period ends; then the tombstone goes.
create function test_helpers.rows_for_workspace(p_ws uuid, p_except text[] default '{}') returns bigint
language plpgsql set search_path = '' as $$
declare
  r record;
  n bigint;
  total bigint := 0;
begin
  for r in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
           join pg_attribute a on a.attrelid = c.oid and a.attname = 'workspace_id'
           where s.nspname = 'public' and c.relkind in ('r', 'p') and not (c.relname = any (p_except)) loop
    execute format('select count(*) from public.%I where workspace_id = $1', r.relname) into n using p_ws;
    total := total + n;
  end loop;
  return total;
end $$;
create temp table retained(t text) on commit drop;
insert into retained values ('billing_events'), ('payment_transactions'), ('invoices_records'), ('audit_logs'),
  ('webhook_events');
select cmp_ok(test_helpers.rows_for_workspace('10000000-0000-0000-0000-00000000000a'), '>', 60::bigint,
  'fixture workspace has rows across the tenant tables');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(test_helpers.attempt($$ select public.soft_delete_workspace('10000000-0000-0000-0000-00000000000a') $$),
  'error:42501', 'clients cannot call soft_delete_workspace');
reset role;

select is(public.soft_delete_workspace('10000000-0000-0000-0000-00000000000a') ->> 'status', 'deleted',
  'soft_delete_workspace deletes the workspace');
select results_eq(
  $$ select name, deleted_at is not null, status::text, logo_path is null,
            retained_billing_identity ->> 'slug', purge_after::date
     from public.workspaces where id = '10000000-0000-0000-0000-00000000000a' $$,
  $$ values ('Deleted workspace'::text, true, 'pending_deletion'::text, true, 'ws-matrix-a'::text,
             (now() + interval '1825 days')::date) $$,
  'tombstone: anonymized, deleted, retained identity, purge after 5 years (setting)');
select is(test_helpers.rows_for_workspace('10000000-0000-0000-0000-00000000000a', array(select t from pg_temp.retained)),
  0::bigint, 'every tenant table except the retained billing records is purged');
select results_eq(
  $$ select (select count(*)::int from public.payment_transactions where workspace_id = '10000000-0000-0000-0000-00000000000a'),
            (select count(*)::int from public.billing_events where workspace_id = '10000000-0000-0000-0000-00000000000a'),
            (select count(*)::int from public.invoices_records where workspace_id = '10000000-0000-0000-0000-00000000000a') $$,
  $$ values (1, 1, 1) $$, 'billing_events, payment_transactions and invoices_records are kept');
select results_eq(
  $$ select (select subscription_id is null from public.payment_transactions where workspace_id = '10000000-0000-0000-0000-00000000000a'),
            (select subscription_id is null from public.billing_events where workspace_id = '10000000-0000-0000-0000-00000000000a'),
            (select usage_period_id is null and period_start is not null and period_end is not null
               from public.invoices_records where workspace_id = '10000000-0000-0000-0000-00000000000a') $$,
  $$ values (true, true, true) $$, 'retained billing records are detached (invoice period kept as a snapshot)');
select results_eq(
  $$ select provider::text, count(*)::int from public.webhook_events
     where workspace_id = '10000000-0000-0000-0000-00000000000a' group by provider $$,
  $$ values ('paypal'::text, 1) $$, 'channel webhook payloads are purged; PayPal events stay as billing evidence');
select is((select count(*)::int from vault.decrypted_secrets where decrypted_secret = 'matrix-test-token'), 0,
  'the channel token is removed from Vault');
select ok(exists (select 1 from public.audit_logs where action = 'workspace.soft_deleted'
                  and entity_id = '10000000-0000-0000-0000-00000000000a'), 'the deletion is audit-logged');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.payment_transactions), 0,
  'former members can no longer read the retained billing records');
reset role;
select is(public.soft_delete_workspace('10000000-0000-0000-0000-00000000000a') ->> 'status', 'already_deleted',
  'soft delete is idempotent');
select is(public.purge_deleted_workspaces(), 0, 'nothing is purged before the retention period ends');
update public.workspaces set purge_after = now() - interval '1 second' where id = '10000000-0000-0000-0000-00000000000a';
select is(public.purge_deleted_workspaces(), 1, 'the tombstone is purged after the retention period');
select is(test_helpers.rows_for_workspace('10000000-0000-0000-0000-00000000000a'), 0::bigint,
  'retained billing records are removed with the tombstone');
select ok(exists (select 1 from public.audit_logs where action = 'workspace.soft_deleted' and workspace_id is null),
  'audit rows survive the final purge, detached');

select * from finish();
rollback;
