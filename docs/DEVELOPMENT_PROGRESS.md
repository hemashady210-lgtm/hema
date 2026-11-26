# Development Progress

## Current phase: 01 — Architecture & Foundation · **Complete, decisions applied, awaiting go for Phase 02**

Last updated: 2026-11-26 (tooling session)

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
   to Phase 04. Public prices are unchanged.
   - Applied in migrations `…000700` (escalation fields, `ai_model_prices`) and `…001200`
     (`standard` / `premium` profiles).
   - Cost per plan recomputed in `AI_ENGINE.md §9`: ≈ $2.1 / 1k replies at 15 % escalation.
2. Proposals **P1–P15 approved** as proposed (P9 superseded by A15).
3. Placeholder product name "AI CRM" kept.
4. The PR is watched for review comments and CI.

**Waiting for the owner's go-ahead before starting Phase 02.**

### Tooling session (2026-11-26) — no product code

- `docs/MASTER_PROMPT.md` replaced with the owner's full-build master prompt + addendum
  (the Phase 01 prompt it replaced is in git history, commit `55528fd`). The text as supplied
  ends mid-sentence in §12.10 ("manual paym") — sections after 12.10 (incl. §13 AI
  Playground, referenced by §12.9) are **missing; owner to supply**.
- **Conflict to resolve:** MASTER_PROMPT §0 says "do not ask for approval between phases";
  `CLAUDE.md` says "do not start the next phase without explicit owner approval". Until the
  owner says otherwise, `CLAUDE.md` + `DECISIONS.md` win (per CLAUDE.md "source of truth").
- Agent skills in `.claude/skills/`, pinned in `skills-lock.json` (installed via `npx skills`):
  `supabase`, `supabase-postgres-best-practices` (supabase/agent-skills), `frontend-design`,
  `webapp-testing` (anthropics/skills). Vendored dirs are excluded from Prettier.
- Project skills: `rls-policy`, `i18n-rtl`, `channel-adapter`, `migration`.
- Subagents in `.claude/agents/`: `code-reviewer`, `security-reviewer`, `test-writer`.
- `.claude/settings.json` PostToolUse hook → `.claude/hooks/post-edit-check.sh`: ESLint on the
  edited JS/TS file + `typecheck` of its workspace package; blocks (exit 2) on errors. Verified
  manually: clean file → pass; injected type + lint errors → both reported, exit 2.
- Verified: `pnpm lint`, `pnpm format:check`, `pnpm typecheck` pass.

### Next: Phase 02 — Platform core (not started)

See `docs/ROADMAP.md`. First steps once approved:

- Create the Supabase project (EU), `supabase init`, merge `config.toml`, `supabase db reset`,
  and re-run pgTAP on the real stack.
- Resolve "needs verification" items R-14 (sharing packages with Edge Functions) and the
  Supabase key naming.

### Open "needs verification" items (tracked)

Meta Graph API details (identifiers, tokens, webhooks, messaging windows, Embedded Signup v4
outputs) · PayPal Subscriptions/Orders API event names and plan-revision behavior · Voyage
model names, dimensions and Arabic quality · Anthropic SDK in Deno, fallback billing semantics
· Supabase: pg_cron sub-minute schedules, pg_net, Realtime broadcast authorization, signed
upload URLs vs Storage RLS, CLI bundling of workspace packages · Postgres Arabic text-search
config · Deno PDF/DOCX extraction · legal retention rules.
