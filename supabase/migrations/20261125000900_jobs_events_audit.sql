-- =============================================================================
-- 0009 · Job queue, outbox events (n8n/Resend), audit log, API keys, data requests,
--        platform settings, internal admin notes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- jobs — Postgres-based queue (proposal P1). Claimed with FOR UPDATE SKIP LOCKED (0010).
-- Job types (v1): ai_reply, ingest_knowledge_source, embed_chunks, deliver_message,
-- usage_period_rollover, trial_expiry_check, retention_purge, workspace_export,
-- workspace_delete, dispatch_platform_event.
-- -----------------------------------------------------------------------------
create table public.jobs (
  id              bigint generated always as identity primary key,
  queue           text not null default 'default',     -- 'ai' (latency-sensitive) | 'default' | 'maintenance'
  type            text not null,
  workspace_id    uuid references public.workspaces (id) on delete cascade,
  payload         jsonb not null default '{}'::jsonb,
  status          public.job_status not null default 'queued',
  priority        smallint not null default 100,        -- lower = sooner
  attempts        integer not null default 0,
  max_attempts    integer not null default 5,
  run_at          timestamptz not null default now(),
  locked_at       timestamptz,
  locked_by       text,
  lock_expires_at timestamptz,                          -- visibility timeout
  last_error      text,
  idempotency_key text unique,
  created_at      timestamptz not null default now(),
  finished_at     timestamptz
);
create index jobs_claim_idx on public.jobs (queue, priority, run_at) where status = 'queued';
create index jobs_stuck_idx on public.jobs (lock_expires_at) where status = 'running';
create index jobs_workspace_idx on public.jobs (workspace_id, created_at desc);

-- -----------------------------------------------------------------------------
-- platform_events — transactional outbox. The worker dispatches each row to Resend
-- (transactional email) and/or n8n (side automations, decision A11). Never in the
-- message hot path.
-- Event types (v1): channel_request.created, channel_request.status_changed,
-- manual_payment.requested, subscription.activated, subscription.canceled,
-- usage.threshold_reached, trial.ending, trial.ended, workspace.created, report.daily.
-- -----------------------------------------------------------------------------
create table public.platform_events (
  id              bigint generated always as identity primary key,
  event_type      text not null,
  workspace_id    uuid references public.workspaces (id) on delete set null,
  payload         jsonb not null default '{}'::jsonb,   -- no secrets, minimal PII
  email_status    public.event_delivery_status not null default 'skipped',
  n8n_status      public.event_delivery_status not null default 'pending',
  attempts        integer not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz
);
create index platform_events_pending_idx on public.platform_events (created_at)
  where email_status = 'pending' or n8n_status = 'pending';

-- -----------------------------------------------------------------------------
-- audit_logs — security-relevant and admin actions (append-only)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces (id) on delete set null,
  actor_type   public.actor_type not null,
  actor_id     uuid,
  action       text not null,              -- e.g. 'subscription.manual_activate', 'member.role_change'
  entity_type  text,
  entity_id    text,
  changes      jsonb not null default '{}'::jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index audit_logs_ws_idx on public.audit_logs (workspace_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- Prevent edits/deletes of audit rows by anyone but the table owner.
create or replace function private.audit_logs_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.audit_logs_immutable();

-- -----------------------------------------------------------------------------
-- internal_notes — Super Admin notes on any entity; never customer-visible
-- -----------------------------------------------------------------------------
create table public.internal_notes (
  id           bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  entity_type  text not null,              -- 'channel_connection_request', 'manual_payment_request', ...
  entity_id    uuid not null,
  body         text not null,
  author_id    uuid not null references auth.users (id),
  created_at   timestamptz not null default now()
);
create index internal_notes_entity_idx on public.internal_notes (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- api_keys — Enterprise public API (entitlement `api_access`). Only the hash is stored.
-- -----------------------------------------------------------------------------
create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null,
  key_prefix   text not null,             -- first chars shown in UI, e.g. 'sk_live_ab12'
  key_hash     text not null unique,      -- sha-256 of the full key
  scopes       text[] not null default array['conversations:read'],
  created_by   uuid references auth.users (id),
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index api_keys_workspace_idx on public.api_keys (workspace_id);

-- -----------------------------------------------------------------------------
-- data_requests — per-workspace export / delete (decision C10)
-- -----------------------------------------------------------------------------
create table public.data_requests (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  kind          text not null check (kind in ('export', 'delete')),
  status        public.processing_status not null default 'pending',
  requested_by  uuid not null references auth.users (id),
  export_path   text,                     -- bucket `exports`, signed URL issued on demand
  expires_at    timestamptz,
  -- Deletion is scheduled with a grace period, cancelable until it runs
  scheduled_for timestamptz,
  error         text,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index data_requests_ws_idx on public.data_requests (workspace_id, created_at desc);

-- -----------------------------------------------------------------------------
-- platform_settings — Super Admin editable, non-secret key/value config
-- e.g. 'admin_notification_emails', 'trial_grace_days', 'default_model_profile'
-- -----------------------------------------------------------------------------
create table public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  description text,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- RLS — all internal except what owners must see.
-- -----------------------------------------------------------------------------
alter table public.jobs              enable row level security;
alter table public.platform_events   enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.internal_notes    enable row level security;
alter table public.api_keys          enable row level security;
alter table public.data_requests     enable row level security;
alter table public.platform_settings enable row level security;

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (workspace_id is not null
         and private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])
         and actor_type <> 'platform_admin');

create policy api_keys_select on public.api_keys for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
revoke select on public.api_keys from authenticated;
grant select (id, workspace_id, name, key_prefix, scopes, created_by, last_used_at, expires_at, revoked_at, created_at)
  on public.api_keys to authenticated;

create policy data_requests_select on public.data_requests for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));
