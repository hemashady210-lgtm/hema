# Development Progress

## Current phase: 01 — Architecture & Foundation · **Complete, awaiting owner approval**

Last updated: 2026-11-25

### Delivered in Phase 01

| Deliverable                                 | Location                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master prompt (verbatim)                    | `docs/MASTER_PROMPT.md`                                                                                                                                 |
| Decisions log (approved + proposals P1–P15) | `docs/DECISIONS.md`                                                                                                                                     |
| Architecture                                | `docs/ARCHITECTURE.md`                                                                                                                                  |
| DB schema, Mermaid ERD, RLS matrix          | `docs/DATABASE.md`                                                                                                                                      |
| SQL migrations (12 files, **not applied**)  | `supabase/migrations/`                                                                                                                                  |
| pgTAP tests (27 assertions)                 | `supabase/tests/database/`                                                                                                                              |
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
- pgTAP: **27/27 passed** (tenant isolation, column grants, service-role-only RPCs, plan limits,
  feature gates, trial quota hard stop, 80 %/100 % alerts, idempotent metering, release).
- Additional smoke checks: monthly usage-period anchoring, queue dedupe/claim/backoff, hybrid
  retrieval ranking with Arabic and English chunks, per-workspace order numbers.
- Tailwind v4 compile of the token CSS: utilities resolve to variables and the Arabic overrides cascade.
- **Not verified:** anything against a real Supabase project or the Supabase CLI local stack
  (real `auth.uid()`, Storage, Vault, default grants, pg_cron/pg_net). This is the first task
  of Phase 02.

### Not done in Phase 01 (by rule)

No feature code, no UI pages, no auth implementation, no Edge Function code, no deployment. No
Supabase project was created and no migration was applied to one.

### Owner decisions required before Phase 02

1. Approve or adjust proposals **P1–P15** in `docs/DECISIONS.md`.
2. **P9 / RISK R-01: AI cost vs pricing.** The estimated Opus 5.5 cost is ≈ 90 % of Growth
   revenue at full use, and overage would be sold below cost. Choose a direction: re-price,
   use a model profile per plan, or decide after the Phase 04 measurements.
3. Confirm the trial entitlements (P12) and the Meta channel counts per plan (P13).
4. Product name (placeholder "AI CRM" in `packages/shared/src/brand.ts`).

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
