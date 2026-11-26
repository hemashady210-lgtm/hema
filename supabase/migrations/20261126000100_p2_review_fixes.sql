-- =============================================================================
-- 0013 · P2 review fixes (code-reviewer + security-reviewer, 2026-11-26)
-- Forward migration: 0001–0012 are applied to the dev project and frozen.
--   1. Workspace hard delete works with real data (re-index trigger skipped workspaces).
--   2. Plan limits are race-safe (advisory lock per workspace + key) — DECISIONS P4.
--   3. Limit triggers no longer leak another tenant's plan (client write check first).
--   4. Rows cannot move between workspaces (workspace_id immutable).
--   5. Entitlements / usage only from an entitling subscription (pending_activation no
--      longer unlocks a paid plan); one pending row allowed beside the live one.
--   6. Usage periods: per subscription, open only; month-end anchors fixed.
--   7. AI metering: a released reply is re-reserved (never free); replays check workspace.
--   8. Manual Meta connect: the request being fulfilled no longer counts twice.
--   9. Bots cannot be deleted by clients (would wipe channels, tokens, conversations).
--  10. Human takeover requires the `human_handoff` entitlement.
--  11. File KB sources cannot be deleted by clients (storage cleanup runs in `api`).
--  12. Storage: no client SELECT on private buckets (no self-minted long-lived signed URLs).
--  13. Disconnecting a channel deletes its credential + Vault secret.
--  14. Hardening: privilege sweep, size caps, path scoping, currency format, i18n
--      non-empty / bilingual platform strings, kb_chunks bot FK, invoice FK, bot_configs
--      delete guard, queue worker ownership, stuck-job bookkeeping, HNSW-friendly retrieval.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Re-indexing never runs for a workspace that no longer exists (cascade delete).
-- ---------------------------------------------------------------------------
create or replace function private.enqueue_reindex()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ws uuid := coalesce(new.workspace_id, old.workspace_id);
  v_bucket bigint := floor(extract(epoch from now()) / 30);
begin
  if not exists (select 1 from public.workspaces w where w.id = v_ws) then
    return null;   -- the workspace is being deleted: nothing to re-index
  end if;
  perform public.enqueue_job(
    'reindex_structured_knowledge',
    jsonb_build_object('workspace_id', v_ws, 'kind', tg_argv[0]),
    v_ws, 'default', now() + interval '30 seconds',
    'reindex:' || v_ws::text || ':' || tg_argv[0] || ':' || v_bucket::text);
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2 + 3. Helpers: client write check (same rule as the RLS policy, evaluated BEFORE the
-- limit checks so errors never reveal another tenant's plan) and per-limit locks.
-- ---------------------------------------------------------------------------
create or replace function private.assert_client_can_write(
  p_workspace_id uuid,
  p_roles public.workspace_role[] default array['owner', 'admin']::public.workspace_role[]
)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  -- current_setting('role') is the caller's role (PostgREST: authenticated / anon /
  -- service_role) even inside SECURITY DEFINER code; direct SQL sessions report 'none'.
  if current_setting('role', true) = 'authenticated' and not private.can_write(p_workspace_id, p_roles) then
    raise exception 'new row violates row-level security policy' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.lock_limit(p_workspace_id uuid, p_key text)
returns void
language sql volatile set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('limit:' || p_key || ':' || p_workspace_id::text, 0));
$$;

create or replace function private.enforce_bot_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_client_can_write(new.workspace_id);
  if tg_op = 'INSERT' then
    perform private.lock_limit(new.workspace_id, 'max_bots');
    perform private.assert_limit(new.workspace_id, 'max_bots',
      (select count(*) from public.bots b where b.workspace_id = new.workspace_id));
  end if;
  if new.handoff_enabled and (tg_op = 'INSERT' or not old.handoff_enabled) then
    perform private.assert_feature(new.workspace_id, 'human_handoff');
  end if;
  if new.orders_enabled and (tg_op = 'INSERT' or not old.orders_enabled) then
    perform private.assert_feature(new.workspace_id, 'orders');
  end if;
  if new.reservations_enabled and (tg_op = 'INSERT' or not old.reservations_enabled) then
    perform private.assert_feature(new.workspace_id, 'reservations');
  end if;
  return new;
