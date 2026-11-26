-- =============================================================================
-- 0008 · Plans, prices, entitlements, subscriptions, transactions, usage metering
-- Everything plan-related is DATA (decision B). Seeded in 0012, edited by Super Admin.
-- Money = integer minor units + ISO currency (proposal P14).
-- P2: subscription status `grace` + grace_ends_at (E4); billing_transactions →
-- payment_transactions (E9); the webhook inbox is generic (`webhook_events`, 0009);
-- new billing_events (append-only audit of every billing state change, §14) and
-- invoices_records (manual overage invoices, C5).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catalog of entitlement keys (validates keys + documents value types)
-- -----------------------------------------------------------------------------
create table public.entitlement_definitions (
  key           text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value_type    text not null check (value_type in ('integer', 'boolean', 'text', 'text_array')),
  -- Value used when neither plan nor override defines the key. null integer = unlimited.
  default_value jsonb not null,
  description   text not null
);

create table public.plans (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  name          jsonb not null check (private.is_i18n_text(name)),
  description   jsonb check (private.is_i18n_text(description)),
  sort_order    integer not null default 0,
  is_public     boolean not null default true,    -- shown on pricing page
  is_active     boolean not null default true,    -- can be newly subscribed to
  is_trial      boolean not null default false,
  trial_days    integer check (trial_days > 0),
  contact_sales boolean not null default false,   -- Enterprise: "from $299", manual contract
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (not is_trial or trial_days is not null)
);
create trigger plans_updated_at before update on public.plans
  for each row execute function private.set_updated_at();

create table public.plan_prices (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.plans (id) on delete cascade,
  interval     public.billing_interval not null check (interval in ('month', 'year')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency     char(3) not null default 'USD',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (plan_id, interval, currency)
);

-- One-time products, e.g. the $49 Meta channel connection fee (decision B / C6).
create table public.one_time_products (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         jsonb not null check (private.is_i18n_text(name)),
  amount_cents bigint not null check (amount_cents >= 0),
  currency     char(3) not null default 'USD',
  refundable   boolean not null default true,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Provider-side identifiers for prices/products (PayPal plan id, later Stripe price id).
-- Keeps the provider abstraction out of the core tables (decision A12).
create table public.provider_price_refs (
  id                 uuid primary key default gen_random_uuid(),
  provider           public.payment_provider not null check (provider <> 'manual'),
  plan_price_id      uuid references public.plan_prices (id) on delete cascade,
  one_time_product_id uuid references public.one_time_products (id) on delete cascade,
  external_id        text not null,          -- e.g. PayPal billing plan id "P-..."
  environment        text not null check (environment in ('sandbox', 'live')),
  created_at         timestamptz not null default now(),
  check ((plan_price_id is null) <> (one_time_product_id is null)),
  unique (provider, environment, external_id)
);

create table public.plan_entitlements (
  plan_id uuid not null references public.plans (id) on delete cascade,
  key     text not null references public.entitlement_definitions (key),
  value   jsonb not null,
  primary key (plan_id, key)
);

-- Enterprise custom limits / Super Admin adjustments (decision B: "custom limits").
create table public.workspace_entitlement_overrides (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key          text not null references public.entitlement_definitions (key),
  value        jsonb not null,
  reason       text not null,
  set_by       uuid references auth.users (id),
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, key)
);

-- -----------------------------------------------------------------------------
-- Subscriptions
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references public.workspaces (id) on delete cascade,
  plan_id                  uuid not null references public.plans (id),
  plan_price_id            uuid references public.plan_prices (id),   -- null for trial / custom contracts
  status                   public.subscription_status not null,
  provider                 public.payment_provider not null,
  provider_subscription_id text,                                       -- PayPal "I-..." id
  billing_interval         public.billing_interval check (billing_interval in ('month', 'year')),
  -- Custom contract price (Enterprise / manual). Null = use plan_price.
  custom_amount_cents      bigint check (custom_amount_cents >= 0),
  custom_currency          char(3),
  -- Kept as current_period_* (E0; tested in suites 01/02) instead of §6 period_start/_end.
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  trial_ends_at            timestamptz,
  -- E4: past_due → grace (platform_settings.subscription_grace_days, default 3) → suspended.
  grace_ends_at            timestamptz,
  cancel_at_period_end     boolean not null default false,
  canceled_at              timestamptz,
  ended_at                 timestamptz,
  activated_by             uuid references auth.users (id),            -- Super Admin (manual path)
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (workspace_id, id),
  check (status <> 'trialing' or trial_ends_at is not null),
  check (status <> 'grace' or grace_ends_at is not null)
);
-- At most one live subscription per workspace.
create unique index subscriptions_one_live_per_workspace on public.subscriptions (workspace_id)
  where status in ('trialing', 'active', 'past_due', 'grace', 'suspended', 'pending_activation');
