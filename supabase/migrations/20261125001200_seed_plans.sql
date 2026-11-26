-- =============================================================================
-- 0012 · Reference data: entitlement keys, plans, prices, one-time products,
--        model profiles, platform settings.
-- This is DATA, not code: Super Admin edits it afterwards (decision B). Idempotent.
-- PayPal plan ids (provider_price_refs) are inserted per environment in Phase 05.
-- =============================================================================

insert into public.entitlement_definitions (key, value_type, default_value, description) values
  ('ai_replies_per_period',     'integer',    '0',      'AI-generated replies included per usage period (null = unlimited)'),
  ('overage_enabled',           'boolean',    'false',  'Allow AI replies beyond the included amount (billed as overage). false = hard stop with upgrade prompt'),
  ('overage_unit_size',         'integer',    'null',   'Replies per overage unit'),
  ('overage_unit_price_cents',  'integer',    'null',   'Price per overage unit, USD cents'),
  ('max_bots',                  'integer',    '1',      'Maximum bots (null = unlimited)'),
  ('max_users',                 'integer',    '1',      'Maximum active workspace members (null = unlimited)'),
  ('max_meta_channels',         'integer',    '0',      'Maximum WhatsApp/Messenger/Instagram connections (null = unlimited)'),
  ('allowed_channel_types',     'text_array', '["widget"]', 'Channel types the plan may connect'),
  ('max_branches',              'integer',    '0',      'Maximum branches (null = unlimited)'),
  ('multi_branch',              'boolean',    'false',  'Branches feature'),
  ('analytics_level',           'text',       '"basic"', 'basic | advanced'),
  ('question_classification',   'boolean',    'false',  'Classify inbound questions for analytics'),
  ('orders',                    'boolean',    'false',  'AI/agent order taking'),
  ('reservations',              'boolean',    'false',  'AI/agent reservations'),
  ('human_handoff',             'boolean',    'false',  'Hand conversations to human agents'),
  ('api_access',                'boolean',    'false',  'Public REST API with API keys'),
  ('knowledge_file_max_mb',     'integer',    '10',     'Max size per uploaded knowledge file'),
  ('knowledge_files_max',       'integer',    '5',      'Max uploaded knowledge files (null = unlimited)'),
  ('data_retention_days',       'integer',    '365',    'Conversation retention (decision C10: default 12 months)'),
  ('widget_remove_branding',    'boolean',    'false',  'Hide "powered by" in the widget'),
  ('ai_model_profile',          'text',       '"standard"', 'ai_model_profiles.code used for generation')
on conflict (key) do nothing;

insert into public.plans (code, name, description, sort_order, is_public, is_active, is_trial, trial_days, contact_sales) values
  ('trial',      '{"ar":"تجربة مجانية","en":"Free trial"}', '{"ar":"7 أيام، 100 رد ذكي، ودجت الموقع فقط","en":"7 days, 100 AI replies, website widget only"}', 0, false, true, true, 7, false),
  ('starter',    '{"ar":"المبتدئ","en":"Starter"}',          null, 10, true, true, false, null, false),
  ('growth',     '{"ar":"النمو","en":"Growth"}',             null, 20, true, true, false, null, false),
  ('enterprise', '{"ar":"المؤسسات","en":"Enterprise"}',      null, 30, true, true, false, null, true)
on conflict (code) do nothing;

-- Prices (USD cents). Annual = 10 × monthly ("2 months free").
insert into public.plan_prices (plan_id, interval, amount_cents, currency)
select p.id, v.interval::public.billing_interval, v.amount_cents, 'USD'
from (values
  ('starter',    'month',  3900), ('starter',    'year',  39000),
  ('growth',     'month',  9900), ('growth',     'year',  99000),
  ('enterprise', 'month', 29900), ('enterprise', 'year', 299000)   -- "from" price; contracts may override
) as v(code, interval, amount_cents)
join public.plans p on p.code = v.code
on conflict (plan_id, interval, currency) do nothing;

