-- =============================================================================
-- 0003 · Business profile, bots, channel connections, connection requests, widget config
-- Channel model is designed so Meta Embedded Signup v4 can be added later by inserting
-- rows with connection_method = 'embedded_signup' — no schema rewrite (decision A14).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- business_profiles — structured business info (knowledge source, decision C4)
-- One row per workspace (branch_id null) plus optional per-branch rows (Enterprise).
-- -----------------------------------------------------------------------------
create table public.business_profiles (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  branch_id     uuid,
  display_name  jsonb not null check (private.is_i18n_text(display_name)),
  description   jsonb check (private.is_i18n_text(description)),
  category      text,
  phone         text,
  email         text,
  website       text,
  address       jsonb check (private.is_i18n_text(address)),
  -- {"mon":[{"open":"09:00","close":"17:00"}], ..., "sun":[]}; times in the branch/workspace TZ
  opening_hours jsonb not null default '{}'::jsonb,
  -- [{"date":"2026-12-25","closed":true,"note":{"ar":"..","en":".."}}]
  special_hours jsonb not null default '[]'::jsonb,
  -- [{"key":"refunds","title":{"ar":"..","en":".."},"body":{"ar":"..","en":".."}}]
  policies      jsonb not null default '[]'::jsonb,
  extra         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete cascade,
  unique nulls not distinct (workspace_id, branch_id)
);
create trigger business_profiles_updated_at before update on public.business_profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- bots
-- -----------------------------------------------------------------------------
create table public.bots (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  branch_id            uuid,
  name                 text not null check (char_length(name) between 1 and 80),
  avatar_path          text,
  tone                 text not null default 'friendly'
                         check (tone in ('friendly', 'professional', 'concise', 'luxury')),
  -- Languages the bot may answer in; reply language follows the customer (decision C9).
  languages            text[] not null default array['ar', 'en'],
  default_language     text not null default 'ar' check (default_language in ('ar', 'en')),
  custom_instructions  text check (char_length(custom_instructions) <= 4000),
  -- Sent when AI cannot reply (quota exhausted, trial ended, provider failure).
  fallback_message     jsonb not null default
    '{"ar":"شكراً لتواصلك معنا، سيتم الرد عليك في أقرب وقت.","en":"Thanks for reaching out — we will get back to you shortly."}'::jsonb
    check (private.is_i18n_text(fallback_message)),
  handoff_message      jsonb check (private.is_i18n_text(handoff_message)),
  ai_enabled           boolean not null default true,
  handoff_enabled      boolean not null default false,   -- requires entitlement `human_handoff`
  orders_enabled       boolean not null default false,   -- requires entitlement `orders`
  reservations_enabled boolean not null default false,   -- requires entitlement `reservations`
  model_profile_id     uuid,                              -- FK added in 0007 (ai_model_profiles)
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete set null (branch_id)
);
create index bots_workspace_idx on public.bots (workspace_id);
create trigger bots_updated_at before update on public.bots
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- channel_connections — one row per connected channel account.
-- Real status only (decision A14): status changes are written by the system/admin, never
-- by customer-side clients.
-- -----------------------------------------------------------------------------
create table public.channel_connections (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  bot_id                uuid not null,
  channel_type          public.channel_type not null,
  status                public.channel_status not null default 'not_connected',
  connection_method     public.connection_method not null,
  display_name          text,
  -- WhatsApp: phone_number_id · Messenger: page_id · Instagram: IG professional account id
  -- Widget: null. Exact identifier semantics per Meta API = needs verification (INTEGRATIONS.md).
  external_account_id   text,
  -- WhatsApp: WABA id · Messenger/Instagram: Meta business id (if known)
  external_business_id  text,
  phone_number_display  text,
  -- Supabase Vault secret id holding the access token (proposal P5). Never the token itself.
  credentials_secret_id uuid,
  token_expires_at      timestamptz,
  webhook_subscribed_at timestamptz,
  -- e.g. {"graph_api_version":"vXX.X","template_namespace":"..."}; non-secret only
  config                jsonb not null default '{}'::jsonb,
  last_error            text,
  last_error_at         timestamptz,
  last_inbound_at       timestamptz,
  last_outbound_at      timestamptz,
  connected_at          timestamptz,
  connected_by          uuid references auth.users (id),
  disconnected_at       timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, bot_id) references public.bots (workspace_id, id) on delete cascade,
  check ((channel_type = 'widget') = (connection_method = 'automatic'))
);
create index channel_connections_workspace_idx on public.channel_connections (workspace_id);
-- A given external account can be live in only one workspace at a time.
create unique index channel_connections_external_unique
  on public.channel_connections (channel_type, external_account_id)
  where external_account_id is not null and status not in ('disconnected', 'rejected');
-- One widget per bot.
create unique index channel_connections_one_widget_per_bot
  on public.channel_connections (bot_id) where channel_type = 'widget';