end;
$$;

create or replace function private.enforce_member_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    perform private.lock_limit(new.workspace_id, 'max_users');
    perform private.assert_limit(new.workspace_id, 'max_users',
      (select count(*) from public.workspace_members m
       where m.workspace_id = new.workspace_id and m.status = 'active'));
  end if;
  return new;
end;
$$;

create or replace function private.enforce_branch_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_client_can_write(new.workspace_id);
  perform private.assert_feature(new.workspace_id, 'multi_branch');
  perform private.lock_limit(new.workspace_id, 'max_branches');
  perform private.assert_limit(new.workspace_id, 'max_branches',
    (select count(*) from public.branches b where b.workspace_id = new.workspace_id));
  return new;
end;
$$;

-- 8. Meta channel count. When a channel is created for (bot, type), one open request for
-- the same (bot, type) is the request it fulfils and is not counted a second time.
create or replace function private.assert_channel_allowed(
  p_workspace_id uuid, p_channel_type public.channel_type, p_exclude_channel uuid, p_bot_id uuid
)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_allowed    jsonb := private.get_entitlement(p_workspace_id, 'allowed_channel_types');
  v_requests   bigint;
  v_fulfilling bigint;
begin
  if not (v_allowed ? p_channel_type::text) then
    raise exception 'plan_feature:channel_%', p_channel_type using errcode = 'P0001';
  end if;
  if p_channel_type <> 'widget' then
    select count(*),
           count(*) filter (where r.bot_id = p_bot_id and r.channel_type = p_channel_type)
      into v_requests, v_fulfilling
      from public.channel_connection_requests r
     where r.workspace_id = p_workspace_id
       and r.status in ('pending', 'in_progress')
       and r.channel_id is null;
    perform private.assert_limit(p_workspace_id, 'max_meta_channels',
      (select count(*) from public.channels c
       where c.workspace_id = p_workspace_id
         and c.channel_type <> 'widget'
         and c.status <> 'not_connected'
         and c.id is distinct from p_exclude_channel)
      + v_requests - least(v_fulfilling, 1));
  end if;
end;
$$;

create or replace function private.enforce_channel_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status <> 'not_connected'
     and (tg_op = 'INSERT' or old.status = 'not_connected') then
    perform private.lock_limit(new.workspace_id, 'max_meta_channels');
    perform private.assert_channel_allowed(new.workspace_id, new.channel_type, new.id, new.bot_id);
  end if;
  return new;
end;
$$;

create or replace function private.enforce_channel_request_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.lock_limit(new.workspace_id, 'max_meta_channels');
  perform private.assert_channel_allowed(new.workspace_id, new.channel_type, null, null);
  return new;
end;
$$;

drop function private.assert_channel_allowed(uuid, public.channel_type, uuid);

create or replace function private.assign_bot_config_version()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_client_can_write(new.workspace_id);
  perform pg_advisory_xact_lock(hashtextextended('bot_config:' || new.bot_id::text, 0));
  select coalesce(max(c.version), 0) + 1 into new.version
  from public.bot_configs c where c.bot_id = new.bot_id;
  new.created_by := coalesce((select auth.uid()), new.created_by);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. workspace_id is immutable on every tenant table (no moving rows between tenants).
-- ---------------------------------------------------------------------------
create or replace function private.prevent_workspace_change()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id is immutable on %', tg_table_name using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'workspace_id'
                       and not a.attisdropped and a.attnotnull
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
  loop
    execute format(
      'create trigger %I before update of workspace_id on public.%I
         for each row execute function private.prevent_workspace_change()',
      r.relname || '_workspace_immutable', r.relname);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Entitling subscription = trialing / active / past_due / grace. A pending_activation
-- row (PayPal approval or manual payment awaiting admin) never grants its plan; the trial
-- or current plan stays in force until a verified activation (BILLING §5.1).
-- ---------------------------------------------------------------------------
create or replace function private.live_subscription(p_workspace_id uuid)
returns public.subscriptions
language sql stable security definer set search_path = ''
as $$
  select s.* from public.subscriptions s
  where s.workspace_id = p_workspace_id
    and s.status in ('trialing', 'active', 'past_due', 'grace')
  order by s.created_at desc
  limit 1;
