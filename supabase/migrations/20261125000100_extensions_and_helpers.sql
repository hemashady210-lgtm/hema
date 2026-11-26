-- =============================================================================
-- 0001 · Extensions, schemas, enums, shared helpers
-- P2: reconciled with DECISIONS §E (E4 grace, E5 channel status + connection_mode,
-- E9 names, E10 conversation status + handler).
-- =============================================================================

-- Supabase convention: extensions live in the `extensions` schema.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector   with schema extensions;   -- pgvector
create extension if not exists pg_trgm  with schema extensions;
-- pg_cron / pg_net are enabled in P7 when the scheduler sweep is built.

-- `private` holds SECURITY DEFINER helpers. It is NOT exposed through PostgREST
-- (only `public` and `graphql_public` are in the exposed-schemas list).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Privileges: every function is revoked from PUBLIC/anon/authenticated explicitly and granted
-- per use (0010, 0011); `anon` gets table access only to the pricing catalogue (0012).
-- Suite 03_schema_conventions enforces both rules for every future migration.
-- (Per-schema ALTER DEFAULT PRIVILEGES cannot revoke Postgres' built-in PUBLIC EXECUTE, and
-- a global change would also strip EXECUTE from extensions created later.)
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- -----------------------------------------------------------------------------
-- Enums (stable, low-cardinality vocabularies only; anything plan-related is data)
-- -----------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'agent', 'viewer');
create type public.workspace_status as enum ('active', 'read_only', 'suspended', 'pending_deletion');
create type public.platform_role as enum ('super_admin', 'support');
create type public.member_status as enum ('active', 'disabled');

create type public.channel_type as enum ('widget', 'whatsapp', 'messenger', 'instagram');
-- E5. History of every change is kept in channel_connection_events.
create type public.channel_status as enum ('not_connected', 'pending', 'connected', 'error', 'disabled');
-- E5. automatic = widget; manual = admin enters credentials; oauth = Embedded Signup v4 /
-- Facebook Login for Business (built in P13 behind flag `meta_embedded_signup`).
create type public.connection_mode as enum ('automatic', 'manual', 'oauth');
create type public.connection_request_status as enum (
  'pending', 'in_progress', 'completed', 'rejected', 'canceled'
);
create type public.health_status as enum ('unknown', 'passing', 'failing');

-- E10: status open/pending/closed + handler ai/human.
create type public.conversation_status as enum ('open', 'pending', 'closed');
create type public.conversation_handler as enum ('ai', 'human');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_sender as enum ('customer', 'ai', 'agent', 'system');
create type public.message_content_type as enum (
  'text', 'image', 'audio', 'video', 'file', 'location', 'template', 'interactive', 'system_event'
);
create type public.delivery_status as enum ('received', 'queued', 'sent', 'delivered', 'read', 'failed');
create type public.handoff_status as enum ('requested', 'assigned', 'resolved', 'canceled');

-- §6 kb_sources types. URL crawl is later; it is added with `alter type ... add value 'url'`.
create type public.kb_source_type as enum ('profile', 'faq', 'catalog', 'policy', 'file', 'manual');
create type public.processing_status as enum ('pending', 'processing', 'ready', 'failed');
create type public.policy_type as enum ('delivery', 'refund', 'reservation', 'other');

create type public.bot_status as enum ('draft', 'testing', 'ready', 'active', 'paused');

create type public.order_status as enum (
  'draft', 'pending_confirmation', 'confirmed', 'preparing', 'completed', 'canceled'
);
create type public.reservation_status as enum (
  'pending_confirmation', 'confirmed', 'seated', 'completed', 'no_show', 'canceled'
);
create type public.record_source as enum ('ai', 'agent', 'api', 'import');
create type public.external_sync_status as enum ('not_applicable', 'pending', 'synced', 'failed');

create type public.ai_run_status as enum ('running', 'succeeded', 'failed', 'refused', 'blocked_quota');

create type public.billing_interval as enum ('month', 'year', 'one_time');
create type public.payment_provider as enum ('paypal', 'manual', 'stripe');
-- E4 adds `grace` (3 days, platform_settings.subscription_grace_days) between past_due and
-- suspended. `pending_activation` kept (E13).
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'grace', 'suspended', 'canceled', 'expired', 'pending_activation'
);
create type public.transaction_type as enum (
  'subscription_payment', 'connection_fee', 'overage', 'refund', 'manual_adjustment'
);
create type public.transaction_status as enum ('pending', 'completed', 'failed', 'refunded', 'voided');
create type public.manual_request_status as enum ('open', 'contacted', 'activated', 'rejected', 'canceled');
create type public.invoice_status as enum ('draft', 'issued', 'paid', 'void');

create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'dead');
create type public.event_delivery_status as enum ('pending', 'delivered', 'failed', 'skipped');
create type public.actor_type as enum ('user', 'platform_admin', 'system', 'api_key', 'ai');
create type public.webhook_provider as enum ('meta', 'paypal', 'stripe');
create type public.webhook_status as enum ('received', 'processed', 'failed', 'ignored');
create type public.feature_flag_scope as enum ('global', 'workspace');

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Localized text convention: jsonb objects shaped {"ar": "...", "en": "..."}.
create or replace function private.is_i18n_text(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is null
      or (jsonb_typeof(value) = 'object'
          and not exists (
            select 1 from jsonb_each(value) e
            where e.key not in ('ar', 'en') or jsonb_typeof(e.value) <> 'string'
          ));
$$;

-- Generic guard for append-only tables (audit_logs, billing_events, bot_configs, ...).
-- Direct UPDATE/DELETE is rejected. Changes made by foreign-key actions (a parent row
-- deleted → cascade / set null) run at trigger depth > 1 and are allowed, so deleting a
-- workspace (C10 data deletion) still works.
create or replace function private.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;
