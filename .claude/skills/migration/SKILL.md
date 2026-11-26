---
name: migration
description: Create or review a Supabase SQL migration in supabase/migrations. Use whenever adding or altering tables, enums, functions, triggers, indexes, grants or seed data — naming, file layout, SQL style, tenancy columns, RLS-in-the-same-file, plan-limit errors, and how to verify.
---

# SQL migration

Source of truth: `docs/DATABASE.md` (keep it and its Mermaid ERD in sync), `docs/DECISIONS.md`,
existing files in `supabase/migrations/`. For policies follow the `rls-policy` skill; for
general Postgres guidance see `supabase-postgres-best-practices`.

## File

- Name: `supabase/migrations/<YYYYMMDDHHMMSS>_<snake_description>.sql`, timestamp later than
  every existing file. Never edit a migration that has been applied to a shared/remote
  database — write a new one.
- Header comment block: number, purpose, decisions referenced.
- One concern per file; table + its indexes + trigger + **RLS + policies + grants** together.

## Style

- lowercase keywords, `snake_case`, schema-qualified names (`public.`, `private.`,
  `extensions.`).
- Functions: `set search_path = ''`; SECURITY DEFINER only in schema `private`, then
  `revoke all ... from public` and explicit `grant execute`.
- Extensions live in schema `extensions`.

## Table checklist

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references public.workspaces (id) on delete cascade` + index
  (leading column of composite indexes used by RLS)
- `unique (workspace_id, id)` on parents; children use composite FK
  `foreign key (workspace_id, parent_id) references public.parent (workspace_id, id)`
- `created_at` / `updated_at timestamptz not null default now()` +
  `create trigger <t>_updated_at before update on public.<t> for each row execute function private.set_updated_at();`
- `deleted_at timestamptz` where soft delete is needed
- document every `on delete` choice in DATABASE.md
- Money: integer minor units (`bigint`/`integer`) + `currency char(3)`. Time: `timestamptz` (UTC).
- Localized text: `jsonb check (private.is_i18n_text(col))`.
- Enums only for stable vocabularies; **anything plan-related is data** (plans/entitlements
  tables), never an enum or a hard-coded code comparison.
- JSONB only for genuinely flexible data; index with GIN if queried.
- Append-only tables (usage, billing events, audit): no update/delete grants.

## Limits & errors

Enforce plan limits in triggers/functions using `private.get_entitlement`; raise exactly
`plan_limit:<key>:<limit>` or `plan_feature:<key>` (mapped to HTTP 402 by the API).
AI replies are metered only through `consume_ai_reply` / `release_ai_reply`.

## Verify

```bash
supabase db reset          # applies all migrations + seed on the local stack (Docker)
supabase test db           # pgTAP suites in supabase/tests
pnpm db:types              # regenerate packages/shared/src/database.types.ts
```

If Docker/Supabase CLI is unavailable in the session, say so; mark the migration
**UNVERIFIED** in `docs/DEVELOPMENT_PROGRESS.md`. Never apply migrations to a remote project
without owner approval (irreversible action).