$$;

drop index public.subscriptions_one_live_per_workspace;
create unique index subscriptions_one_live_per_workspace on public.subscriptions (workspace_id)
  where status in ('trialing', 'active', 'past_due', 'grace', 'suspended');
create unique index subscriptions_one_pending_per_workspace on public.subscriptions (workspace_id)
  where status = 'pending_activation';

-- ---------------------------------------------------------------------------
-- 6. Usage periods: monthly bounds computed in UTC, never ending in the past (month-end
-- anchors such as Jan 31), and resolved per subscription (an upgrade opens a new period).
-- ---------------------------------------------------------------------------
create or replace function private.monthly_period_bounds(
  p_anchor timestamptz, p_at timestamptz,
  out period_start timestamptz, out period_end timestamptz
)
language plpgsql immutable set search_path = ''
as $$
declare
  v_anchor timestamp := p_anchor at time zone 'UTC';
  v_at     timestamp := p_at at time zone 'UTC';
  v_months integer;
begin
  v_months := greatest(0,
    (extract(year from age(v_at, v_anchor)) * 12 + extract(month from age(v_at, v_anchor)))::integer);
  period_start := (v_anchor + make_interval(months => v_months)) at time zone 'UTC';
  period_end   := (v_anchor + make_interval(months => v_months + 1)) at time zone 'UTC';
  while period_end <= p_at loop
    v_months := v_months + 1;
    period_start := (v_anchor + make_interval(months => v_months)) at time zone 'UTC';
    period_end   := (v_anchor + make_interval(months => v_months + 1)) at time zone 'UTC';
  end loop;
end;
$$;

-- A period belongs to one subscription: two subscriptions may start a period at the same
-- instant (upgrade), so uniqueness is per subscription.
alter table public.usage_periods drop constraint usage_periods_workspace_id_period_start_key;
alter table public.usage_periods add constraint usage_periods_subscription_period_key
  unique (workspace_id, subscription_id, period_start);

create or replace function private.ensure_usage_period(p_workspace_id uuid)
returns public.usage_periods
language plpgsql security definer set search_path = ''
as $$
declare
  v_period public.usage_periods;
  v_sub    public.subscriptions;
  v_start  timestamptz;
  v_end    timestamptz;
begin
  v_sub := private.live_subscription(p_workspace_id);
  if v_sub.id is null then
    raise exception 'no_live_subscription' using errcode = 'P0001';
  end if;

  select * into v_period from public.usage_periods p
  where p.workspace_id = p_workspace_id and p.subscription_id = v_sub.id and p.closed_at is null
    and p.period_start <= now() and p.period_end > now()
  order by p.period_start desc limit 1;
  if found then return v_period; end if;

  if v_sub.status = 'trialing' then
    -- Trial = one period: start → trial_ends_at (100 replies total, decision B).
    v_start := v_sub.created_at;
    v_end   := v_sub.trial_ends_at;
  else
    select b.period_start, b.period_end into v_start, v_end
    from private.monthly_period_bounds(coalesce(v_sub.current_period_start, v_sub.created_at), now()) b;
  end if;

  insert into public.usage_periods (
    workspace_id, subscription_id, period_start, period_end,
    ai_replies_included, overage_allowed, overage_unit_size, overage_unit_price_cents)
  values (
    p_workspace_id, v_sub.id, v_start, v_end,
    private.entitlement_int(p_workspace_id, 'ai_replies_per_period'),
    private.entitlement_bool(p_workspace_id, 'overage_enabled'),
    private.entitlement_int(p_workspace_id, 'overage_unit_size'),
    private.entitlement_int(p_workspace_id, 'overage_unit_price_cents'))
  on conflict (workspace_id, subscription_id, period_start) do nothing;

  select * into v_period from public.usage_periods p
  where p.workspace_id = p_workspace_id and p.period_start = v_start and p.subscription_id = v_sub.id;
  if not found then
    raise exception 'usage_period_conflict' using errcode = 'P0001';
  end if;
  return v_period;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. AI-reply metering. One idempotency key = one logical reply. Attempt n is booked under