create unique index subscriptions_provider_ref_unique on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();

create table public.billing_customers (
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  provider             public.payment_provider not null check (provider <> 'manual'),
  provider_customer_id text not null,      -- PayPal payer id (needs verification which id to store)
  email                text,
  created_at           timestamptz not null default now(),
  primary key (workspace_id, provider),
  unique (provider, provider_customer_id)
);

-- Full billing history (decision C8). Append-mostly; corrections are new rows.
-- `type` keeps the finer Phase 01 values (E0): `provider` already says "manual", and the
-- refundable connection fee (C6) and overage invoices need their own types.
create table public.payment_transactions (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  subscription_id   uuid,
  type              public.transaction_type not null,
  status            public.transaction_status not null,
  provider          public.payment_provider not null,
  provider_txn_id   text,                -- PayPal capture/sale id; manual receipt reference
  amount_cents      bigint not null check (amount_cents >= 0),
  currency          char(3) not null,
  description       text,
  period_start      timestamptz,
  period_end        timestamptz,
  refund_of_id      uuid,
  metadata          jsonb not null default '{}'::jsonb,   -- our annotations
  raw               jsonb not null default '{}'::jsonb,   -- provider payload (no secrets)
  recorded_by       uuid references auth.users (id),      -- Super Admin for manual entries
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, subscription_id)
    references public.subscriptions (workspace_id, id) on delete set null (subscription_id),
  foreign key (workspace_id, refund_of_id) references public.payment_transactions (workspace_id, id),
  check (type <> 'refund' or refund_of_id is not null)
);
create index payment_transactions_ws_idx on public.payment_transactions (workspace_id, occurred_at desc);
create unique index payment_transactions_provider_txn_unique on public.payment_transactions (provider, provider_txn_id)
  where provider_txn_id is not null;

alter table public.channel_connection_requests
  add constraint ccr_fee_transaction_fk foreign key (workspace_id, fee_transaction_id)
  references public.payment_transactions (workspace_id, id) on delete set null (fee_transaction_id);

-- "Contact admin to pay" path (decision A12).
create table public.manual_payment_requests (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  requested_by      uuid not null references auth.users (id),
  plan_id           uuid references public.plans (id),
  billing_interval  public.billing_interval,
  one_time_product_id uuid references public.one_time_products (id),
  connection_request_id uuid,
  status            public.manual_request_status not null default 'open',
  contact_name      text not null,
  contact_email     text not null,
  contact_phone     text,
  preferred_method  text,          -- free text: bank transfer, cash, ...
  message           text check (char_length(message) <= 2000),
  handled_by        uuid references auth.users (id),
  -- Admin-only notes live in public.internal_notes (0009), never in customer-readable rows.
  subscription_id   uuid,
  transaction_id    uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (workspace_id, connection_request_id)
    references public.channel_connection_requests (workspace_id, id) on delete set null (connection_request_id),
  foreign key (workspace_id, subscription_id)
    references public.subscriptions (workspace_id, id) on delete set null (subscription_id),
  foreign key (workspace_id, transaction_id)
    references public.payment_transactions (workspace_id, id) on delete set null (transaction_id),
  check ((plan_id is not null) or (one_time_product_id is not null))
);
create index manual_payment_requests_ws_idx on public.manual_payment_requests (workspace_id, created_at desc);
create index manual_payment_requests_open_idx on public.manual_payment_requests (status, created_at)
  where status in ('open', 'contacted');
