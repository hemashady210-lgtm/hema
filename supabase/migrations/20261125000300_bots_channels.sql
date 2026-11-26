-- =============================================================================
-- 0003 · Business profile, bots, channels, connection requests, widget settings
-- P2 (DECISIONS §E): channel_connections → channels (E9), status/connection_mode (E5),
-- widget_configs → widget_settings (E9/E13), bot settings → bot_configs (0007),
-- bot status + readiness_score + public_key (§6). New: working_hours (+ overrides),
-- typed policies, channel_credentials (service role only), whatsapp_templates.
-- Meta Embedded Signup v4 / Facebook Login (P13, flag `meta_embedded_signup`) inserts
-- rows with connection_mode = 'oauth' — no schema rewrite (E2).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- business_profiles — structured business info (knowledge source, decision C4)
-- One row per workspace (branch_id null) plus optional per-branch rows (Enterprise).
-- Hours → working_hours (+ overrides), policies → policies (E9).
-- -----------------------------------------------------------------------------
create table public.business_profiles (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspaces (id) on delete cascade,
  branch_id              uuid,
  display_name           jsonb not null check (private.is_i18n_text(display_name)),
  description            jsonb check (private.is_i18n_text(description)),
  -- contact
  phone                  text,
  email                  text,
  website                text,
  address                jsonb check (private.is_i18n_text(address)),
  -- {"instagram":"https://...","x":"https://...","tiktok":"..."}; URLs only, no credentials
  social_links           jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),
  -- Workspace-level guidance for the AI (treated as data, never as system instructions)
  custom_ai_instructions text check (char_length(custom_ai_instructions) <= 4000),
  tone                   text not null default 'friendly'
                           check (tone in ('friendly', 'professional', 'concise', 'luxury')),
  extra                  jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete cascade,
  unique nulls not distinct (workspace_id, branch_id)
);
create index business_profiles_workspace_idx on public.business_profiles (workspace_id);
create trigger business_profiles_updated_at before update on public.business_profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- working_hours (+ overrides) — E9: replaces business_profiles.opening_hours/special_hours.
-- Times are local to the branch timezone (else the workspace timezone). Several rows per
-- weekday allow split shifts; close_time < open_time means the shift ends after midnight.
-- weekday: 0 = Sunday … 6 = Saturday (Postgres `extract(dow ...)`).
-- -----------------------------------------------------------------------------
create table public.working_hours (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  branch_id    uuid,
  weekday      smallint not null check (weekday between 0 and 6),
  is_closed    boolean not null default false,
  open_time    time,
  close_time   time,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete cascade,
  check (is_closed = (open_time is null)),
  check ((open_time is null) = (close_time is null)),
  check (open_time is distinct from close_time or open_time is null),
  unique nulls not distinct (workspace_id, branch_id, weekday, open_time)
);
create index working_hours_workspace_idx on public.working_hours (workspace_id, branch_id, weekday);
create trigger working_hours_updated_at before update on public.working_hours
  for each row execute function private.set_updated_at();