-- `<key>` (n = 1) or `<key>:r<n>`; a release books `<attempt key>:released`. Consuming a key
-- whose latest attempt was released reserves a new attempt with the full checks, so a retry
-- after a failure is always metered again. Calls for the same key are serialized.
-- ---------------------------------------------------------------------------
create or replace function private.ai_reply_attempt_key(p_key text, p_attempt integer)
returns text
language sql immutable set search_path = ''
as $$
  select case when p_attempt <= 1 then p_key else p_key || ':r' || p_attempt::text end;
$$;

create or replace function public.consume_ai_reply(
  p_workspace_id uuid,
  p_idempotency_key text,
  p_ai_run_id uuid default null
)
returns table (
  allowed boolean, reason text, is_overage boolean,
  usage_period_id uuid, used integer, included integer
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_ws       public.workspaces;
  v_sub      public.subscriptions;
  v_period   public.usage_periods;
  v_over     boolean := false;
  v_total    integer;
  v_pct      integer;
  v_existing public.usage_events;
  v_attempt  integer := 1;
  v_key      text;
  t          integer;
begin
  if coalesce(p_idempotency_key, '') = '' or p_idempotency_key ~ ':(released|r[0-9]+)$' then
    return query select false, 'invalid_idempotency_key'::text, false, null::uuid, null::integer, null::integer;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ai_reply:' || p_idempotency_key, 0));

  -- Find the latest attempt for this key.
  loop
    v_key := private.ai_reply_attempt_key(p_idempotency_key, v_attempt);
    select * into v_existing from public.usage_events e
    where e.idempotency_key = v_key and e.kind = 'ai_reply_reserved';
    exit when not found;
    if v_existing.workspace_id <> p_workspace_id then
      return query select false, 'idempotency_key_conflict'::text, false, null::uuid, null::integer, null::integer;
      return;
    end if;
    if not exists (select 1 from public.usage_events e where e.idempotency_key = v_key || ':released') then
      -- Active reservation: idempotent replay, nothing is counted twice.
      select * into v_period from public.usage_periods p where p.id = v_existing.usage_period_id;
      return query select true, 'already_reserved'::text, v_existing.is_overage, v_period.id,
                          v_period.ai_replies_used + v_period.overage_replies, v_period.ai_replies_included;
      return;
    end if;
    v_attempt := v_attempt + 1;   -- released: the next attempt is a new reservation
  end loop;

  select * into v_ws from public.workspaces w where w.id = p_workspace_id;
  if v_ws.id is null or v_ws.status <> 'active' or v_ws.deleted_at is not null then
    return query select false, 'workspace_inactive'::text, false, null::uuid, null::integer, null::integer;
    return;
  end if;

  -- Playground / readiness runs are never billed (§13); the run must belong to the workspace.
  if p_ai_run_id is not null then
    if not exists (select 1 from public.ai_runs r where r.id = p_ai_run_id and r.workspace_id = p_workspace_id) then
      return query select false, 'ai_run_not_found'::text, false, null::uuid, null::integer, null::integer;
      return;
    end if;
    if exists (select 1 from public.ai_runs r where r.id = p_ai_run_id and r.is_test) then
      return query select false, 'test_run_not_billable'::text, false, null::uuid, null::integer, null::integer;
      return;
    end if;
  end if;

  v_sub := private.live_subscription(p_workspace_id);
  if v_sub.id is null then
    return query select false, 'no_active_subscription'::text, false, null::uuid, null::integer, null::integer;
    return;
  end if;
  if v_sub.status = 'trialing' and v_sub.trial_ends_at <= now() then
    return query select false, 'trial_expired'::text, false, null::uuid, null::integer, null::integer;
    return;
  end if;

  v_period := private.ensure_usage_period(p_workspace_id);
  -- Serialize concurrent reservations for this workspace/period.
  select * into v_period from public.usage_periods p where p.id = v_period.id for update;

  if v_period.ai_replies_included is not null
     and v_period.ai_replies_used >= v_period.ai_replies_included then
    if v_period.overage_allowed then
      v_over := true;
    else
      return query select false,
        (case when v_sub.status = 'trialing' then 'trial_quota_exhausted' else 'quota_exhausted' end)::text,
        false, v_period.id, v_period.ai_replies_used, v_period.ai_replies_included;
      return;
    end if;
  end if;

  update public.usage_periods p
     set ai_replies_used = p.ai_replies_used + (case when v_over then 0 else 1 end),
         overage_replies = p.overage_replies + (case when v_over then 1 else 0 end)
   where p.id = v_period.id
  returning * into v_period;

  insert into public.usage_events (workspace_id, usage_period_id, kind, quantity, is_overage, ai_run_id, idempotency_key)
  values (p_workspace_id, v_period.id, 'ai_reply_reserved', 1, v_over, p_ai_run_id, v_key);

  -- Threshold alerts (80 % / 100 % of included replies), once per period each.
  if v_period.ai_replies_included is not null and v_period.ai_replies_included > 0 then
    v_total := v_period.ai_replies_used + v_period.overage_replies;
    v_pct := (v_total * 100) / v_period.ai_replies_included;
    foreach t in array array[80, 100] loop
      if v_pct >= t then
        insert into public.usage_alerts (usage_period_id, workspace_id, threshold_pct)
        values (v_period.id, p_workspace_id, t)
        on conflict do nothing;
        if found then
          insert into public.platform_events (event_type, workspace_id, payload, email_status)
          values ('usage.threshold_reached', p_workspace_id,
                  jsonb_build_object('threshold_pct', t, 'used', v_total,
                                     'included', v_period.ai_replies_included,
                                     'usage_period_id', v_period.id,
                                     'is_trial', v_sub.status = 'trialing'),
                  'pending');
        end if;
      end if;
    end loop;
  end if;

  return query select true, 'ok'::text, v_over, v_period.id,
                      v_period.ai_replies_used + v_period.overage_replies, v_period.ai_replies_included;
end;
$$;

-- Releases the latest attempt of a key (quota returned). Double release is a no-op.
create or replace function public.release_ai_reply(p_idempotency_key text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_event   public.usage_events;
  v_latest  public.usage_events;
  v_attempt integer := 1;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai_reply:' || coalesce(p_idempotency_key, ''), 0));
  loop
    select * into v_event from public.usage_events e
    where e.idempotency_key = private.ai_reply_attempt_key(p_idempotency_key, v_attempt)
      and e.kind = 'ai_reply_reserved';
    exit when not found;
    v_latest := v_event;
    v_attempt := v_attempt + 1;
  end loop;
  if v_latest.id is null then return false; end if;

  insert into public.usage_events (workspace_id, usage_period_id, kind, quantity, is_overage, ai_run_id, idempotency_key)
  values (v_latest.workspace_id, v_latest.usage_period_id, 'ai_reply_released', -1, v_latest.is_overage,
          v_latest.ai_run_id, v_latest.idempotency_key || ':released')
  on conflict (idempotency_key) do nothing;
  if not found then return false; end if;   -- already released

  update public.usage_periods p
     set ai_replies_used = p.ai_replies_used - (case when v_latest.is_overage then 0 else 1 end),
         overage_replies = p.overage_replies - (case when v_latest.is_overage then 1 else 0 end)
   where p.id = v_latest.usage_period_id;
  return true;
end;
$$;

-- Inbound counter: only the open period that covers the message (no double counting).
create or replace function private.on_message_inserted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversations c
     set last_message_at = new.created_at,
         last_message_preview = case
           when new.content is not null and new.sender <> 'system'
             then left(regexp_replace(new.content, '\s+', ' ', 'g'), 280)
           else c.last_message_preview end,
         last_inbound_at = case when new.direction = 'inbound' then new.created_at else c.last_inbound_at end
   where c.id = new.conversation_id;

  if new.direction = 'inbound' and not new.is_test then
    update public.usage_periods p
       set inbound_messages = p.inbound_messages + 1
     where p.id = (
       select p2.id from public.usage_periods p2
       where p2.workspace_id = new.workspace_id and p2.closed_at is null
         and p2.period_start <= new.created_at and p2.period_end > new.created_at
       order by p2.period_start desc limit 1);
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Bots are deleted through `api` only (cascades would remove channels, credentials,
-- Vault tokens, paid connection requests and conversation history).
-- ---------------------------------------------------------------------------
revoke delete on public.bots from authenticated;

-- ---------------------------------------------------------------------------
-- 10. Taking a conversation over by a human is the `human_handoff` feature (Growth+).
-- ---------------------------------------------------------------------------
create or replace function private.enforce_handoff_feature()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.handler = 'human' and old.handler is distinct from 'human' then
    perform private.assert_feature(new.workspace_id, 'human_handoff');
  end if;
  return new;
end;
$$;
create trigger conversations_handoff_feature before update of handler on public.conversations
  for each row execute function private.enforce_handoff_feature();

-- ---------------------------------------------------------------------------
-- 11. File sources: created and deleted through `api` (storage cleanup + file quota).
-- ---------------------------------------------------------------------------
drop policy kb_sources_write on public.kb_sources;
create policy kb_sources_insert on public.kb_sources for insert to authenticated
  with check (private.can_write(workspace_id) and type <> 'file');
create policy kb_sources_update on public.kb_sources for update to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));
create policy kb_sources_delete on public.kb_sources for delete to authenticated
  using (private.can_write(workspace_id) and type <> 'file');

