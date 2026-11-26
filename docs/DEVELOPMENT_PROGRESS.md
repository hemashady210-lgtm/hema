# Development Progress

## Current phase: P2 Database & security · **complete — awaiting owner review**. P3 not started (needs a plan + owner approval)

Last updated: 2026-11-26 (P2 session). Phases follow the 17-phase plan in `ROADMAP.md` (E3).
Branch `claude/phase-p2-database-security-sgovxe`. PR #2 (P2) merged into `main` on 2026-11-26;
PR #3 carries the owner-decision follow-up (F1, F3).

## P2 summary (latest verified working state)

- **Supabase dev project `ai-crm-dev`** (ref `jpzgdyzbhszyrvzcsljq`, `eu-west-1`, Postgres 17.12):
  **16 migrations applied** and recorded in `supabase_migrations.schema_migrations`; **pgTAP
  482/482** there (8 suites). No demo seed and no test data on the project (checked after every
  run).
- **CI** (GitHub Actions, job `db`, Supabase CLI 2.122.1 local stack): migrations + `seed.sql` +
  **482/482** + `supabase db lint` clean; job `checks` (lint, format, typecheck, test) green.
- **Local harness** (`pnpm db:test:local`, plain Postgres 16 + stubs): 482/482.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` pass (no package tests yet).

### Done

| Milestone | What                                                                                                                                                                                                                        | Commit                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| M1        | Doc renames (E11): `API.md`, `INTEGRATIONS.md`, `TESTING.md`, `RISKS.md` + all references                                                                                                                                   | `5e0fc2d`                                                   |
| M2        | `supabase/config.toml`, Management-API runner `scripts/db/supabase-remote.mjs` (status / migrate / test / types), local harness, CI job `db`                                                                                | `e9b7bce`                                                   |
| M3        | 12 migrations rewritten in place with the approved E9 rename list + E4/E5/E10 statuses, security fixes, composite FKs                                                                                                       | `03fb786`                                                   |
| M4        | All missing tables (gap list), `channel_credentials` (service role only, Vault), `retry_job()`, versioned `bot_configs`, partitioned analytics, feature flags; pgTAP suites 03–08                                           | `c669606`                                                   |
| M5        | Applied to the dev project; full pgTAP there; `packages/shared/src/database.types.ts`; `supabase/seed.sql` (local/CI only)                                                                                                  | `1687bee`                                                   |
| M6        | Docs synced with §E (ARCHITECTURE, DATABASE + ERD + RLS matrix, API, AI_ENGINE, BILLING, INTEGRATIONS, TESTING, RISKS, DESIGN_SYSTEM); new `SECURITY.md`, `DEPLOYMENT.md`                                                   | `2caa991`                                                   |
| M7        | code-reviewer + security-reviewer subagents; all verified findings fixed in forward migration `…20261126000100_p2_review_fixes` + regression tests; runner + seed hardening; docs                                           | `ddf848a`, `75c3484`                                        |
| F1 + F3   | Owner decisions (DECISIONS §F): soft delete with retained, detached billing records (5-year configurable retention) + content row limits as entitlements — migration `…20261126000200_retention_and_content_limits` + tests | PR #3 (`6dde9fb`, `2075f77`, merge of `main`, final commit) |

Review results: security review — no critical/high; 5 medium, 4 low, hardening items → all fixed.
Code review — 12 important + nits → fixed; the two open decisions were taken by the owner (F1,
F2) and F1/F3 are implemented. Details: `SECURITY.md §7`, `DECISIONS.md §F`.

### Verified (ran and passed)

- Every migration applies on the dev project, in CI (Supabase local stack) and locally.
- Role matrix: every tenant table × select/insert/update/delete × owner/admin/agent/viewer/other
  tenant/anon, plus platform tables, limit-leak probes, read-only workspace, and the F1 soft
  delete of a fully populated workspace: billing records kept + detached + unreadable, every
  other tenant table purged, Vault token removed, final purge after retention (suite 04).
- Content limits per plan (F3): seeded values, 30/50/5 trial limits hit at the right row, file
  size limit, manual notes not counted, override raises the limit (suite 02).
- Migration 0014 on the dev project: retention setting 1825 days and every content limit present;
  `soft_delete_workspace` / `purge_deleted_workspaces` refused to `anon` through the REST API
  (`42501`); project left with no test data.
- Catalog-wide conventions incl. service-only tables, `anon` scope, function grants, empty
  `search_path`, immutable `workspace_id`, storage policies (suite 03).
- Cross-tenant references blocked by composite FKs; retrieval scoped per workspace (suite 05).
- `channel_credentials` unreadable by clients; **real Supabase Vault** round trip and cleanup on
  the dev project and in CI (suite 06).
- Queue, dead-letter, `retry_job` + audit, worker ownership (suite 07); metering incl. release →
  retry re-reservation, overage, pending activation, mid-trial upgrade, grace (suite 02).
- Live REST layer on the dev project with the environment's keys: `anon` gets `42501` on tenant
  tables, service-only tables and RPCs; pricing readable, trial plan hidden; `private` schema
  not exposed (`PGRST106`); service role reaches what edge functions need.
- Limit race fixed: two concurrent sessions at `max_bots = 1` → second rejected (manual, local).
- Supabase docs (checked 2026-11-26): key types + legacy key deprecation (early 2027), Google
  `config.toml` names, Edge Function shared-code pattern.

### Not verified / known gaps

- R-14: whether `supabase functions deploy` bundles imports from `packages/*` (docs silent) —
  verify with the first function in P3.
- `config.toml` was hand-written (CLI could not be installed in the sandbox); it works in CI with
  CLI 2.122.1, not tested with CLI v3.
- HNSW use by `match_kb_chunks` after the rewrite is not measured (needs real data, P5/P16).
- `consume_ai_reply` refuses playground runs only when `ai_run_id` is passed (P7 must pass it).
- Partitions exist through Feb 2027; the scheduler must run `ensure_analytics_partitions()`
  monthly (P10).
- Demo seed users cannot sign in (no `auth.identities`; P3).
- The deletion job that calls `soft_delete_workspace` (after Storage API cleanup) and the
  scheduled `purge_deleted_workspaces` are P10; legal billing retention per country = needs
  verification.
- Supabase's platform event trigger `public.rls_auto_enable()` exists on the dev project (not
  ours; excluded from the convention check) — **needs verification** of what it does.

### Owner decisions taken (2026-11-26, DECISIONS §F)

F1 soft delete + 5-year retained billing records (implemented) · F2 no history rewrite, trailer
rule from now on (in effect) · F3 content row limits (implemented) · F4 production project in
Frankfurt in P17 · F5 new-style Supabase keys from P3.

### Needs owner action

1. **Revoke the Supabase personal access token used in P2** (Dashboard → Account → Access
   Tokens) and the network secret for `api.supabase.com` in the environment settings; create a
   new one only when the next phase needs it.
2. For P3 (F5): put the **new-style keys** in the environment (`sb_publishable_…` for the
   browser-safe key, `sb_secret_…` for the server key).
3. Set `main` as the GitHub default branch (Settings → General), if not done yet.
4. Review and merge PR #3 (F1 + F3 follow-up; PR #2 is already merged).

### Next: P3 Auth, workspaces, app shell, i18n, tokens (not started)

Start by presenting a P3 plan for approval (`ROADMAP.md` P3). P2 leaves ready: the full schema on
the dev project, generated DB types in `@ai-crm/shared`, the runner and CI. P3 must verify R-14
with the first Edge Function, wire Google sign-in per `DEPLOYMENT.md §6`, and use only the
new-style Supabase keys (F5).

### How to resume

- Read this file, `DECISIONS.md`, `DATABASE.md`, `SECURITY.md`, `DEPLOYMENT.md`.
- DB loop: `pnpm db:test:local` (no Docker) → push (CI `db` job) → `pnpm db:remote:migrate` +
  `pnpm db:remote:test` with a valid `SUPABASE_ACCESS_TOKEN` (see DEPLOYMENT §3). Applied
  migrations are frozen; new work = new migration + matrix row in suite 04.

### Open "needs verification" items (tracked)

Meta Graph API details (identifiers, tokens, webhooks, messaging windows, Embedded Signup v4
outputs, webhook event ids) · PayPal Subscriptions/Orders API event names and plan-revision
behavior · Voyage model names, dimensions and Arabic quality · Anthropic SDK in Deno, fallback
billing semantics · Supabase: pg_cron sub-minute schedules, Realtime broadcast authorization,
signed upload URLs vs Storage RLS, CLI bundling of workspace packages (R-14), `rls_auto_enable`
· Deno PDF/DOCX extraction · legal retention rules. Resolved in P2: Postgres has an `arabic`
text-search config (dev project); pg_cron 1.6.4 / pg_net 0.20.4 / pgvector 0.8.2 / pgTAP 1.3.3 /
Vault available; Supabase key naming; Google env names.

## History

### P1 Foundation (Phase 01), tooling and reconciliation sessions

#### Delivered in Phase 01

| Deliverable                                 | Location                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master prompt (full build, replaced 11-26)  | `docs/MASTER_PROMPT.md`                                                                                                                                 |
| Decisions log (approved + proposals P1–P15) | `docs/DECISIONS.md`                                                                                                                                     |
| Architecture                                | `docs/ARCHITECTURE.md`                                                                                                                                  |
| DB schema, Mermaid ERD, RLS matrix          | `docs/DATABASE.md`                                                                                                                                      |
| SQL migrations (12 files, **not applied**)  | `supabase/migrations/`                                                                                                                                  |
| pgTAP tests (32 assertions)                 | `supabase/tests/database/`                                                                                                                              |
| API spec                                    | `docs/API.md`                                                                                                                                           |
| AI engine design (+ cost model)             | `docs/AI_ENGINE.md`                                                                                                                                     |
| Billing design                              | `docs/BILLING.md`                                                                                                                                       |
| Channels / Connect section                  | `docs/INTEGRATIONS.md`                                                                                                                                  |
| Design system + tokens                      | `docs/DESIGN_SYSTEM.md`, `apps/dashboard/src/styles/{tokens,globals}.css`                                                                               |
| Roadmap, testing strategy, risk register    | `docs/ROADMAP.md`, `docs/TESTING.md`, `docs/RISKS.md`                                                                                                   |
| Project context, CLAUDE.md, README          | `docs/PROJECT_CONTEXT.md`, `CLAUDE.md`, `README.md`                                                                                                     |
| Monorepo scaffold + base configs            | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, Prettier, EditorConfig, `.nvmrc`, CI workflow, per-app/package configs |
| `.env.example` (placeholders only)          | `.env.example`                                                                                                                                          |

#### Verification performed

- `pnpm install`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: all pass. This is the same
  set CI runs; `pnpm test` has no tests yet.
- Migrations: applied in order to a **throwaway local Postgres 16 + pgvector** with stub
  `auth`/`storage` schemas (scratch environment, since deleted). All 12 applied cleanly.
- pgTAP: **32/32 passed** (tenant isolation, column grants, service-role-only RPCs, plan limits,
  feature gates, trial quota hard stop, 80 %/100 % alerts, idempotent metering, release, model
  routing profiles and Enterprise premium override). Re-run after the routing changes.
- Additional smoke checks: monthly usage-period anchoring, queue dedupe/claim/backoff, hybrid
  retrieval ranking with Arabic and English chunks, per-workspace order numbers.
- Tailwind v4 compile of the token CSS: utilities resolve to variables and the Arabic overrides cascade.
- **Not verified:** anything against a real Supabase project or the Supabase CLI local stack
  (real `auth.uid()`, Storage, Vault, default grants, pg_cron/pg_net). This is the first task
  of Phase 02.

#### Not done in Phase 01 (by rule)

No feature code, no UI pages, no auth implementation, no Edge Function code, no deployment. No
Supabase project was created and no migration was applied to one.

#### Owner decisions recorded (2026-11-26)

1. **Model routing (A15):** Haiku 5.5 is the default for all plans (replies + classification);
   it escalates to Sonnet 5.5 only for complaints, low-confidence answers or complex
   multi-step questions, and the escalation rate is logged in `ai_runs`. Opus 5.5 is
   Enterprise-only, by contract. An Arabic dialect eval gate (Gulf, Egyptian, MSA) is added
   (now in P6, decision E3). Public prices are unchanged.
   - Applied in migrations `…000700` (escalation fields, `ai_model_prices`) and `…001200`
     (`standard` / `premium` profiles).
   - Cost per plan recomputed in `AI_ENGINE.md §9`: ≈ $2.1 / 1k replies at 15 % escalation.
2. Proposals **P1–P15 approved** as proposed (P9 superseded by A15).
3. Placeholder product name "AI CRM" kept.
4. The PR is watched for review comments and CI.

**Waiting for the owner's go-ahead before starting Phase 02.**

#### Tooling session (2026-11-26) — no product code

- `docs/MASTER_PROMPT.md` replaced with the owner's full-build master prompt (§0–§25) + addendum
  (the Phase 01 prompt it replaced is in git history, commit `55528fd`). The first copy was cut
  off at §12.10. The owner then supplied §12.10–§25 and a revised addendum, which replaced the
  cut-off tail and the earlier addendum. The owner later sent a condensed final §12.10–§25, which
  is the version now in the file.
- **Approval rule (owner decision):** CLAUDE.md wins. **One phase per session; plan first and
  wait for owner approval; never start the next phase without explicit approval.**
  MASTER_PROMPT §0 and §1 say this.
- Agent skills in `.claude/skills/`, pinned in `skills-lock.json` (installed via `npx skills`):
  `supabase`, `supabase-postgres-best-practices` (supabase/agent-skills), `frontend-design`,
  `webapp-testing` (anthropics/skills). Vendored dirs are excluded from Prettier.
- Project skills: `rls-policy`, `i18n-rtl`, `channel-adapter`, `migration`.
- Subagents in `.claude/agents/`: `code-reviewer`, `security-reviewer`, `test-writer`.
- `.claude/settings.json` PostToolUse hook → `.claude/hooks/post-edit-check.sh`: ESLint on the
  edited JS/TS file + `typecheck` of its workspace package; blocks (exit 2) on errors. Verified
  manually: clean file → pass; injected type + lint errors → both reported, exit 2.
- Verified: `pnpm lint`, `pnpm format:check`, `pnpm typecheck` pass.

#### Reconciliation session (2026-11-26), docs only

The owner decided every `GAP_ANALYSIS.md` §1 item. They are recorded as **DECISIONS §E**
(E0–E13). General rule E0: MASTER_PROMPT + ADDENDUM is the source of truth, except where existing
tested work is equal or better.

- Done: `DECISIONS.md` (§E, A14/A15/P1/P2 rows), `MASTER_PROMPT.md` (inline _[Reconciled]_
  notes), `ROADMAP.md` rewritten as P1–P17 with every gap item assigned, `GAP_ANALYSIS.md` (all
  items resolved with a phase, and one correction about n8n env vars), `.env.example` (§21 names),
  and the `vite-env.d.ts` typings to match. Two one-line env-name fixes in `API_SPEC.md` and
  `ARCHITECTURE.md`.
- **No migrations changed.** All schema work (renames, new tables, enums) is P2.
- **Docs not yet in sync with §E:** ARCHITECTURE, DATABASE, API_SPEC, AI_ENGINE, BILLING,
  CHANNELS, TESTING_STRATEGY, RISK_REGISTER. DECISIONS.md wins where they differ. The full sync
  and the file renames (E11) are the first task of P2.
- Verified: `pnpm lint`, `pnpm format:check`, `pnpm typecheck` pass.
- Owner approved the three kept items (DECISIONS E13): `allowed_origins`, `pending_activation`,
  and the tools `confirm_order` + `capture_contact_details`.

Branches: `main` was created from the Phase 01 head (`55528fd`); PR #1 targets `main`. Setting
`main` as the GitHub default branch is an owner action (repo Settings → General).
