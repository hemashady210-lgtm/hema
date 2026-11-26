-- =============================================================================
-- 0007.6 · Playground & readiness test suites (§13, gap; logic + UI in P11)
--   bot_test_cases   — questions + expected facts (auto-generated from the KB or custom)
--   bot_tests        — one run of a bot's suite against a bot_configs version
--   bot_test_results — per-case outcome, with the DB fact-check (no invented prices/hours)
-- Runs use is_test AI runs: never billed, never in analytics.
-- =============================================================================

create table public.bot_test_cases (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null,
  bot_id         uuid not null,
  source         text not null default 'custom' check (source in ('auto', 'custom')),
  category       text check (category in ('hours', 'prices', 'policies', 'faq', 'catalog', 'handoff', 'other')),
  question       text not null check (char_length(question) between 1 and 1000),
  language       text not null default 'ar',
  -- [{"fact":"Opens at 09:00 on Sunday","kind":"hours","ref":"<working_hours.id>"}]
  expected_facts jsonb not null default '[]'::jsonb check (jsonb_typeof(expected_facts) = 'array'),
  is_active      boolean not null default true,
  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, bot_id) references public.bots (workspace_id, id) on delete cascade
);
create index bot_test_cases_bot_idx on public.bot_test_cases (bot_id, is_active);
create index bot_test_cases_workspace_idx on public.bot_test_cases (workspace_id);
create trigger bot_test_cases_updated_at before update on public.bot_test_cases
  for each row execute function private.set_updated_at();

create table public.bot_tests (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null,
  bot_id                 uuid not null,
  bot_config_id          uuid,
  status                 text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  total_cases            integer not null default 0 check (total_cases >= 0),
  passed_cases           integer not null default 0 check (passed_cases >= 0),
  -- Weighted readiness inputs (§13). pass_rate = passed / total.
  pass_rate              numeric(5, 4) check (pass_rate between 0 and 1),
  score                  smallint check (score between 0 and 100),
  hallucination_detected boolean not null default false,   -- invented price/hour vs DB
  fallback_verified      boolean,                          -- simulated provider failure → fallback sent
  error                  text,
  created_by             uuid references auth.users (id),
  started_at             timestamptz,
  finished_at            timestamptz,
  created_at             timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, bot_id) references public.bots (workspace_id, id) on delete cascade,
  foreign key (bot_id, bot_config_id) references public.bot_configs (bot_id, id) on delete set null (bot_config_id),
  check (passed_cases <= total_cases)
);
create index bot_tests_bot_idx on public.bot_tests (bot_id, created_at desc);
create index bot_tests_workspace_idx on public.bot_tests (workspace_id);

create table public.bot_test_results (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null,
  bot_test_id    uuid not null,
  test_case_id   uuid,
  question       text not null,
  expected_facts jsonb not null default '[]'::jsonb,
  actual_answer  text,
  passed         boolean not null,
  score          real check (score between 0 and 1),
  -- {"missing_facts":[...],"invented_prices":[...],"invented_hours":[...]}
  fact_check     jsonb not null default '{}'::jsonb check (jsonb_typeof(fact_check) = 'object'),
  ai_run_id      uuid,
  latency_ms     integer check (latency_ms >= 0),
  created_at     timestamptz not null default now(),
  foreign key (workspace_id, bot_test_id) references public.bot_tests (workspace_id, id) on delete cascade,
  foreign key (workspace_id, test_case_id)
    references public.bot_test_cases (workspace_id, id) on delete set null (test_case_id),
  foreign key (workspace_id, ai_run_id) references public.ai_runs (workspace_id, id) on delete set null (ai_run_id)
);
create index bot_test_results_test_idx on public.bot_test_results (bot_test_id);
create index bot_test_results_workspace_idx on public.bot_test_results (workspace_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.bot_test_cases   enable row level security;
alter table public.bot_tests        enable row level security;
alter table public.bot_test_results enable row level security;

-- Custom cases are managed by owner/admin; `auto` cases are generated server-side.
create policy bot_test_cases_select on public.bot_test_cases for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy bot_test_cases_write on public.bot_test_cases for all to authenticated
  using (private.can_write(workspace_id) and source = 'custom')
  with check (private.can_write(workspace_id) and source = 'custom');
revoke insert, update on public.bot_test_cases from authenticated;
grant insert (workspace_id, bot_id, category, question, language, expected_facts, is_active)
  on public.bot_test_cases to authenticated;
grant update (category, question, language, expected_facts, is_active) on public.bot_test_cases to authenticated;

-- Runs and results are produced by the backend (it calls the AI engine).
create policy bot_tests_select on public.bot_tests for select to authenticated
  using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.bot_tests from anon, authenticated;

create policy bot_test_results_select on public.bot_test_results for select to authenticated
  using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.bot_test_results from anon, authenticated;