-- ---------------------------------------------------------------------------
-- 12. Private buckets: no client SELECT. Clients could otherwise mint signed URLs with any
-- expiry and keep access after removal. Downloads go through `api`, which checks
-- membership and issues short-lived signed URLs with the service role.
-- ---------------------------------------------------------------------------
drop policy if exists "members read knowledge files" on storage.objects;
drop policy if exists "members read attachments" on storage.objects;
drop policy if exists "owners read exports" on storage.objects;
-- Public bucket: raster images only (SVG can carry script).
update storage.buckets set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'public-assets';

-- ---------------------------------------------------------------------------
-- 13. Disconnecting a channel removes its credential row (and, by trigger, the Vault secret).
-- ---------------------------------------------------------------------------
create or replace function private.on_channel_disconnected()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'not_connected' and old.status is distinct from 'not_connected' then
    delete from public.channel_credentials c where c.channel_id = new.id;
  end if;
  return null;
end;
$$;
create trigger channels_disconnect_cleanup after update of status on public.channels
  for each row execute function private.on_channel_disconnected();

-- ---------------------------------------------------------------------------
-- 14. Hardening
-- ---------------------------------------------------------------------------

-- Localized text must carry at least one non-empty language; platform-authored strings
-- (plans, products, notifications) must carry both.
create or replace function private.is_i18n_text(value jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select value is null
      or (jsonb_typeof(value) = 'object'
          and not exists (
            select 1 from jsonb_each(value) e
            where e.key not in ('ar', 'en') or jsonb_typeof(e.value) <> 'string')
          and exists (
            select 1 from jsonb_each_text(value) e where btrim(e.value) <> ''));
$$;

create or replace function private.is_i18n_text_full(value jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select private.is_i18n_text(value)
     and value is not null
     and btrim(coalesce(value ->> 'ar', '')) <> ''
     and btrim(coalesce(value ->> 'en', '')) <> '';
$$;

alter table public.plans add constraint plans_name_bilingual check (private.is_i18n_text_full(name));
alter table public.one_time_products add constraint one_time_products_name_bilingual check (private.is_i18n_text_full(name));
alter table public.notifications add constraint notifications_title_bilingual check (private.is_i18n_text_full(title));

-- ISO 4217 codes; amounts are minor units of that currency (3 decimals for KWD/BHD/OMR).
alter table public.catalog_items add constraint catalog_items_currency_iso check (currency ~ '^[A-Z]{3}$');
alter table public.orders add constraint orders_currency_iso check (currency ~ '^[A-Z]{3}$');
alter table public.plan_prices add constraint plan_prices_currency_iso check (currency ~ '^[A-Z]{3}$');
alter table public.one_time_products add constraint one_time_products_currency_iso check (currency ~ '^[A-Z]{3}$');
alter table public.payment_transactions add constraint payment_transactions_currency_iso check (currency ~ '^[A-Z]{3}$');
alter table public.invoices_records add constraint invoices_records_currency_iso check (currency ~ '^[A-Z]{3}$');
alter table public.subscriptions add constraint subscriptions_custom_currency_iso
  check (custom_currency is null or custom_currency ~ '^[A-Z]{3}$');

-- Size caps on client-writable flexible columns.
alter table public.faqs
  add constraint faqs_alt_questions_size check (cardinality(alt_questions) <= 20),
  add constraint faqs_tags_size check (cardinality(tags) <= 20);
alter table public.catalog_items
  add constraint catalog_items_options_size check (octet_length(options::text) <= 20000),
  add constraint catalog_items_attributes_size check (octet_length(attributes::text) <= 10000);
alter table public.business_profiles
  add constraint business_profiles_extra_size check (octet_length(extra::text) <= 10000),
  add constraint business_profiles_social_links_size check (octet_length(social_links::text) <= 4000);
alter table public.workspace_onboarding
  add constraint workspace_onboarding_data_size check (octet_length(data::text) <= 100000);
alter table public.widget_settings
  add constraint widget_settings_theme_size check (octet_length(theme::text) <= 4000),
  add constraint widget_settings_prechat_size check (octet_length(prechat_fields::text) <= 2000),
  add constraint widget_settings_origins_size check (cardinality(allowed_origins) <= 20);
alter table public.customers
  add constraint customers_attributes_size check (octet_length(attributes::text) <= 10000),
  add constraint customers_tags_size check (cardinality(tags) <= 50);
alter table public.bot_configs
  add constraint bot_configs_handoff_rules_size check (octet_length(handoff_rules::text) <= 4000);
alter table public.bot_test_cases
  add constraint bot_test_cases_expected_facts_size check (octet_length(expected_facts::text) <= 20000);

-- Client-writable storage paths stay inside the row's own prefix (public-assets bucket).
alter table public.workspaces add constraint workspaces_logo_path_scope
  check (logo_path is null or logo_path like id::text || '/%');
alter table public.bots add constraint bots_avatar_path_scope
  check (avatar_path is null or avatar_path like workspace_id::text || '/%');
alter table public.catalog_items add constraint catalog_items_image_path_scope
  check (image_path is null or image_path like workspace_id::text || '/%');
alter table public.profiles add constraint profiles_avatar_path_scope
  check (avatar_path is null or avatar_path like 'users/' || id::text || '/%');

-- kb_chunks.bot_id: same-tenant bot only.
alter table public.kb_chunks add constraint kb_chunks_bot_fk
  foreign key (workspace_id, bot_id) references public.bots (workspace_id, id) on delete cascade;

-- invoices_records → usage_periods: an invoiced period cannot be deleted on its own
-- (NO ACTION, checked at statement end, so workspace deletion still cascades).
do $$
declare
  v_name text;
begin
  select conname into v_name from pg_constraint
  where conrelid = 'public.invoices_records'::regclass and contype = 'f'
    and confrelid = 'public.usage_periods'::regclass;
  execute format('alter table public.invoices_records drop constraint %I', v_name);
end;
$$;
alter table public.invoices_records add constraint invoices_records_usage_period_fk
  foreign key (workspace_id, usage_period_id) references public.usage_periods (workspace_id, id);

-- bot_configs versions cannot be deleted either (FK cascades from bot deletion still run).
create trigger bot_configs_no_delete before delete on public.bot_configs
  for each row execute function private.reject_mutation();

-- Queue: a worker can only finish the job it holds; dead jobs get a finish time.
drop function public.complete_job(bigint);
create function public.complete_job(p_job_id bigint, p_worker_id text default null)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update public.jobs
     set status = 'succeeded', finished_at = now(), locked_at = null, lock_expires_at = null
   where id = p_job_id and status = 'running'
     and (p_worker_id is null or locked_by = p_worker_id);
  return found;
end;
$$;

drop function public.fail_job(bigint, text, boolean);
create function public.fail_job(
  p_job_id bigint, p_error text, p_retryable boolean default true, p_worker_id text default null
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update public.jobs
     set status = case when not p_retryable or attempts >= max_attempts then 'dead'::public.job_status
                       else 'queued'::public.job_status end,
         run_at = now() + least(interval '1 hour', interval '15 seconds' * power(2, greatest(attempts - 1, 0))),
         last_error = left(p_error, 4000),
         locked_at = null, locked_by = null, lock_expires_at = null,
         finished_at = case when not p_retryable or attempts >= max_attempts then now() else null end
   where id = p_job_id and status = 'running'
     and (p_worker_id is null or locked_by = p_worker_id);
  return found;
end;
$$;

create or replace function public.requeue_stuck_jobs()
returns integer
language sql security definer set search_path = ''
as $$
  with r as (
    update public.jobs
       set status = case when attempts >= max_attempts then 'dead'::public.job_status else 'queued'::public.job_status end,
           finished_at = case when attempts >= max_attempts then now() else null end,
           last_error = case when coalesce(last_error, '') like '%[lock expired]%' then last_error
                             else ltrim(coalesce(last_error, '') || ' [lock expired]') end,
           locked_at = null, locked_by = null, lock_expires_at = null
     where status = 'running' and lock_expires_at < now()
    returning 1
  )
  select count(*)::integer from r;
$$;

-- Hybrid retrieval without a materialized scope CTE, so the vector ranking can use HNSW.
create or replace function public.match_kb_chunks(
  p_workspace_id uuid,
  p_bot_id uuid,
  p_query_embedding extensions.vector(1024),
  p_query_text text,
  p_match_count integer default 8,
  p_candidates integer default 40
)
returns table (
  id uuid, source_id uuid, document_id uuid, source_type public.kb_source_type, ref_id uuid,
  content text, language text, metadata jsonb,
  similarity double precision, rrf_score double precision
)
language sql stable security definer set search_path = ''
as $$
  with vec as (
    select k.id, k.similarity, row_number() over (order by k.distance) as rnk
    from (
      select c.id,
             c.embedding operator(extensions.<=>) p_query_embedding as distance,
             1 - (c.embedding operator(extensions.<=>) p_query_embedding) as similarity
      from public.kb_chunks c
      where c.workspace_id = p_workspace_id
        and (c.bot_id is null or c.bot_id = p_bot_id)
        and c.embedding is not null
      order by c.embedding operator(extensions.<=>) p_query_embedding
      limit p_candidates
    ) k
  ),
  lex as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, q.query) desc) as rnk
    from public.kb_chunks c, websearch_to_tsquery('simple', coalesce(p_query_text, '')) as q(query)
    where c.workspace_id = p_workspace_id
      and (c.bot_id is null or c.bot_id = p_bot_id)
      and c.fts @@ q.query
    order by ts_rank_cd(c.fts, q.query) desc
    limit p_candidates
  ),
  fused as (
    select coalesce(v.id, l.id) as id,
           v.similarity,
           coalesce(1.0 / (60 + v.rnk), 0) + coalesce(1.0 / (60 + l.rnk), 0) as rrf_score
    from vec v full outer join lex l on l.id = v.id
  )
  select c.id, c.source_id, c.document_id, c.source_type, c.ref_id, c.content, c.language, c.metadata,
         f.similarity, f.rrf_score
  from fused f join public.kb_chunks c on c.id = f.id
  order by f.rrf_score desc
  limit greatest(1, least(p_match_count, 20));
