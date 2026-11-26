# Development Progress

## Current phase: P1 Foundation · **complete and reconciled with MASTER_PROMPT**. Next: **P2 Database & security** (not started; needs a plan + owner approval)

Last updated: 2026-11-26 (reconciliation session). Phases follow the 17-phase plan in
`ROADMAP.md` (decision E3); "Phase 01" below is P1.

### Delivered in Phase 01

| Deliverable                                 | Location                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master prompt (full build, replaced 11-26)  | `docs/MASTER_PROMPT.md`                                                                                                                                 |
| Decisions log (approved + proposals P1–P15) | `docs/DECISIONS.md`                                                                                                                                     |
| Architecture                                | `docs/ARCHITECTURE.md`                                                                                                                                  |
| DB schema, Mermaid ERD, RLS matrix          | `docs/DATABASE.md`                                                                                                                                      |
| SQL migrations (12 files, **not applied**)  | `supabase/migrations/`                                                                                                                                  |
| pgTAP tests (32 assertions)                 | `supabase/tests/database/`                                                                                                                              |
| API spec                                    | `docs/API_SPEC.md`                                                                                                                                      |
| AI engine design (+ cost model)             | `docs/AI_ENGINE.md`                                                                                                                                     |
| Billing design                              | `docs/BILLING.md`                                                                                                                                       |
| Channels / Connect section                  | `docs/CHANNELS.md`                                                                                                                                      |
| Design system + tokens                      | `docs/DESIGN_SYSTEM.md`, `apps/dashboard/src/styles/{tokens,globals}.css`                                                                               |
| Roadmap, testing strategy, risk register    | `docs/ROADMAP.md`, `docs/TESTING_STRATEGY.md`, `docs/RISK_REGISTER.md`                                                                                  |
| Project context, CLAUDE.md, README          | `docs/PROJECT_CONTEXT.md`, `CLAUDE.md`, `README.md`                                                                                                     |
| Monorepo scaffold + base configs            | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, Prettier, EditorConfig, `.nvmrc`, CI workflow, per-app/package configs |
| `.env.example` (placeholders only)          | `.env.example`                                                                                                                                          |

### Verification performed

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

### Not done in Phase 01 (by rule)

No feature code, no UI pages, no auth implementation, no Edge Function code, no deployment. No
Supabase project was created and no migration was applied to one.

### Owner decisions recorded (2026-11-26)

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

### Tooling session (2026-11-26) — no product code

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

### Reconciliation session (2026-11-26), docs only

The owner decided every `GAP_ANALYSIS.md` §1 item. They are recorded as **DECISIONS §E**
(E0–E12). General rule E0: MASTER_PROMPT + ADDENDUM is the source of truth, except where existing
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

Branches: `main` was created from the Phase 01 head (`55528fd`); PR #1 targets `main`. Setting
`main` as the GitHub default branch is an owner action (repo Settings → General).

### Needs owner action

- Set `main` as the default branch (GitHub Settings → General).
- OK or veto for the items kept pending approval (DECISIONS §E9): `allowed_origins`,
  `pending_activation`, tools `confirm_order` / `capture_contact_details`.
- Create the Supabase project (EU, Frankfurt). P2 needs it.

### Next: P2 Database & security (not started)

Start by presenting a P2 plan for approval (see `ROADMAP.md` P2). It must include:

- `supabase init`, merge `config.toml`, `supabase db reset` on the real local stack; re-run
  pgTAP there.
- Schema reconciliation per DECISIONS §E: renames (column-level list for approval), `grace`,
  channel status, `connection_mode`, conversation `status`/`handler`, `channel_credentials`,
  `retry_job()`, plus every missing table listed in `GAP_ANALYSIS.md` §2.
- Whether to edit the 12 unapplied migrations in place or add new ones.
- pgTAP for every table + role matrix in CI; doc sync + renames (E11).
- Resolve "needs verification": R-14 (sharing packages with Edge Functions), Supabase key
  naming (publishable vs anon), Google provider env names.

### Open "needs verification" items (tracked)

Meta Graph API details (identifiers, tokens, webhooks, messaging windows, Embedded Signup v4
outputs) · PayPal Subscriptions/Orders API event names and plan-revision behavior · Voyage
model names, dimensions and Arabic quality · Anthropic SDK in Deno, fallback billing semantics
· Supabase: pg_cron sub-minute schedules, pg_net, Realtime broadcast authorization, signed
upload URLs vs Storage RLS, CLI bundling of workspace packages · Postgres Arabic text-search
config · Deno PDF/DOCX extraction · legal retention rules.
