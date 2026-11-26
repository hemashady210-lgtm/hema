-- pgTAP: structural tenant isolation. Composite foreign keys (workspace_id, id) make it
-- impossible for a row of workspace A to reference a row of workspace B, whatever role
-- writes it (including the service role used by edge functions). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'a5@test.local'),
  ('00000000-0000-0000-0000-0000000005b1', 'b5@test.local');
insert into public.workspaces (id, name, slug) values
  ('10000000-0000-0000-0000-0000000005aa', 'A5', 'ws-xref-a'),
  ('10000000-0000-0000-0000-0000000005bb', 'B5', 'ws-xref-b');
insert into public.subscriptions (workspace_id, plan_id, status, provider, billing_interval, current_period_start)
  select w, p.id, 'active', 'manual', 'month', now()
  from public.plans p, unnest(array['10000000-0000-0000-0000-0000000005aa',
                                    '10000000-0000-0000-0000-0000000005bb']::uuid[]) w
  where p.code = 'enterprise';
insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000005aa', '00000000-0000-0000-0000-0000000005a1', 'owner'),
  ('10000000-0000-0000-0000-0000000005bb', '00000000-0000-0000-0000-0000000005b1', 'owner');
insert into public.bots (id, workspace_id, name) values
  ('20000000-0000-0000-0000-0000000005aa', '10000000-0000-0000-0000-0000000005aa', 'A bot 1'),
  ('20000000-0000-0000-0000-0000000005ab', '10000000-0000-0000-0000-0000000005aa', 'A bot 2'),
  ('20000000-0000-0000-0000-0000000005bb', '10000000-0000-0000-0000-0000000005bb', 'B bot');
insert into public.bot_configs (id, workspace_id, bot_id) values
  ('21000000-0000-0000-0000-0000000005ab', '10000000-0000-0000-0000-0000000005aa', '20000000-0000-0000-0000-0000000005ab');
insert into public.channels (id, workspace_id, bot_id, channel_type, status, connection_mode) values
  ('22000000-0000-0000-0000-0000000005aa', '10000000-0000-0000-0000-0000000005aa', '20000000-0000-0000-0000-0000000005aa', 'widget', 'connected', 'automatic'),
  ('22000000-0000-0000-0000-0000000005bb', '10000000-0000-0000-0000-0000000005bb', '20000000-0000-0000-0000-0000000005bb', 'widget', 'connected', 'automatic'),
  ('22000000-0000-0000-0000-0000000005bc', '10000000-0000-0000-0000-0000000005bb', '20000000-0000-0000-0000-0000000005bb', 'messenger', 'pending', 'manual');
insert into public.customers (id, workspace_id) values
  ('30000000-0000-0000-0000-0000000005aa', '10000000-0000-0000-0000-0000000005aa'),
  ('30000000-0000-0000-0000-0000000005bb', '10000000-0000-0000-0000-0000000005bb');
insert into public.conversations (id, workspace_id, bot_id, channel_id, customer_id) values
  ('31000000-0000-0000-0000-0000000005aa', '10000000-0000-0000-0000-0000000005aa', '20000000-0000-0000-0000-0000000005aa',
   '22000000-0000-0000-0000-0000000005aa', '30000000-0000-0000-0000-0000000005aa'),
  ('31000000-0000-0000-0000-0000000005bb', '10000000-0000-0000-0000-0000000005bb', '20000000-0000-0000-0000-0000000005bb',
   '22000000-0000-0000-0000-0000000005bb', '30000000-0000-0000-0000-0000000005bb');
insert into public.kb_sources (id, workspace_id, type, title) values
  ('33000000-0000-0000-0000-0000000005aa', '10000000-0000-0000-0000-0000000005aa', 'faq', 'A faq'),
  ('33000000-0000-0000-0000-0000000005bb', '10000000-0000-0000-0000-0000000005bb', 'faq', 'B faq'),
  ('33000000-0000-0000-0000-0000000005bc', '10000000-0000-0000-0000-0000000005bb', 'manual', 'B notes');
