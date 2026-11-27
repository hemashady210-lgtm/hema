-- =============================================================================
-- Local demo data for `supabase db reset` / `supabase db start` (and CI) only.
-- Never applied to the dev or production project (owner decision, P2).
-- Reference data (plans, entitlements, model profiles, feature flags) is seeded by
-- migrations. Fixed ids use the `d…` prefix so they never collide with pgTAP fixtures.
--
-- Demo users have no auth.identities row and a random password nobody knows, so they cannot
-- sign in: sign-in for seeded users is set up in P3 with auth (GoTrue identity schema = needs
-- verification).
-- =============================================================================

-- Guard: only seed a fresh local database (never a project that already has users).
do $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'seed.sql only runs on an empty local database (auth.users is not empty)';
  end if;
end
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'owner@demo.local', extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Owner"}', now(), now()),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'agent@demo.local', extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Agent"}', now(), now());

insert into public.profiles (id, full_name, locale) values
  ('d0000000-0000-0000-0000-000000000001', 'Demo Owner', 'ar'),
  ('d0000000-0000-0000-0000-000000000002', 'Demo Agent', 'en')
-- The auth.users trigger (0015) already created both rows; keep the demo locales.
on conflict (id) do update set full_name = excluded.full_name, locale = excluded.locale;

insert into public.workspaces (id, name, slug, default_locale, timezone, country_code, category, created_by) values
  ('d1000000-0000-0000-0000-000000000001', 'Al Diwan Restaurant', 'demo-diwan', 'ar', 'Asia/Riyadh', 'SA', 'restaurant',
   'd0000000-0000-0000-0000-000000000001');

insert into public.subscriptions (workspace_id, plan_id, plan_price_id, status, provider, billing_interval, current_period_start, current_period_end)
select 'd1000000-0000-0000-0000-000000000001', p.id, pp.id, 'active', 'manual', 'month', now(), now() + interval '1 month'
from public.plans p join public.plan_prices pp on pp.plan_id = p.id and pp.interval = 'month'
where p.code = 'growth';

insert into public.workspace_members (workspace_id, user_id, role) values
  ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'owner'),
  ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'agent');

insert into public.workspace_onboarding (workspace_id, current_step, completed_steps) values
  ('d1000000-0000-0000-0000-000000000001', 'files',
   array['business_basics', 'category', 'branches', 'working_hours', 'contact', 'catalog', 'faqs', 'policies', 'ai_instructions']);

insert into public.business_profiles (workspace_id, display_name, description, phone, email, website, address, social_links,
                                      custom_ai_instructions, tone) values
  ('d1000000-0000-0000-0000-000000000001',
   '{"ar":"مطعم الديوان","en":"Al Diwan Restaurant"}',
   '{"ar":"مطعم سعودي تقليدي يقدم المندي والكبسة.","en":"Traditional Saudi restaurant serving mandi and kabsa."}',
   '+966500000000', 'hello@diwan.example', 'https://diwan.example',
   '{"ar":"الرياض، حي العليا","en":"Olaya, Riyadh"}',
   '{"instagram":"https://instagram.com/diwan.example"}',
   'Always mention that family seating is available.', 'friendly');

-- Sun–Thu 12:00–23:00, Fri 13:00–01:00 (past midnight), Sat closed.
insert into public.working_hours (workspace_id, weekday, is_closed, open_time, close_time)
select 'd1000000-0000-0000-0000-000000000001', d, false, '12:00', '23:00' from generate_series(0, 4) d;
insert into public.working_hours (workspace_id, weekday, is_closed, open_time, close_time) values
  ('d1000000-0000-0000-0000-000000000001', 5, false, '13:00', '01:00'),
  ('d1000000-0000-0000-0000-000000000001', 6, true, null, null);
insert into public.working_hours_overrides (workspace_id, date, is_closed, note) values
  ('d1000000-0000-0000-0000-000000000001', '2026-12-31', true, '{"ar":"مغلق لليلة رأس السنة","en":"Closed for New Year''s Eve"}');

