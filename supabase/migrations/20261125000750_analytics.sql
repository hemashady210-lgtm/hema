-- =============================================================================
-- 0007.5 · Analytics: append-only events (monthly partitions) + daily rollups (§18, gap)
-- Producers (P7): ai-worker / gateways insert events with the service role. The scheduler
-- (P10) rolls them up into analytics_daily every 15 min + nightly reconciliation and runs
-- private.ensure_analytics_partitions() monthly. The dashboard reads rollups only.
-- Playground traffic (`is_test`) never produces analytics events.
-- =============================================================================

create table public.analytics_events (
  id              uuid not null default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  occurred_at     timestamptz not null default now(),
  -- e.g. message.inbound, message.outbound, conversation.opened, order.created,
  -- reservation.created, handoff.requested, ai.reply, ai.escalated, knowledge_gap.logged
  event_type      text not null check (event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  -- Facts, not relations: rows may outlive the entities until retention purges them.
  bot_id          uuid,
  channel_id      uuid,
  conversation_id uuid,
  customer_id     uuid,
  properties      jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  primary key (occurred_at, id)
) partition by range (occurred_at);
create index analytics_events_ws_time_idx on public.analytics_events (workspace_id, occurred_at);
create index analytics_events_type_idx on public.analytics_events (workspace_id, event_type, occurred_at);

-- Partitions live in schema `private` (not exposed by PostgREST). Each partition gets RLS
-- enabled and no client privileges, so it is unreadable even if addressed directly.
create table private.analytics_events_default partition of public.analytics_events default;
alter table private.analytics_events_default enable row level security;
revoke all on private.analytics_events_default from public, anon, authenticated;

-- Creates monthly partitions from the current month back `p_months_back` and forward
-- `p_months_ahead`. Rows that already landed in the default partition for a new month are
-- moved into it. Idempotent. Returns the number of partitions created.
create or replace function private.ensure_analytics_partitions(
  p_months_ahead integer default 3,
  p_months_back integer default 0
)
returns integer
language plpgsql
security definer          -- attaching partitions requires owning the parent table
set search_path = ''
as $$
declare
  v_month  date;
  v_from   timestamptz;
  v_to     timestamptz;
  v_name   text;
  v_made   integer := 0;
begin
  for i in -greatest(p_months_back, 0) .. greatest(p_months_ahead, 0) loop
    v_month := (date_trunc('month', now() at time zone 'UTC') + make_interval(months => i))::date;
    v_from  := v_month::timestamp at time zone 'UTC';
    v_to    := (v_month + interval '1 month')::timestamp at time zone 'UTC';
    v_name  := 'analytics_events_' || to_char(v_month, 'YYYY_MM');
    continue when to_regclass('private.' || v_name) is not null;

    execute format('create temp table __moved on commit drop as
                    select * from private.analytics_events_default
                    where occurred_at >= %L and occurred_at < %L', v_from, v_to);
    execute format('delete from private.analytics_events_default
                    where occurred_at >= %L and occurred_at < %L', v_from, v_to);
    execute format('create table private.%I partition of public.analytics_events
                    for values from (%L) to (%L)', v_name, v_from, v_to);
    execute format('alter table private.%I enable row level security', v_name);
    execute format('revoke all on private.%I from public, anon, authenticated', v_name);
    execute format('insert into private.%I select * from __moved', v_name);
    drop table __moved;
    v_made := v_made + 1;
  end loop;
  return v_made;
end;
$$;
revoke all on function private.ensure_analytics_partitions(integer, integer) from public;
grant execute on function private.ensure_analytics_partitions(integer, integer) to service_role;

select private.ensure_analytics_partitions(3, 1);

-- -----------------------------------------------------------------------------
-- analytics_daily — rollup per workspace and UTC day (§6). Written by the scheduler.
-- -----------------------------------------------------------------------------
create table public.analytics_daily (
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  date             date not null,
  messages_in      integer not null default 0 check (messages_in >= 0),
  messages_out     integer not null default 0 check (messages_out >= 0),
  ai_replies       integer not null default 0 check (ai_replies >= 0),
  conversations    integer not null default 0 check (conversations >= 0),     -- new conversations
  unique_customers integer not null default 0 check (unique_customers >= 0),
  orders           integer not null default 0 check (orders >= 0),
  reservations     integer not null default 0 check (reservations >= 0),
  handoffs         integer not null default 0 check (handoffs >= 0),
  knowledge_gaps   integer not null default 0 check (knowledge_gaps >= 0),
  -- Response time = inbound → outbound (§18): average over `response_samples` pairs.
  avg_response_ms  integer check (avg_response_ms >= 0),
  response_samples integer not null default 0 check (response_samples >= 0),
  -- {"prices": 12, "working_hours": 3, ...} using the question_classifications categories
  category_counts  jsonb not null default '{}'::jsonb check (jsonb_typeof(category_counts) = 'object'),
  computed_at      timestamptz not null default now(),
  primary key (workspace_id, date)
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.analytics_events enable row level security;
alter table public.analytics_daily  enable row level security;

-- Events: service role only.
revoke all on public.analytics_events from anon, authenticated;

-- Rollups: members read (the API gates advanced analytics by entitlement).
create policy analytics_daily_select on public.analytics_daily for select to authenticated
  using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.analytics_daily from anon, authenticated;