insert into public.kb_documents (id, workspace_id, source_id, body) values
  ('34000000-0000-0000-0000-0000000005bb', '10000000-0000-0000-0000-0000000005bb', '33000000-0000-0000-0000-0000000005bc', 'B note');
insert into public.catalog_items (id, workspace_id, name, price_cents) values
  ('36000000-0000-0000-0000-0000000005bb', '10000000-0000-0000-0000-0000000005bb', '{"en":"B item"}', 500);
insert into public.orders (id, workspace_id, customer_id, source, currency) values
  ('37000000-0000-0000-0000-0000000005aa', '10000000-0000-0000-0000-0000000005aa', '30000000-0000-0000-0000-0000000005aa', 'agent', 'SAR');
insert into public.usage_periods (id, workspace_id, period_start, period_end) values
  ('39000000-0000-0000-0000-0000000005bb', '10000000-0000-0000-0000-0000000005bb', now() - interval '1 day', now() + interval '29 days');

select throws_ok($$ insert into public.conversations (workspace_id, bot_id, channel_id, customer_id) values
  ('10000000-0000-0000-0000-0000000005aa', '20000000-0000-0000-0000-0000000005aa', '22000000-0000-0000-0000-0000000005aa',
   '30000000-0000-0000-0000-0000000005bb') $$, '23503', null, 'conversation cannot use another tenant''s customer');
select throws_ok($$ insert into public.conversations (workspace_id, bot_id, channel_id, customer_id) values
  ('10000000-0000-0000-0000-0000000005aa', '20000000-0000-0000-0000-0000000005aa', '22000000-0000-0000-0000-0000000005bb',
   '30000000-0000-0000-0000-0000000005aa') $$, '23503', null, 'conversation cannot use another tenant''s channel');
select throws_ok($$ insert into public.messages (workspace_id, conversation_id, channel_id, direction, sender, delivery_status) values
  ('10000000-0000-0000-0000-0000000005aa', '31000000-0000-0000-0000-0000000005bb', '22000000-0000-0000-0000-0000000005aa',
   'inbound', 'customer', 'received') $$, '23503', null, 'message cannot be added to another tenant''s conversation');
select throws_ok($$ insert into public.messages (workspace_id, conversation_id, channel_id, direction, sender, delivery_status, is_test) values
  ('10000000-0000-0000-0000-0000000005aa', '31000000-0000-0000-0000-0000000005aa', '22000000-0000-0000-0000-0000000005aa',
   'inbound', 'customer', 'received', true) $$, '23503', null, 'a test message cannot enter a live conversation');
select throws_ok($$ insert into public.orders (workspace_id, customer_id, source, currency) values
  ('10000000-0000-0000-0000-0000000005aa', '30000000-0000-0000-0000-0000000005bb', 'agent', 'SAR') $$,
  '23503', null, 'order cannot reference another tenant''s customer');
select throws_ok($$ insert into public.order_items (workspace_id, order_id, catalog_item_id, name_snapshot, quantity, unit_price_cents, line_total_cents) values
  ('10000000-0000-0000-0000-0000000005aa', '37000000-0000-0000-0000-0000000005aa', '36000000-0000-0000-0000-0000000005bb',
   '{"en":"x"}', 1, 500, 500) $$, '23503', null, 'order line cannot reference another tenant''s catalog item');
select throws_ok($$ insert into public.faqs (workspace_id, source_id, question, answer) values
  ('10000000-0000-0000-0000-0000000005aa', '33000000-0000-0000-0000-0000000005bb', 'q', 'a') $$,
  '23503', null, 'FAQ cannot attach to another tenant''s knowledge source');
