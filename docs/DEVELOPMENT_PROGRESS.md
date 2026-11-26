# Development Progress

## Current phase: 01 — Architecture & Foundation · **Complete, decisions applied, awaiting go for Phase 02**

Last updated: 2026-11-26

### Delivered in Phase 01

| Deliverable                                 | Location                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master prompt (verbatim)                    | `docs/MASTER_PROMPT.md`                                                                                                                                 |
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
