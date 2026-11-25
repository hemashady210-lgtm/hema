-- =============================================================================
-- 0001 · Extensions, schemas, enums, shared helpers
-- Phase 01: written, NOT applied to any Supabase project.
-- =============================================================================

-- Supabase convention: extensions live in the `extensions` schema.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector   with schema extensions;   -- pgvector
create extension if not exists pg_trgm  with schema extensions;
-- pg_cron / pg_net are enabled in Phase 03 when the worker sweep is built (needs verification
-- of availability on the chosen plan/region).

-- `private` holds SECURITY DEFINER helpers. It is NOT exposed through PostgREST
-- (only `public` and `graphql_public` are in the exposed-schemas list by default).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Enums (stable, low-cardinality vocabularies only; anything plan-related is data)
-- -----------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'agent', 'viewer');
create type public.workspace_status as enum ('active', 'read_only', 'suspended', 'pending_deletion');
create type public.platform_role as enum ('super_admin', 'support');
create type public.member_status as enum ('active', 'disabled');

create type public.channel_type as enum ('widget', 'whatsapp', 'messenger', 'instagram');
create type public.channel_status as enum (
  'not_connected', 'pending', 'in_progress', 'connected', 'error', 'disconnected', 'rejected'
);
create type public.connection_method as enum ('automatic', 'manual', 'embedded_signup');
create type public.connection_request_status as enum (
  'pending', 'in_progress', 'completed', 'rejected', 'canceled'
);

create type public.conversation_status as enum ('open', 'pending_handoff', 'human', 'closed');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.sender_type as enum ('contact', 'ai', 'agent', 'system');
create type public.message_content_type as enum (
  'text', 'image', 'audio', 'video', 'file', 'location', 'template', 'interactive', 'system_event'
);
create type public.delivery_status as enum ('received', 'queued', 'sent', 'delivered', 'read', 'failed');
create type public.handoff_status as enum ('requested', 'assigned', 'resolved', 'canceled');

create type public.knowledge_source_type as enum ('business_info', 'qa', 'catalog', 'file', 'url');
create type public.processing_status as enum ('pending', 'processing', 'ready', 'failed');

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
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'suspended', 'canceled', 'expired', 'pending_activation'
);
create type public.transaction_type as enum (
  'subscription_payment', 'connection_fee', 'overage', 'refund', 'manual_adjustment'
);
create type public.transaction_status as enum ('pending', 'completed', 'failed', 'refunded', 'voided');
create type public.manual_request_status as enum ('open', 'contacted', 'activated', 'rejected', 'canceled');

create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'dead');
create type public.event_delivery_status as enum ('pending', 'delivered', 'failed', 'skipped');
create type public.actor_type as enum ('user', 'platform_admin', 'system', 'api_key', 'ai');

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
