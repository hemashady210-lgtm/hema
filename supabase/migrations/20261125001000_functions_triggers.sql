-- =============================================================================
-- 0010 · Business-rule functions and triggers
--   * entitlement resolution (override → plan → default)
--   * plan-limit enforcement in the database (proposal P4)
--   * AI-reply metering: consume / release (atomic, idempotent), 80 % / 100 % alerts
--   * job queue: enqueue / claim (SKIP LOCKED) / complete / fail with backoff
--   * hybrid retrieval: pgvector + full-text with reciprocal-rank fusion
--   * bookkeeping triggers (order numbers, inbound counters, previews, re-embedding)
-- All functions: SECURITY DEFINER where needed, empty search_path, schema-qualified names.
-- P2: renamed objects (E9), `grace` (E4), channel statuses (E5), test runs never billed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Entitlements
-- -----------------------------------------------------------------------------
create or replace function private.live_subscription(p_workspace_id uuid)
returns public.subscriptions
language sql stable security definer set search_path = ''
as $$
  select s.* from public.subscriptions s
  where s.workspace_id = p_workspace_id
    and s.status in ('trialing', 'active', 'past_due', 'grace', 'suspended', 'pending_activation')
  order by s.created_at desc
  limit 1;
$$;

create or replace function private.get_entitlement(p_workspace_id uuid, p_key text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_value jsonb;
  v_plan_id uuid;
begin
  select o.value into v_value
  from public.workspace_entitlement_overrides o
  where o.workspace_id = p_workspace_id and o.key = p_key
    and (o.expires_at is null or o.expires_at > now());
  if found then return v_value; end if;

  select s.plan_id into v_plan_id from private.live_subscription(p_workspace_id) s;
  if v_plan_id is not null then
    select pe.value into v_value from public.plan_entitlements pe
    where pe.plan_id = v_plan_id and pe.key = p_key;
    if found then return v_value; end if;
  end if;

  select d.default_value into v_value from public.entitlement_definitions d where d.key = p_key;
  if not found then
    raise exception 'unknown entitlement key: %', p_key using errcode = '22023';
  end if;
  return v_value;
end;
$$;

-- Integer limit; NULL means unlimited.
create or replace function private.entitlement_int(p_workspace_id uuid, p_key text)
returns integer
language sql stable security definer set search_path = ''
as $$
  select case when v = 'null'::jsonb then null else (v #>> '{}')::integer end
  from private.get_entitlement(p_workspace_id, p_key) as v;
$$;

create or replace function private.entitlement_bool(p_workspace_id uuid, p_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((private.get_entitlement(p_workspace_id, p_key) #>> '{}')::boolean, false);
$$;

-- Dashboard helper: all effective entitlements for one workspace (members only).
create or replace function public.get_workspace_entitlements(p_workspace_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_result jsonb := '{}'::jsonb;
  r record;
begin
  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  for r in select d.key from public.entitlement_definitions d loop
    v_result := v_result || jsonb_build_object(r.key, private.get_entitlement(p_workspace_id, r.key));
  end loop;
  return v_result;
end;
$$;
revoke all on function public.get_workspace_entitlements(uuid) from public, anon;
grant execute on function public.get_workspace_entitlements(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Limit enforcement (raises SQLSTATE P0001 with a machine-readable message prefix
-- 'plan_limit:' or 'plan_feature:' that the API maps to HTTP 402 + upgrade prompt).
-- -----------------------------------------------------------------------------
create or replace function private.assert_feature(p_workspace_id uuid, p_key text)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.entitlement_bool(p_workspace_id, p_key) then
    raise exception 'plan_feature:%', p_key using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.assert_limit(p_workspace_id uuid, p_key text, p_current_count bigint)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_limit integer := private.entitlement_int(p_workspace_id, p_key);
begin
  if v_limit is not null and p_current_count >= v_limit then
    raise exception 'plan_limit:%:%', p_key, v_limit using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.enforce_bot_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
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
create trigger bots_enforce_limits before insert or update on public.bots
  for each row execute function private.enforce_bot_limits();

create or replace function private.enforce_member_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    perform private.assert_limit(new.workspace_id, 'max_users',
      (select count(*) from public.workspace_members m
       where m.workspace_id = new.workspace_id and m.status = 'active'));
  end if;
  return new;
end;
$$;
create trigger workspace_members_enforce_limit before insert or update on public.workspace_members
  for each row execute function private.enforce_member_limit();

create or replace function private.enforce_branch_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_feature(new.workspace_id, 'multi_branch');
  perform private.assert_limit(new.workspace_id, 'max_branches',
    (select count(*) from public.branches b where b.workspace_id = new.workspace_id));
  return new;
end;
$$;
create trigger branches_enforce_limit before insert on public.branches
  for each row execute function private.enforce_branch_limit();

-- Channel types allowed by plan + Meta channel count (proposal P13).
-- "Occupying" statuses: anything except not_connected (E5), plus open requests.
create or replace function private.assert_channel_allowed(
  p_workspace_id uuid, p_channel_type public.channel_type, p_exclude_channel uuid
)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_allowed jsonb := private.get_entitlement(p_workspace_id, 'allowed_channel_types');
begin
  if not (v_allowed ? p_channel_type::text) then
    raise exception 'plan_feature:channel_%', p_channel_type using errcode = 'P0001';
  end if;
  if p_channel_type <> 'widget' then
    perform private.assert_limit(p_workspace_id, 'max_meta_channels',
      (select count(*) from public.channels c
       where c.workspace_id = p_workspace_id
         and c.channel_type <> 'widget'
         and c.status <> 'not_connected'
         and c.id is distinct from p_exclude_channel)
      + (select count(*) from public.channel_connection_requests r
         where r.workspace_id = p_workspace_id
           and r.status in ('pending', 'in_progress')
           and r.channel_id is null));
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
    perform private.assert_channel_allowed(new.workspace_id, new.channel_type, new.id);
  end if;
  return new;
end;
$$;
create trigger channels_enforce_limit before insert or update on public.channels
  for each row execute function private.enforce_channel_limit();

create or replace function private.enforce_channel_request_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_channel_allowed(new.workspace_id, new.channel_type, null);
  return new;
end;
$$;
create trigger channel_connection_requests_enforce_limit before insert on public.channel_connection_requests
  for each row execute function private.enforce_channel_request_limit();

create or replace function private.enforce_feature_on_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_feature(new.workspace_id, tg_argv[0]);
  return new;
end;
$$;
create trigger orders_require_feature before insert on public.orders
  for each row execute function private.enforce_feature_on_insert('orders');
create trigger reservations_require_feature before insert on public.reservations
  for each row execute function private.enforce_feature_on_insert('reservations');
create trigger handoffs_require_feature before insert on public.handoffs
  for each row execute function private.enforce_feature_on_insert('human_handoff');
create trigger api_keys_require_feature before insert on public.api_keys
  for each row execute function private.enforce_feature_on_insert('api_access');

-- -----------------------------------------------------------------------------
-- Usage periods (monthly, anchored to the subscription — proposal P11)
-- -----------------------------------------------------------------------------
create or replace function private.ensure_usage_period(p_workspace_id uuid)
returns public.usage_periods
language plpgsql security definer set search_path = ''
as $$
declare
  v_period public.usage_periods;
  v_sub    public.subscriptions;
  v_anchor timestamptz;
  v_start  timestamptz;
  v_end    timestamptz;
  v_months integer;
begin
  select * into v_period from public.usage_periods p
  where p.workspace_id = p_workspace_id and p.period_start <= now() and p.period_end > now()
  order by p.period_start desc limit 1;
  if found then return v_period; end if;

  v_sub := private.live_subscription(p_workspace_id);
  if v_sub.id is null then
    raise exception 'no_live_subscription' using errcode = 'P0001';
  end if;

  if v_sub.status = 'trialing' then
    -- Trial = one period: start → trial_ends_at (100 replies total, decision B).
    v_start := v_sub.created_at;
    v_end   := v_sub.trial_ends_at;
  else
    v_anchor := coalesce(v_sub.current_period_start, v_sub.created_at);
    v_months := greatest(0,
      (extract(year from age(now(), v_anchor)) * 12 + extract(month from age(now(), v_anchor)))::integer);
    v_start := v_anchor + make_interval(months => v_months);
    v_end   := v_anchor + make_interval(months => v_months + 1);
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
  on conflict (workspace_id, period_start) do nothing;

  select * into v_period from public.usage_periods p
  where p.workspace_id = p_workspace_id and p.period_start = v_start;
  return v_period;
end;
$$;

-- -----------------------------------------------------------------------------
-- AI-reply metering. Called by the worker (service role) BEFORE calling the model;
-- released if generation/delivery fails. Idempotent per key (e.g. 'ai_reply:<message_id>').
-- -----------------------------------------------------------------------------
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
  v_ws      public.workspaces;
  v_sub     public.subscriptions;
  v_period  public.usage_periods;
  v_over    boolean := false;
  v_total   integer;
  v_pct     integer;
  v_existing public.usage_events;
  t         integer;
begin
  -- Idempotent replay
  select * into v_existing from public.usage_events e where e.idempotency_key = p_idempotency_key;
  if found then
    select * into v_period from public.usage_periods p where p.id = v_existing.usage_period_id;
    return query select true, 'already_reserved'::text, v_existing.is_overage, v_period.id,
                        v_period.ai_replies_used + v_period.overage_replies, v_period.ai_replies_included;
    return;
  end if;

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
  -- `grace` (E4) keeps service running until suspension.
  if v_sub.id is null or v_sub.status not in ('trialing', 'active', 'past_due', 'grace') then
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
  values (p_workspace_id, v_period.id, 'ai_reply_reserved', 1, v_over, p_ai_run_id, p_idempotency_key);

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

create or replace function public.release_ai_reply(p_idempotency_key text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.usage_events;
begin
  select * into v_event from public.usage_events e
  where e.idempotency_key = p_idempotency_key and e.kind = 'ai_reply_reserved';
  if not found then return false; end if;

  insert into public.usage_events (workspace_id, usage_period_id, kind, quantity, is_overage, ai_run_id, idempotency_key)
  values (v_event.workspace_id, v_event.usage_period_id, 'ai_reply_released', -1, v_event.is_overage,
          v_event.ai_run_id, p_idempotency_key || ':released')
  on conflict (idempotency_key) do nothing;
  if not found then return false; end if;   -- already released

  update public.usage_periods p
     set ai_replies_used = p.ai_replies_used - (case when v_event.is_overage then 0 else 1 end),
         overage_replies = p.overage_replies - (case when v_event.is_overage then 1 else 0 end)
   where p.id = v_event.usage_period_id;
  return true;
end;
$$;

revoke all on function public.consume_ai_reply(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.release_ai_reply(text) from public, anon, authenticated;
grant execute on function public.consume_ai_reply(uuid, text, uuid) to service_role;
grant execute on function public.release_ai_reply(text) to service_role;

-- -----------------------------------------------------------------------------
-- Job queue
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_job(
  p_type text,
  p_payload jsonb default '{}'::jsonb,
  p_workspace_id uuid default null,
  p_queue text default 'default',
  p_run_at timestamptz default now(),
  p_idempotency_key text default null,
  p_priority smallint default 100
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.jobs (type, payload, workspace_id, queue, run_at, idempotency_key, priority)
  values (p_type, p_payload, p_workspace_id, p_queue, p_run_at, p_idempotency_key, p_priority)
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  return v_id;  -- null when de-duplicated
end;
$$;

create or replace function public.claim_jobs(
  p_queue text,
  p_worker_id text,
  p_limit integer default 5,
  p_lock_seconds integer default 120
)
returns setof public.jobs
language sql security definer set search_path = ''
as $$
  update public.jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         locked_at = now(),
         locked_by = p_worker_id,
         lock_expires_at = now() + make_interval(secs => p_lock_seconds)
   where j.id in (
     select q.id from public.jobs q
      where q.status = 'queued' and q.queue = p_queue and q.run_at <= now()
      order by q.priority, q.run_at, q.id
      limit greatest(1, least(p_limit, 50))
      for update skip locked
   )
  returning j.*;
$$;

create or replace function public.complete_job(p_job_id bigint)
returns void
language sql security definer set search_path = ''
as $$
  update public.jobs
     set status = 'succeeded', finished_at = now(), locked_at = null, lock_expires_at = null
   where id = p_job_id and status = 'running';
$$;

-- Exponential backoff: 15 s, 30 s, 60 s, ... capped at 1 h; 'dead' after max_attempts.
create or replace function public.fail_job(p_job_id bigint, p_error text, p_retryable boolean default true)
returns void
language sql security definer set search_path = ''
as $$
  update public.jobs
     set status = case when not p_retryable or attempts >= max_attempts then 'dead'::public.job_status
                       else 'queued'::public.job_status end,
         run_at = now() + least(interval '1 hour', interval '15 seconds' * power(2, greatest(attempts - 1, 0))),
         last_error = left(p_error, 4000),
         locked_at = null, locked_by = null, lock_expires_at = null,
         finished_at = case when not p_retryable or attempts >= max_attempts then now() else null end
   where id = p_job_id and status = 'running';
$$;

-- Re-queue jobs whose worker died (visibility timeout passed). Run by the cron sweep.
create or replace function public.requeue_stuck_jobs()
returns integer
language sql security definer set search_path = ''
as $$
  with r as (
    update public.jobs
       set status = case when attempts >= max_attempts then 'dead'::public.job_status else 'queued'::public.job_status end,
           last_error = coalesce(last_error, '') || ' [lock expired]',
           locked_at = null, locked_by = null, lock_expires_at = null
     where status = 'running' and lock_expires_at < now()
    returning 1
  )
  select count(*)::integer from r;
$$;

revoke all on function public.enqueue_job(text, jsonb, uuid, text, timestamptz, text, smallint) from public, anon, authenticated;
revoke all on function public.claim_jobs(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_job(bigint) from public, anon, authenticated;
revoke all on function public.fail_job(bigint, text, boolean) from public, anon, authenticated;
revoke all on function public.requeue_stuck_jobs() from public, anon, authenticated;
grant execute on function public.enqueue_job(text, jsonb, uuid, text, timestamptz, text, smallint) to service_role;
grant execute on function public.claim_jobs(text, text, integer, integer) to service_role;
grant execute on function public.complete_job(bigint) to service_role;
grant execute on function public.fail_job(bigint, text, boolean) to service_role;
grant execute on function public.requeue_stuck_jobs() to service_role;

-- -----------------------------------------------------------------------------
-- Hybrid retrieval (vector + full-text, reciprocal-rank fusion, k = 60).
-- Always scoped to one workspace; bot-specific + workspace-shared chunks.
-- -----------------------------------------------------------------------------
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
  with scope as (
    select c.* from public.kb_chunks c
    where c.workspace_id = p_workspace_id
      and (c.bot_id is null or c.bot_id = p_bot_id)
  ),
  vec as (
    select s.id,
           1 - (s.embedding operator(extensions.<=>) p_query_embedding) as similarity,
           row_number() over (order by s.embedding operator(extensions.<=>) p_query_embedding) as rnk
    from scope s
    where s.embedding is not null
    order by s.embedding operator(extensions.<=>) p_query_embedding
    limit p_candidates
  ),
  lex as (
    select s.id,
           row_number() over (order by ts_rank_cd(s.fts, q.query) desc) as rnk
    from scope s, websearch_to_tsquery('simple', coalesce(p_query_text, '')) as q(query)
    where s.fts @@ q.query
    order by ts_rank_cd(s.fts, q.query) desc
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
revoke all on function public.match_kb_chunks(uuid, uuid, extensions.vector, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.match_kb_chunks(uuid, uuid, extensions.vector, text, integer, integer)
  to service_role;

-- -----------------------------------------------------------------------------
-- Bookkeeping triggers
-- -----------------------------------------------------------------------------

-- Per-workspace order numbers (1, 2, 3, ...).
create or replace function private.assign_order_number()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('order_number:' || new.workspace_id::text, 0));
  select coalesce(max(o.order_number), 0) + 1 into new.order_number
  from public.orders o where o.workspace_id = new.workspace_id;
  return new;
end;
$$;
create trigger orders_assign_number before insert on public.orders
  for each row when (new.order_number is null)
  execute function private.assign_order_number();

-- Conversation timestamps + preview + inbound analytics counter (inbound is free — B).
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
     where p.workspace_id = new.workspace_id
       and p.period_start <= new.created_at and p.period_end > new.created_at;
  end if;
  return null;
end;
$$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function private.on_message_inserted();

-- Re-embed knowledge when structured sources change. Debounced: one job per workspace +
-- kind per 30-second window, scheduled 30 s later so bulk edits collapse into one run.
create or replace function private.enqueue_reindex()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ws uuid := coalesce(new.workspace_id, old.workspace_id);
  v_bucket bigint := floor(extract(epoch from now()) / 30);
begin
  perform public.enqueue_job(
    'reindex_structured_knowledge',
    jsonb_build_object('workspace_id', v_ws, 'kind', tg_argv[0]),
    v_ws, 'default', now() + interval '30 seconds',
    'reindex:' || v_ws::text || ':' || tg_argv[0] || ':' || v_bucket::text);
  return null;
end;
$$;
-- Kinds = kb_source_type values of the structured sources.
create trigger faqs_reindex after insert or update or delete on public.faqs
  for each row execute function private.enqueue_reindex('faq');
create trigger catalog_items_reindex after insert or update or delete on public.catalog_items
  for each row execute function private.enqueue_reindex('catalog');
create trigger business_profiles_reindex after insert or update or delete on public.business_profiles
  for each row execute function private.enqueue_reindex('profile');

-- A conversation can only be assigned to an active owner/admin/agent of its workspace.
create or replace function private.check_conversation_assignee()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and not exists (
       select 1 from public.workspace_members m
       where m.workspace_id = new.workspace_id and m.user_id = new.assigned_to
         and m.status = 'active' and m.role in ('owner', 'admin', 'agent')) then
    raise exception 'assignee is not an active agent of this workspace' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger conversations_check_assignee before insert or update of assigned_to on public.conversations
  for each row execute function private.check_conversation_assignee();

-- Lock down private helpers: clients only need the RLS helpers (used inside policies).
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_workspace_member(uuid),
  private.has_workspace_role(uuid, public.workspace_role[]),
  private.workspace_is_writable(uuid),
  private.can_write(uuid, public.workspace_role[]),
  private.is_platform_admin(),
  private.is_i18n_text(jsonb)
  to authenticated;
grant execute on all functions in schema private to service_role;