select throws_ok($$ insert into public.kb_chunks (workspace_id, source_id, document_id, source_type, chunk_index, content) values
  ('10000000-0000-0000-0000-0000000005aa', '33000000-0000-0000-0000-0000000005aa', '34000000-0000-0000-0000-0000000005bb',
   'manual', 0, 'x') $$, '23503', null, 'chunk cannot reference another tenant''s document');
select throws_ok($$ insert into public.bot_configs (workspace_id, bot_id) values
  ('10000000-0000-0000-0000-0000000005aa', '20000000-0000-0000-0000-0000000005bb') $$,
  '23503', null, 'bot config cannot target another tenant''s bot');
select throws_ok($$ update public.bots set active_config_id = '21000000-0000-0000-0000-0000000005ab'
  where id = '20000000-0000-0000-0000-0000000005aa' $$, '23503', null, 'a bot cannot activate another bot''s config');
select throws_ok($$ insert into public.channel_credentials (workspace_id, channel_id, vault_secret_id) values
  ('10000000-0000-0000-0000-0000000005aa', '22000000-0000-0000-0000-0000000005bc', gen_random_uuid()) $$,
  '23514', null, 'credential cannot attach to another tenant''s channel');
select throws_ok($$ insert into public.widget_settings (channel_id, workspace_id) values
  ('22000000-0000-0000-0000-0000000005bb', '10000000-0000-0000-0000-0000000005aa') $$,
  '23503', null, 'widget settings cannot attach to another tenant''s channel');
select throws_ok($$ insert into public.ai_runs (workspace_id, conversation_id, provider, model) values
  ('10000000-0000-0000-0000-0000000005aa', '31000000-0000-0000-0000-0000000005bb', 'anthropic', 'm') $$,
  '23503', null, 'AI run cannot reference another tenant''s conversation');
select throws_ok($$ insert into public.usage_events (workspace_id, usage_period_id, kind, quantity, idempotency_key) values
  ('10000000-0000-0000-0000-0000000005aa', '39000000-0000-0000-0000-0000000005bb', 'ai_reply_reserved', 1, 'xref-1') $$,
  '23503', null, 'usage cannot be booked on another tenant''s period');
select throws_ok($$ insert into public.customer_notes (workspace_id, customer_id, author_id, body) values
  ('10000000-0000-0000-0000-0000000005aa', '30000000-0000-0000-0000-0000000005bb', '00000000-0000-0000-0000-0000000005a1', 'x') $$,
  '23503', null, 'note cannot attach to another tenant''s customer');
select throws_ok($$ insert into public.notifications (workspace_id, user_id, type, title) values
  ('10000000-0000-0000-0000-0000000005aa', '00000000-0000-0000-0000-0000000005b1', 'x.y', '{"en":"x"}') $$,
  '23503', null, 'notifications only go to members of the workspace');

-- Hybrid retrieval never crosses tenants.
insert into public.kb_chunks (workspace_id, source_id, source_type, chunk_index, content) values
  ('10000000-0000-0000-0000-0000000005aa', '33000000-0000-0000-0000-0000000005aa', 'faq', 0, 'free parking behind the shop'),
  ('10000000-0000-0000-0000-0000000005bb', '33000000-0000-0000-0000-0000000005bb', 'faq', 0, 'free parking behind the shop');
select is(
  (select count(*)::int from public.match_kb_chunks('10000000-0000-0000-0000-0000000005aa', '20000000-0000-0000-0000-0000000005aa',
     array_fill(0, array[1024])::extensions.vector, 'parking')),
  1, 'match_kb_chunks returns only the caller workspace''s chunks');
select is(
  (select bool_and(c.workspace_id = '10000000-0000-0000-0000-0000000005aa')
   from public.match_kb_chunks('10000000-0000-0000-0000-0000000005aa', '20000000-0000-0000-0000-0000000005aa',
     array_fill(0, array[1024])::extensions.vector, 'parking') m
   join public.kb_chunks c on c.id = m.id),
  true, 'every retrieved chunk belongs to the caller workspace');

select * from finish();
rollback;
