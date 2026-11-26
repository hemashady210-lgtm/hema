-- =============================================================================
-- 0007 · AI model profiles, AI run log, message classification (analytics)
-- =============================================================================

-- Data-driven model selection and routing (decision A15). Plans reference a profile through
-- the entitlement `ai_model_profile` (default 'standard' for every plan); Enterprise contracts
-- may be assigned 'premium' via workspace_entitlement_overrides. Switching a model is a row
-- update, never a code change.
create table public.ai_model_profiles (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,                 -- 'standard' | 'premium'
  provider          text not null default 'anthropic',
  generation_model  text not null,                        -- default model for replies
  classifier_model  text,                                 -- routing + question classification
  -- Model used when a routing trigger fires (null = never escalate)
  escalation_model  text,
  -- {"triggers":["complaint","low_confidence","complex_multi_step"],
  --  "min_confidence":0.6, "max_escalation_rate_alert":0.30}
  escalation_config jsonb not null default '{}'::jsonb,
  effort            text not null default 'low' check (effort in ('low', 'medium', 'high', 'xhigh', 'max')),
  max_output_tokens integer not null default 1024 check (max_output_tokens > 0),
  -- Server-side refusal fallback setting for the provider ('default' | 'none'); semantics
  -- per Anthropic docs (AI_ENGINE.md §5).
  refusal_fallback  text not null default 'default' check (refusal_fallback in ('default', 'none')),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger ai_model_profiles_updated_at before update on public.ai_model_profiles
  for each row execute function private.set_updated_at();

-- Internal cost bookkeeping per model, micro-USD per 1M tokens (margin analytics only,
-- never customer billing). Used to compute ai_runs.cost_micros.
create table public.ai_model_prices (
  model                           text primary key,
  provider                        text not null default 'anthropic',
  input_cost_micros_per_mtok      bigint not null check (input_cost_micros_per_mtok >= 0),
  output_cost_micros_per_mtok     bigint not null check (output_cost_micros_per_mtok >= 0),
  cache_read_cost_micros_per_mtok bigint check (cache_read_cost_micros_per_mtok >= 0),
  source_note                     text,
  updated_at                      timestamptz not null default now()
);

alter table public.bots
  add constraint bots_model_profile_fk foreign key (model_profile_id)
  references public.ai_model_profiles (id) on delete set null;

-- One row per AI generation attempt (billable or not).
create table public.ai_runs (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  bot_id                uuid,
  conversation_id       uuid,
  trigger_message_id    uuid,
  reply_message_id      uuid,
  job_id                bigint,
  status                public.ai_run_status not null default 'running',
  provider              text not null,
  model                 text not null,                -- model that generated the final reply
  initial_model         text,                         -- model routing chose first
  escalated             boolean not null default false,
  escalation_reason     text check (escalation_reason in ('complaint', 'low_confidence', 'complex_multi_step')),
  routing_confidence    real check (routing_confidence between 0 and 1),
  served_model          text,                         -- model that actually answered (fallbacks)
  stop_reason           text,
  input_tokens          integer,
  output_tokens         integer,
  cache_read_tokens     integer,
  cache_write_tokens    integer,
  latency_ms            integer,
  cost_micros           bigint,                       -- internal cost estimate
  tool_calls            jsonb not null default '[]'::jsonb,
  retrieved_chunk_ids   uuid[] not null default '{}',
  detected_language     text,
  error_code            text,
  error_message         text,
  -- True once the reply was persisted and counted against quota (usage_events)
  billed                boolean not null default false,
  created_at            timestamptz not null default now(),
  finished_at           timestamptz
);
create index ai_runs_workspace_created_idx on public.ai_runs (workspace_id, created_at desc);
create index ai_runs_conversation_idx on public.ai_runs (conversation_id);
-- Escalation-rate analytics (decision A15): escalated runs / all runs per workspace & period.
create index ai_runs_escalated_idx on public.ai_runs (workspace_id, created_at) where escalated;

alter table public.messages
  add constraint messages_ai_run_fk foreign key (ai_run_id) references public.ai_runs (id) on delete set null;

-- Question classification (Growth+ entitlement `question_classification`)
create table public.message_classifications (
  message_id    uuid primary key references public.messages (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  category      text not null,      -- e.g. 'pricing', 'hours', 'order', 'reservation', 'complaint', 'other'
  intent        text,
  sentiment     text check (sentiment in ('positive', 'neutral', 'negative')),
  language      text,
  dialect       text,
  confidence    real check (confidence between 0 and 1),
  model         text,
  created_at    timestamptz not null default now()
);
create index message_classifications_ws_cat_idx on public.message_classifications (workspace_id, category, created_at);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.ai_model_profiles       enable row level security;
alter table public.ai_model_prices         enable row level security;
alter table public.ai_runs                 enable row level security;
alter table public.message_classifications enable row level security;

-- Model profiles and model prices are internal platform config: no client policies
-- (service role / admin function only).

-- ai_runs are visible to owner/admin for transparency (tokens, latency); not to agents/viewers.
create policy ai_runs_select on public.ai_runs for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy message_classifications_select on public.message_classifications for select to authenticated
  using (private.is_workspace_member(workspace_id));