create trigger channel_connections_updated_at before update on public.channel_connections
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- channel_connection_requests — manual Meta connection flow (decision A14)
-- -----------------------------------------------------------------------------
create table public.channel_connection_requests (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  bot_id                uuid not null,
  channel_type          public.channel_type not null check (channel_type <> 'widget'),
  status                public.connection_request_status not null default 'pending',
  requested_by          uuid not null references auth.users (id),
  contact_name          text not null,
  contact_email         text not null,
  contact_phone         text,
  business_name         text not null,
  -- Channel-specific form answers, validated by the `api` function against a zod schema:
  -- WhatsApp: {phone_number, has_existing_waba, meta_business_id?, display_name}
  -- Messenger: {facebook_page_url, meta_business_id?}
  -- Instagram: {instagram_handle, linked_facebook_page_url}
  details               jsonb not null default '{}'::jsonb,
  customer_notes        text check (char_length(customer_notes) <= 2000),
  fee_status            text not null default 'pending'
                          check (fee_status in ('not_required', 'pending', 'paid', 'waived', 'refunded')),
  fee_transaction_id    uuid,          -- FK added in 0008 (billing_transactions)
  assigned_admin_id     uuid references auth.users (id),
  channel_connection_id uuid,
  resolved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (workspace_id, bot_id) references public.bots (workspace_id, id) on delete cascade,
  foreign key (workspace_id, channel_connection_id)
    references public.channel_connections (workspace_id, id) on delete set null (channel_connection_id)
);
create index channel_connection_requests_workspace_idx on public.channel_connection_requests (workspace_id);
create index channel_connection_requests_open_idx on public.channel_connection_requests (status, created_at)
  where status in ('pending', 'in_progress');
create trigger channel_connection_requests_updated_at before update on public.channel_connection_requests
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- channel_connection_events — status history (customer-visible unless is_internal)
-- -----------------------------------------------------------------------------
create table public.channel_connection_events (
  id                    bigint generated always as identity primary key,
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  channel_connection_id uuid,
  request_id            uuid references public.channel_connection_requests (id) on delete cascade,
  from_status           text,
  to_status             text not null,
  note                  text,
  is_internal           boolean not null default false,
  actor_type            public.actor_type not null,
  actor_id              uuid,
  created_at            timestamptz not null default now(),
  foreign key (workspace_id, channel_connection_id)
    references public.channel_connections (workspace_id, id) on delete cascade,
  check (channel_connection_id is not null or request_id is not null)
);
create index channel_connection_events_conn_idx on public.channel_connection_events (channel_connection_id, created_at);
create index channel_connection_events_req_idx on public.channel_connection_events (request_id, created_at);

-- -----------------------------------------------------------------------------
-- widget_configs — 1:1 with a widget channel_connection
-- -----------------------------------------------------------------------------
create table public.widget_configs (
  channel_connection_id uuid primary key references public.channel_connections (id) on delete cascade,
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  -- Public, embeddable identifier (not a secret). Rotated via the `api` function.
  public_key            text not null unique default ('wk_' || encode(extensions.gen_random_bytes(18), 'hex')),
  -- Exact origins, e.g. {'https://shop.example.com'}. Empty = widget refuses to load (safe default).
  allowed_origins       text[] not null default '{}',
  -- {"accent":"#3D6BFF","mode":"auto|dark|light","radius":"lg","launcher_icon":"chat"}
  theme                 jsonb not null default '{}'::jsonb,
  greeting              jsonb check (private.is_i18n_text(greeting)),
  launcher_label        jsonb check (private.is_i18n_text(launcher_label)),
  -- Logical position: 'end' = right in LTR / left in RTL.
  position              text not null default 'end' check (position in ('start', 'end')),
  -- Pre-chat fields: {"name":"optional","phone":"required","email":"off"}
  prechat_fields        jsonb not null default '{}'::jsonb,
  show_branding         boolean not null default true,
  is_enabled            boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index widget_configs_workspace_idx on public.widget_configs (workspace_id);
create trigger widget_configs_updated_at before update on public.widget_configs
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.business_profiles           enable row level security;
alter table public.bots                        enable row level security;
alter table public.channel_connections         enable row level security;
alter table public.channel_connection_requests enable row level security;
alter table public.channel_connection_events   enable row level security;
alter table public.widget_configs              enable row level security;

create policy business_profiles_select on public.business_profiles for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy business_profiles_write on public.business_profiles for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

-- Bots: owner/admin manage directly; the `max_bots` limit and feature-flag columns are
-- enforced by triggers in 0010 regardless of the call path.
create policy bots_select on public.bots for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy bots_write on public.bots for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

-- Channel connections: read-only for customers. All writes via `api`/`admin` functions.
create policy channel_connections_select on public.channel_connections for select to authenticated
  using (private.is_workspace_member(workspace_id));

-- Requests: read-only for customers; created/canceled through the `api` function so that
-- the admin notification + fee flow always runs.
create policy channel_connection_requests_select on public.channel_connection_requests
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy channel_connection_events_select on public.channel_connection_events
  for select to authenticated
  using (private.is_workspace_member(workspace_id) and not is_internal);

-- Widget appearance is editable by owner/admin; public_key/allowed_origins via function.
create policy widget_configs_select on public.widget_configs for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy widget_configs_update on public.widget_configs for update to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));
revoke update on public.widget_configs from authenticated;
grant update (theme, greeting, launcher_label, position, prechat_fields, is_enabled)
  on public.widget_configs to authenticated;