-- Holiday / special-day overrides for a specific date.
create table public.working_hours_overrides (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  branch_id    uuid,
  date         date not null,
  is_closed    boolean not null default true,
  open_time    time,
  close_time   time,
  note         jsonb check (private.is_i18n_text(note)),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete cascade,
  check (is_closed = (open_time is null)),
  check ((open_time is null) = (close_time is null)),
  unique nulls not distinct (workspace_id, branch_id, date, open_time)
);
create index working_hours_overrides_workspace_idx on public.working_hours_overrides (workspace_id, date);
create trigger working_hours_overrides_updated_at before update on public.working_hours_overrides
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- policies — typed business policies (§6, E9). Content is localized jsonb (CLAUDE.md).
-- Used by the `get_policy` tool (E6) and embedded as kb chunks (source type `policy`).
-- -----------------------------------------------------------------------------
create table public.policies (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  branch_id    uuid,
  type         public.policy_type not null,
  title        jsonb check (private.is_i18n_text(title)),
  content      jsonb not null check (private.is_i18n_text(content) and content <> '{}'::jsonb),
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete cascade
);
create index policies_workspace_idx on public.policies (workspace_id, type);
create trigger policies_updated_at before update on public.policies
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- bots
-- Content settings live in versioned bot_configs (0007); `active_config_id` points at the
-- live version. Plan-gated capability switches stay here (tested triggers, E9 keep).
-- -----------------------------------------------------------------------------
create table public.bots (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  branch_id            uuid,
  name                 text not null check (char_length(name) between 1 and 80),
  avatar_path          text,
  -- §6 / §13: draft → testing → ready → active ⇄ paused. Transitions (readiness gate) are
  -- server-side (P11); clients cannot write this column.
  status               public.bot_status not null default 'draft',
  readiness_score      smallint not null default 0 check (readiness_score between 0 and 100),
  -- auto = reply in the customer's language (C9); ar / en = always that language.
  language_mode        text not null default 'auto' check (language_mode in ('auto', 'ar', 'en')),
  default_language     text not null default 'ar' check (default_language in ('ar', 'en')),
  -- Public, embeddable identifier for the widget snippet (`data-bot`). Not a secret.
  public_key           text not null unique default ('wk_' || encode(extensions.gen_random_bytes(18), 'hex')),
  handoff_enabled      boolean not null default false,   -- requires entitlement `human_handoff`
  orders_enabled       boolean not null default false,   -- requires entitlement `orders`
  reservations_enabled boolean not null default false,   -- requires entitlement `reservations`
  active_config_id     uuid,                             -- FK added in 0007 (bot_configs)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete set null (branch_id)
);
create index bots_workspace_idx on public.bots (workspace_id);
create trigger bots_updated_at before update on public.bots
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- channels — one row per channel account (E9: was channel_connections).
-- Real status only (A14): written by the system/admin through the service role, never by
-- customer-side clients. A Meta channel can only be `connected` after a passing health
-- check (§11.5), enforced below.
-- -----------------------------------------------------------------------------
create table public.channels (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces (id) on delete cascade,
  bot_id                  uuid not null,
  channel_type            public.channel_type not null,
  status                  public.channel_status not null default 'not_connected',
  connection_mode         public.connection_mode not null,
  display_name            text,
  -- Routing key for inbound webhooks. WhatsApp: phone_number_id · Messenger: page_id ·
  -- Instagram: IG professional account id · Widget: null. Kept as an indexed column (E0)
  -- so one external account can be live in only one workspace. Semantics per Meta API =
  -- needs verification (INTEGRATIONS.md).
  external_account_id     text,
  -- Other provider ids (§6 external_ids): {"waba_id": "...", "business_id": "...", ...}
  external_ids            jsonb not null default '{}'::jsonb check (jsonb_typeof(external_ids) = 'object'),
  phone_number_display    text,
  webhook_subscribed_at   timestamptz,
  -- e.g. {"graph_api_version":"vXX.X"}; non-secret only. Credentials → channel_credentials.
  config                  jsonb not null default '{}'::jsonb,
  -- Health check (gap item): written by the backend after every live check (P13).
  health_status           public.health_status not null default 'unknown',
  last_health_check_at    timestamptz,
  last_health_check_error text,
  last_error              text,
  last_error_at           timestamptz,
  last_inbound_at         timestamptz,
  last_outbound_at        timestamptz,
  connected_at            timestamptz,
  connected_by            uuid references auth.users (id),
  disconnected_at         timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, bot_id) references public.bots (workspace_id, id) on delete cascade,
  check ((channel_type = 'widget') = (connection_mode = 'automatic')),
  -- Never "connected" unless the last health check passed (§11.5).
  constraint channels_connected_requires_health check (
    channel_type = 'widget' or status <> 'connected'
    or (health_status = 'passing' and last_health_check_at is not null)
  )
);
create index channels_workspace_idx on public.channels (workspace_id);
create index channels_bot_idx on public.channels (bot_id);
-- A given external account can be live in only one workspace at a time.
create unique index channels_external_unique
  on public.channels (channel_type, external_account_id)
  where external_account_id is not null and status <> 'not_connected';