insert into public.policies (workspace_id, type, title, content) values
  ('d1000000-0000-0000-0000-000000000001', 'delivery', '{"ar":"التوصيل","en":"Delivery"}',
   '{"ar":"التوصيل داخل الرياض خلال 45 دقيقة. رسوم التوصيل 10 ريال.","en":"Delivery within Riyadh in 45 minutes. Delivery fee 10 SAR."}'),
  ('d1000000-0000-0000-0000-000000000001', 'refund', '{"ar":"الاسترجاع","en":"Refunds"}',
   '{"ar":"يمكن استرجاع الطلب خلال 30 دقيقة من التأكيد.","en":"Orders can be refunded within 30 minutes of confirmation."}');

insert into public.kb_sources (id, workspace_id, type, title, status) values
  ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'profile', 'Business profile', 'pending'),
  ('d2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'faq', 'FAQ', 'pending'),
  ('d2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'catalog', 'Menu', 'pending'),
  ('d2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', 'policy', 'Policies', 'pending');

insert into public.faqs (workspace_id, source_id, question, answer, language, alt_questions, tags) values
  ('d1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'هل يوجد مواقف سيارات؟',
   'نعم، يوجد موقف مجاني خلف المطعم.', 'ar', array['فيه مواقف؟', 'وين أوقف السيارة؟'], array['parking']),
  ('d1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'Do you have family seating?',
   'Yes, we have private family sections.', 'en', '{}', array['seating']);

insert into public.catalog_categories (id, workspace_id, name, sort_order) values
  ('d3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', '{"ar":"الأطباق الرئيسية","en":"Main dishes"}', 1),
  ('d3000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', '{"ar":"المشروبات","en":"Drinks"}', 2);
insert into public.catalog_items (workspace_id, category_id, sku, name, description, price_cents, currency, attributes) values
  ('d1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'MANDI-L', '{"ar":"مندي لحم","en":"Lamb mandi"}',
   '{"ar":"نصف كيلو لحم مع أرز","en":"Half kilo lamb with rice"}', 6500, 'SAR', '{"serves":2}'),
  ('d1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'KABSA-C', '{"ar":"كبسة دجاج","en":"Chicken kabsa"}',
   null, 3500, 'SAR', '{}'),
  ('d1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000002', 'LABAN', '{"ar":"لبن","en":"Laban"}', null, 500, 'SAR', '{}');

insert into public.bots (id, workspace_id, name, language_mode, default_language) values
  ('d4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Diwan Assistant', 'auto', 'ar');
insert into public.bot_configs (id, workspace_id, bot_id, persona, greeting, handoff_rules, change_note) values
  ('d4100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001',
   'A warm host who answers briefly.', '{"ar":"أهلاً بك في مطعم الديوان! كيف أقدر أساعدك؟","en":"Welcome to Al Diwan! How can I help?"}',
   '{"on_request":true,"on_complaint":true}', 'Initial version');
update public.bots set active_config_id = 'd4100000-0000-0000-0000-000000000001'
 where id = 'd4000000-0000-0000-0000-000000000001';

insert into public.channels (id, workspace_id, bot_id, channel_type, status, connection_mode, display_name, connected_at) values
  ('d5000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001',
   'widget', 'connected', 'automatic', 'Website', now());
insert into public.widget_settings (channel_id, workspace_id, allowed_origins, launcher_text) values
  ('d5000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
   array['http://localhost:5173'], '{"ar":"تحدث معنا","en":"Chat with us"}');

insert into public.customers (id, workspace_id, display_name, locale) values
  ('d6000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'زائر', 'ar');
insert into public.customer_identities (workspace_id, customer_id, channel_type, external_user_id) values
  ('d1000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001', 'widget', 'demo-visitor-1');
insert into public.conversations (id, workspace_id, bot_id, channel_id, customer_id, language, dialect) values
  ('d7000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001',
   'd5000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001', 'ar', 'gulf');
insert into public.messages (id, workspace_id, conversation_id, channel_id, direction, sender, content, language, delivery_status, created_at) values
  ('d8000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001',
   'd5000000-0000-0000-0000-000000000001', 'inbound', 'customer', 'كم سعر المندي؟', 'ar', 'received', now() - interval '2 minutes'),
  ('d8000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001',
   'd5000000-0000-0000-0000-000000000001', 'outbound', 'ai', 'سعر مندي اللحم 65 ريال ويكفي شخصين.', 'ar', 'delivered', now() - interval '1 minute');
insert into public.question_classifications (message_id, workspace_id, category, language, dialect, confidence) values
  ('d8000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'prices', 'ar', 'gulf', 0.93);