$$;

-- Table privileges clients never need (TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN on PG17+).
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
do $$
begin
  if current_setting('server_version_num')::integer >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privilege sweep (same rule as 0010): nothing for anon, only documented helpers
-- for authenticated, service-role RPCs granted explicitly.
-- ---------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_workspace_entitlements(uuid) to authenticated;
grant execute on function
  public.consume_ai_reply(uuid, text, uuid),
  public.release_ai_reply(text),
  public.enqueue_job(text, jsonb, uuid, text, timestamptz, text, smallint),
  public.claim_jobs(text, text, integer, integer),
  public.complete_job(bigint, text),
  public.fail_job(bigint, text, boolean, text),
  public.requeue_stuck_jobs(),
  public.retry_job(bigint, uuid, text),
  public.match_kb_chunks(uuid, uuid, extensions.vector, text, integer, integer)
  to service_role;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_workspace_member(uuid),
  private.has_workspace_role(uuid, public.workspace_role[]),
  private.workspace_is_writable(uuid),
  private.can_write(uuid, public.workspace_role[]),
  private.is_platform_admin(),
  private.is_i18n_text(jsonb),
  private.is_i18n_text_full(jsonb),   -- used by CHECK constraints on client-updated rows
  private.try_uuid(text),
  private.object_workspace(text)
  to authenticated;
grant execute on all functions in schema private to service_role;