-- Entitlements per plan. Unlisted keys fall back to entitlement_definitions.default_value.
insert into public.plan_entitlements (plan_id, key, value)
select p.id, v.key, v.value::jsonb
from (values
  -- Trial (proposal P12)
  ('trial', 'ai_replies_per_period', '100'),
  ('trial', 'max_bots', '1'),
  ('trial', 'max_users', '1'),
  ('trial', 'max_meta_channels', '0'),
  ('trial', 'allowed_channel_types', '["widget"]'),
  ('trial', 'data_retention_days', '30'),
  -- Starter $39
  ('starter', 'ai_replies_per_period', '1000'),
  ('starter', 'max_bots', '1'),
  ('starter', 'max_users', '1'),
  ('starter', 'max_meta_channels', '1'),
  ('starter', 'allowed_channel_types', '["widget","whatsapp","messenger","instagram"]'),
  ('starter', 'analytics_level', '"basic"'),
  -- Growth $99
  ('growth', 'ai_replies_per_period', '5000'),
  ('growth', 'overage_enabled', 'true'),
  ('growth', 'overage_unit_size', '1000'),
  ('growth', 'overage_unit_price_cents', '1000'),
  ('growth', 'max_bots', '2'),
  ('growth', 'max_users', '3'),
  ('growth', 'max_meta_channels', '3'),
  ('growth', 'allowed_channel_types', '["widget","whatsapp","messenger","instagram"]'),
  ('growth', 'analytics_level', '"advanced"'),
  ('growth', 'question_classification', 'true'),
  ('growth', 'orders', 'true'),
  ('growth', 'reservations', 'true'),
  ('growth', 'human_handoff', 'true'),
  ('growth', 'knowledge_files_max', '25'),
  -- Enterprise from $299 — defaults; real limits set per workspace via overrides
  ('enterprise', 'ai_replies_per_period', '20000'),
  ('enterprise', 'overage_enabled', 'true'),
  ('enterprise', 'overage_unit_size', '1000'),
  ('enterprise', 'overage_unit_price_cents', '1000'),
  ('enterprise', 'max_bots', 'null'),
  ('enterprise', 'max_users', 'null'),
  ('enterprise', 'max_meta_channels', 'null'),
  ('enterprise', 'allowed_channel_types', '["widget","whatsapp","messenger","instagram"]'),
  ('enterprise', 'multi_branch', 'true'),
  ('enterprise', 'max_branches', 'null'),
  ('enterprise', 'analytics_level', '"advanced"'),
  ('enterprise', 'question_classification', 'true'),
  ('enterprise', 'orders', 'true'),
  ('enterprise', 'reservations', 'true'),
  ('enterprise', 'human_handoff', 'true'),
  ('enterprise', 'api_access', 'true'),
  ('enterprise', 'knowledge_file_max_mb', '20'),
  ('enterprise', 'knowledge_files_max', 'null'),
  ('enterprise', 'widget_remove_branding', 'true')
) as v(code, key, value)
join public.plans p on p.code = v.code
on conflict (plan_id, key) do nothing;

insert into public.one_time_products (code, name, amount_cents, currency, refundable) values
  ('meta_channel_connection', '{"ar":"رسوم ربط قناة ميتا","en":"Meta channel connection fee"}', 4900, 'USD', true)
on conflict (code) do nothing;

-- Model routing (decision A15). Prices below = Anthropic list prices per 1M tokens as cached
-- on 2026-11-03 (needs verification at go-live).
--   standard: Haiku 5.5 for replies + classification; escalates to Sonnet 5.5 on complaints,
--             low-confidence answers or complex multi-step questions. Default for ALL plans.
--   premium:  Opus 5.5, Enterprise only, assigned per contract via an entitlement override.
-- If Haiku fails the Phase 04 Arabic dialect eval, update the `standard` row (no code change).
insert into public.ai_model_profiles
  (code, provider, generation_model, classifier_model, escalation_model, escalation_config,
   effort, max_output_tokens, refusal_fallback)
values
  ('standard', 'anthropic', 'claude-haiku-5-5', 'claude-haiku-5-5', 'claude-sonnet-5-5',
   '{"triggers":["complaint","low_confidence","complex_multi_step"],"min_confidence":0.6,"max_escalation_rate_alert":0.30}',
   'low', 1024, 'none'),   -- Haiku 5.5: no server-side refusal fallback (escalation calls use 'default')
  ('premium', 'anthropic', 'claude-opus-5-5', 'claude-haiku-5-5', null, '{}',
   'low', 1024, 'default')
on conflict (code) do nothing;

insert into public.ai_model_prices
  (model, input_cost_micros_per_mtok, output_cost_micros_per_mtok, cache_read_cost_micros_per_mtok, source_note)
values
  ('claude-haiku-5-5',    100000,   500000,   null, 'list price cached 2026-11-03; prompts <=100K tokens'),
  ('claude-sonnet-5-5',  2000000, 10000000, 100000, 'list price cached 2026-11-03'),
  ('claude-opus-5-5',    4000000, 20000000, 200000, 'list price cached 2026-11-03')
on conflict (model) do nothing;

insert into public.platform_settings (key, value, description) values
  ('admin_notification_emails', '[]', 'Recipients for channel requests and manual payment requests'),
  ('trial_data_retention_days', '30', 'Days data is kept after a trial ends without upgrade (decision C7)'),
  ('workspace_delete_grace_days', '7', 'Grace period before a requested workspace deletion runs'),
  ('widget_cdn_version', '"v1"', 'Widget script major version served from the CDN')
on conflict (key) do nothing;