create trigger manual_payment_requests_updated_at before update on public.manual_payment_requests
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Usage metering. Billable unit = AI-generated reply (decision B).
-- Quota is monthly even on annual billing (proposal P11).
-- -----------------------------------------------------------------------------
create table public.usage_periods (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  subscription_id      uuid,
  period_start         timestamptz not null,
  period_end           timestamptz not null,
  -- Snapshotted from entitlements when the period opens (null = unlimited)
  ai_replies_included  integer check (ai_replies_included >= 0),
  overage_allowed      boolean not null default false,
  overage_unit_size    integer check (overage_unit_size > 0),
  overage_unit_price_cents bigint check (overage_unit_price_cents >= 0),
  ai_replies_used      integer not null default 0 check (ai_replies_used >= 0),
  overage_replies      integer not null default 0 check (overage_replies >= 0),
  inbound_messages     integer not null default 0,     -- analytics only, free
  closed_at            timestamptz,
  -- Manual overage invoices (C5) live in invoices_records (E9).
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, period_start),
  foreign key (workspace_id, subscription_id)
    references public.subscriptions (workspace_id, id) on delete set null (subscription_id),
  check (period_end > period_start)
);
create index usage_periods_current_idx on public.usage_periods (workspace_id, period_end desc);
create trigger usage_periods_updated_at before update on public.usage_periods
  for each row execute function private.set_updated_at();

create table public.usage_events (
  id               bigint generated always as identity primary key,
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  usage_period_id  uuid not null,
  kind             text not null check (kind in ('ai_reply_reserved', 'ai_reply_released')),
  quantity         integer not null check (quantity in (-1, 1)),
  is_overage       boolean not null default false,
  ai_run_id        uuid,
  idempotency_key  text not null unique,
  created_at       timestamptz not null default now(),
  foreign key (workspace_id, usage_period_id) references public.usage_periods (workspace_id, id) on delete cascade,
  foreign key (workspace_id, ai_run_id) references public.ai_runs (workspace_id, id) on delete set null (ai_run_id)
);
create index usage_events_period_idx on public.usage_events (usage_period_id);
create index usage_events_workspace_idx on public.usage_events (workspace_id, created_at);

create table public.usage_alerts (
  usage_period_id uuid not null,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  threshold_pct   integer not null check (threshold_pct in (80, 100)),
  triggered_at    timestamptz not null default now(),
  primary key (usage_period_id, threshold_pct),
  foreign key (workspace_id, usage_period_id) references public.usage_periods (workspace_id, id) on delete cascade
);
create index usage_alerts_workspace_idx on public.usage_alerts (workspace_id);