-- One widget per bot.
create unique index channels_one_widget_per_bot on public.channels (bot_id) where channel_type = 'widget';
create trigger channels_updated_at before update on public.channels
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- channel_credentials — §6 / gap finding: credentials live in a table NO client role can
-- read (Phase 01 kept the Vault reference on the member-readable channel row). The access
-- token itself is stored in Supabase Vault (P5); this row only holds the Vault secret id.
-- Written by the `api` admin/* routes and the P13 OAuth flow with the service role.
-- -----------------------------------------------------------------------------
create table public.channel_credentials (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  channel_id      uuid not null unique,
  vault_secret_id uuid not null unique,     -- vault.secrets.id; never the token itself
  -- Granted permissions as reported by Meta (exact names = needs verification, P13).
  scopes          text[] not null default '{}',
  expires_at      timestamptz,              -- null = no known expiry
  last_rotated_at timestamptz,
  created_by      uuid references auth.users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (workspace_id, channel_id) references public.channels (workspace_id, id) on delete cascade
);
create index channel_credentials_workspace_idx on public.channel_credentials (workspace_id);
create index channel_credentials_expiry_idx on public.channel_credentials (expires_at) where expires_at is not null;
create trigger channel_credentials_updated_at before update on public.channel_credentials
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- whatsapp_templates — approved message templates for sending outside the 24 h customer
-- service window (§11.2; sending in P13, management later). `category` and `status` hold
-- the provider's values as returned by Meta (needs verification), not our own enum.
-- -----------------------------------------------------------------------------
create table public.whatsapp_templates (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  channel_id           uuid not null,
  name                 text not null check (char_length(name) between 1 and 512),
  language             text not null,       -- provider locale code, e.g. 'ar', 'en_US'
  category             text,
  status               text not null,
  components           jsonb not null default '[]'::jsonb check (jsonb_typeof(components) = 'array'),
  external_template_id text,
  rejection_reason     text,
  last_synced_at       timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (channel_id, name, language),
  foreign key (workspace_id, channel_id) references public.channels (workspace_id, id) on delete cascade
);
create index whatsapp_templates_workspace_idx on public.whatsapp_templates (workspace_id);
create trigger whatsapp_templates_updated_at before update on public.whatsapp_templates
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- channel_connection_requests — manual Meta connection flow (A14). `in_progress` and
-- `rejected` live only here (E5).
-- -----------------------------------------------------------------------------
create table public.channel_connection_requests (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  bot_id             uuid not null,
  channel_type       public.channel_type not null check (channel_type <> 'widget'),
  status             public.connection_request_status not null default 'pending',
  requested_by       uuid not null references auth.users (id),
  contact_name       text not null,
  contact_email      text not null,
  contact_phone      text,
  business_name      text not null,
  -- §6 "submitted data": channel-specific form answers, validated by the `api` function:
  -- WhatsApp: {phone_number, has_existing_waba, meta_business_id?, display_name}
  -- Messenger: {facebook_page_url, meta_business_id?}
  -- Instagram: {instagram_handle, linked_facebook_page_url}
  -- Never passwords (§7).
  submitted_data     jsonb not null default '{}'::jsonb,
  customer_notes     text check (char_length(customer_notes) <= 2000),
  -- Kept instead of §6 fee_paid (E0): the refundable fee (C6) needs refunded/waived states.
  fee_status         text not null default 'pending'
                       check (fee_status in ('not_required', 'pending', 'paid', 'waived', 'refunded')),
  fee_transaction_id uuid,          -- FK added in 0008 (payment_transactions)
  assigned_admin_id  uuid references auth.users (id),
  channel_id         uuid,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, bot_id) references public.bots (workspace_id, id) on delete cascade,
  foreign key (workspace_id, channel_id)
    references public.channels (workspace_id, id) on delete set null (channel_id)
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
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  channel_id   uuid,
  request_id   uuid,
  from_status  text,
  to_status    text not null,
  note         text,
  is_internal  boolean not null default false,
  actor_type   public.actor_type not null,
  actor_id     uuid,
  created_at   timestamptz not null default now(),
  foreign key (workspace_id, channel_id) references public.channels (workspace_id, id) on delete cascade,
  foreign key (workspace_id, request_id)
    references public.channel_connection_requests (workspace_id, id) on delete cascade,
  check (channel_id is not null or request_id is not null)
);
create index channel_connection_events_workspace_idx on public.channel_connection_events (workspace_id);
create index channel_connection_events_channel_idx on public.channel_connection_events (channel_id, created_at);
create index channel_connection_events_req_idx on public.channel_connection_events (request_id, created_at);

-- -----------------------------------------------------------------------------
-- widget_settings — 1:1 with a widget channel (E9: was widget_configs). Keyed by the
-- widget channel (one per bot); the bot's public key lives on bots.public_key.
-- -----------------------------------------------------------------------------
create table public.widget_settings (
  channel_id            uuid primary key,
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  -- Exact origins, e.g. {'https://shop.example.com'} (E13). Empty = widget refuses to load.
  allowed_origins       text[] not null default '{}',
  -- {"accent":"#3D6BFF","mode":"auto|dark|light","radius":"lg","launcher_icon":"chat"}
  theme                 jsonb not null default '{}'::jsonb,
  greeting              jsonb check (private.is_i18n_text(greeting)),
  launcher_text         jsonb check (private.is_i18n_text(launcher_text)),
  -- Logical position: 'end' = right in LTR / left in RTL.
  position              text not null default 'end' check (position in ('start', 'end')),
  -- Pre-chat fields: {"name":"optional","phone":"required","email":"off"}
  prechat_fields        jsonb not null default '{}'::jsonb,
  show_branding         boolean not null default true,
  is_enabled            boolean not null default true,
  -- Installation verification (§11.1, gap): written by widget-gateway from a real load ping.
  installed_verified_at timestamptz,
  installed_origin      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (workspace_id, channel_id) references public.channels (workspace_id, id) on delete cascade
);
create index widget_settings_workspace_idx on public.widget_settings (workspace_id);
create trigger widget_settings_updated_at before update on public.widget_settings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.business_profiles           enable row level security;
alter table public.working_hours               enable row level security;
alter table public.working_hours_overrides     enable row level security;
alter table public.policies                    enable row level security;
alter table public.channel_credentials         enable row level security;
alter table public.whatsapp_templates          enable row level security;
alter table public.bots                        enable row level security;
alter table public.channels                    enable row level security;
alter table public.channel_connection_requests enable row level security;
alter table public.channel_connection_events   enable row level security;
alter table public.widget_settings             enable row level security;

create policy business_profiles_select on public.business_profiles for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy business_profiles_write on public.business_profiles for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

create policy working_hours_select on public.working_hours for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy working_hours_write on public.working_hours for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

create policy working_hours_overrides_select on public.working_hours_overrides for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy working_hours_overrides_write on public.working_hours_overrides for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

create policy policies_select on public.policies for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy policies_write on public.policies for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

-- channel_credentials: service role only — RLS on, NO policies, no privileges (§6, §7).
revoke all on public.channel_credentials from anon, authenticated;

-- WhatsApp templates: members read; synced/written by the backend only.
create policy whatsapp_templates_select on public.whatsapp_templates for select to authenticated
  using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.whatsapp_templates from anon, authenticated;

-- Bots: owner/admin manage directly; `max_bots` and the capability switches are enforced by
-- triggers in 0010 regardless of the call path. status / readiness_score / public_key are
-- server-only (column grants).
create policy bots_select on public.bots for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy bots_write on public.bots for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));
revoke insert, update on public.bots from authenticated;
grant insert (workspace_id, branch_id, name, avatar_path, language_mode, default_language,
              handoff_enabled, orders_enabled, reservations_enabled)
  on public.bots to authenticated;
grant update (branch_id, name, avatar_path, language_mode, default_language,
              handoff_enabled, orders_enabled, reservations_enabled, active_config_id)
  on public.bots to authenticated;

-- Channels: read-only for customers. All writes via `api` (admin/* routes) with service role.
create policy channels_select on public.channels for select to authenticated
  using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.channels from anon, authenticated;

-- Requests: read-only for customers; created/canceled through `api` so the admin
-- notification + fee flow always runs.
create policy channel_connection_requests_select on public.channel_connection_requests
  for select to authenticated
  using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.channel_connection_requests from anon, authenticated;

create policy channel_connection_events_select on public.channel_connection_events
  for select to authenticated
  using (private.is_workspace_member(workspace_id) and not is_internal);
revoke insert, update, delete on public.channel_connection_events from anon, authenticated;

-- Widget appearance is editable by owner/admin; allowed_origins via `api` (validated).
create policy widget_settings_select on public.widget_settings for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy widget_settings_update on public.widget_settings for update to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));
revoke insert, update, delete on public.widget_settings from anon, authenticated;
grant update (theme, greeting, launcher_text, position, prechat_fields, is_enabled)
  on public.widget_settings to authenticated;
