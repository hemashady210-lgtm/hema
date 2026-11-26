# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## Start here

1. Read `docs/DECISIONS.md` (source of truth) and `docs/DEVELOPMENT_PROGRESS.md` (current phase).
2. Read the doc for the area you touch: `ARCHITECTURE`, `DATABASE`, `API`, `AI_ENGINE`,
   `BILLING`, `INTEGRATIONS`, `DESIGN_SYSTEM` (all in `docs/`).
3. Work only within the **current approved phase** (see `docs/ROADMAP.md`). Do not start the next
   phase without explicit owner approval.

## Non-negotiable rules

- **Never fake an integration or a status.** Channel, billing and usage states shown in the UI
  must come from real stored data set by verified events or admin actions.
- **Never invent third-party API behavior.** If Meta/PayPal/Anthropic/Voyage/Resend/Supabase
  behavior isn't confirmed from current docs, mark it `needs verification` and don't build on it.
- **Plans and limits are data.** Ask for entitlements by key (`get_workspace_entitlements`,
  `private.get_entitlement`); never compare plan codes in app code.
- **Tenant isolation:** every table has RLS; every tenant row has `workspace_id`; core relations
  use composite FKs `(workspace_id, id)`. New tables ship with pgTAP RLS tests.
- **Secrets:** only `VITE_*` publishable values reach the browser. Service-role and vendor keys
  live in Edge Function secrets; channel tokens in Supabase Vault. Never commit `.env` files.
- **AI path:** prices, ids and workspace scope come from the database, never from model output.
  Every AI reply is metered through `consume_ai_reply` / `release_ai_reply`.
- **n8n is never in the core message path.**
- **Bilingual:** every user-facing string exists in `ar` and `en`; use logical CSS utilities
  (`ms-`, `pe-`, `start-`…), never `ml-/pr-/left-/right-`.
- Product name comes from `packages/shared/src/brand.ts` only.
- Commit messages and PRs must not contain model identifiers.

## Layout

```
apps/dashboard      React + Vite dashboard (customer app + /admin)
apps/widget         Embeddable widget (Preact, Shadow DOM) → widget.js
packages/shared     Runtime-agnostic constants/types (browser + Deno)
packages/ai-engine  Provider-agnostic AI pipeline (Deno-compatible, fetch-only)
supabase/migrations SQL migrations (timestamped, RLS in the same file as the table)
supabase/functions  Edge Functions (Deno)
supabase/tests      pgTAP suites
docs/               Specs and decisions
```

## Commands

```bash
pnpm install
pnpm lint            # ESLint (flat config)
pnpm format:check    # Prettier
pnpm typecheck       # tsc in every workspace package
pnpm test            # package tests (from Phase 02)
supabase start       # local stack (Docker) — Phase 02+
supabase db reset    # apply migrations + seed locally
supabase test db     # pgTAP suites
```

## Conventions

- TypeScript strict (`tsconfig.base.json`), ESM, explicit `.ts` extensions in `packages/*`
  imports (Deno compatibility), `import type` for types.
- SQL: lowercase keywords, `snake_case`, schema-qualified names inside functions, functions use
  `set search_path = ''`; SECURITY DEFINER helpers live in schema `private`.
- Money: integer minor units + ISO currency. Time: `timestamptz`, UTC in storage.
- Localized DB content: `jsonb {"ar": "...", "en": "..."}`.
- Errors from DB limits: `plan_limit:<key>:<limit>` / `plan_feature:<key>` → HTTP 402.
- Update `docs/DEVELOPMENT_PROGRESS.md` at the end of every work session.