-- -----------------------------------------------------------------------------
-- billing_events — append-only history of every billing state change (§14): subscription
-- status transitions, plan changes, payments recorded, manual activations. Written in the
-- same transaction as the change by `api` / `webhook-paypal` (P12).
-- -----------------------------------------------------------------------------
create table public.billing_events (
  id                     bigint generated always as identity primary key,
  workspace_id           uuid not null references public.workspaces (id) on delete cascade,
  subscription_id        uuid,
  -- e.g. subscription.status_changed, subscription.plan_changed, payment.recorded,
  -- payment.refunded, subscription.manual_activated, overage.invoiced
  event_type             text not null check (event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  from_status            public.subscription_status,
  to_status              public.subscription_status,
  source                 text not null check (source in ('paypal_webhook', 'admin', 'system', 'user')),
  actor_type             public.actor_type not null,
  actor_id               uuid,
  webhook_event_id       bigint,          -- FK added in 0009 (webhook_events)
  payment_transaction_id uuid,
  data                   jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  foreign key (workspace_id, subscription_id)
    references public.subscriptions (workspace_id, id) on delete set null (subscription_id),
  foreign key (workspace_id, payment_transaction_id)
    references public.payment_transactions (workspace_id, id) on delete set null (payment_transaction_id)
);
create index billing_events_ws_idx on public.billing_events (workspace_id, created_at desc);
create trigger billing_events_append_only before update or delete on public.billing_events
  for each row execute function private.reject_mutation();

-- -----------------------------------------------------------------------------
-- invoices_records — manual invoices (overage in v1, C5; tracked automatically, invoiced
-- manually). One live overage invoice per usage period.
-- -----------------------------------------------------------------------------
create table public.invoices_records (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspaces (id) on delete cascade,
  usage_period_id        uuid,
  kind                   text not null default 'overage' check (kind in ('overage', 'manual')),
  status                 public.invoice_status not null default 'draft',
  units                  integer check (units >= 0),
  amount_cents           bigint not null check (amount_cents >= 0),
  currency               char(3) not null default 'USD',
  description            text,
  issued_at              timestamptz,
  due_at                 timestamptz,
  paid_at                timestamptz,
  payment_transaction_id uuid,
  created_by             uuid references auth.users (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, usage_period_id)
    references public.usage_periods (workspace_id, id) on delete set null (usage_period_id),
  foreign key (workspace_id, payment_transaction_id)
    references public.payment_transactions (workspace_id, id) on delete set null (payment_transaction_id),
  check (kind <> 'overage' or usage_period_id is not null),
  check (status not in ('issued', 'paid') or issued_at is not null),
  check (status <> 'paid' or paid_at is not null)
);
create unique index invoices_records_one_overage_per_period on public.invoices_records (usage_period_id)
  where kind = 'overage' and status <> 'void';
create index invoices_records_ws_idx on public.invoices_records (workspace_id, created_at desc);
create trigger invoices_records_updated_at before update on public.invoices_records
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.entitlement_definitions         enable row level security;
alter table public.plans                           enable row level security;
alter table public.plan_prices                     enable row level security;
alter table public.one_time_products               enable row level security;
alter table public.provider_price_refs             enable row level security;
alter table public.plan_entitlements               enable row level security;
alter table public.workspace_entitlement_overrides enable row level security;
alter table public.subscriptions                   enable row level security;
alter table public.billing_customers               enable row level security;
alter table public.payment_transactions            enable row level security;
alter table public.manual_payment_requests         enable row level security;
alter table public.usage_periods                   enable row level security;
alter table public.usage_events                    enable row level security;
alter table public.usage_alerts                    enable row level security;
alter table public.billing_events                  enable row level security;
alter table public.invoices_records                enable row level security;

-- Public pricing data (pricing page is pre-login).
create policy entitlement_definitions_read on public.entitlement_definitions for select
  to anon, authenticated using (true);
create policy plans_read on public.plans for select to anon, authenticated
  using (is_public and is_active);
create policy plan_prices_read on public.plan_prices for select to anon, authenticated
  using (is_active and exists (select 1 from public.plans p where p.id = plan_id and p.is_public and p.is_active));
create policy plan_entitlements_read on public.plan_entitlements for select to anon, authenticated
  using (exists (select 1 from public.plans p where p.id = plan_id and p.is_public and p.is_active));
create policy one_time_products_read on public.one_time_products for select to anon, authenticated
  using (is_active);
-- Public catalogue: SELECT only (anon has no table privileges by default, 0001).
revoke insert, update, delete on public.entitlement_definitions, public.plans, public.plan_prices,
  public.plan_entitlements, public.one_time_products from authenticated;
grant select on public.entitlement_definitions, public.plans, public.plan_prices,
  public.plan_entitlements, public.one_time_products to anon, authenticated;
-- provider_price_refs: service role only.
revoke all on public.provider_price_refs from anon, authenticated;

-- All billing writes go through `api` / `webhook-paypal` with the service role (§7).
create policy workspace_entitlement_overrides_select on public.workspace_entitlement_overrides
  for select to authenticated using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.workspace_entitlement_overrides from authenticated;

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.subscriptions from authenticated;

create policy billing_customers_select on public.billing_customers for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));
revoke insert, update, delete on public.billing_customers from authenticated;

create policy payment_transactions_select on public.payment_transactions for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
revoke insert, update, delete on public.payment_transactions from authenticated;

create policy manual_payment_requests_select on public.manual_payment_requests for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
revoke insert, update, delete on public.manual_payment_requests from authenticated;

create policy usage_periods_select on public.usage_periods for select to authenticated
  using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.usage_periods from authenticated;
create policy usage_alerts_select on public.usage_alerts for select to authenticated
  using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.usage_alerts from authenticated;
-- usage_events: service role only (ledger).
revoke all on public.usage_events from anon, authenticated;

create policy billing_events_select on public.billing_events for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
revoke insert, update, delete on public.billing_events from authenticated;

create policy invoices_records_select on public.invoices_records for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
revoke insert, update, delete on public.invoices_records from authenticated;
