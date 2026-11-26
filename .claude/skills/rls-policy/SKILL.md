---
name: rls-policy
description: Write or review Row Level Security for a Supabase table in this repo. Use whenever a migration creates a table, changes who may read/write it, adds a column-level grant, or when reviewing tenant isolation. Covers the private.* helper functions, policy shapes per access pattern, service-role-only tables, and the pgTAP tests every new table must ship with.
---

# RLS policy (tenant isolation)

Source of truth: `docs/DECISIONS.md`, `docs/DATABASE.md`, migration
`supabase/migrations/20261125000200_identity_tenancy.sql` (helpers) and
`supabase/tests/database/01_rls_tenant_isolation.test.sql` (test pattern).

## Non-negotiables

1. `alter table public.<t> enable row level security;` in the **same migration** as the
   `create table`. No table ships without it.
2. Every tenant row has `workspace_id uuid not null` + index; relations use composite FKs
   `(workspace_id, id)` so a child can never point at another tenant's parent.
3. Policies call the existing helpers — never re-implement membership checks inline:
   | Helper                                                 | Meaning                                                                                                                          |
   | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
   | `private.is_workspace_member(ws)`                      | caller is an active member of `ws`                                                                                               |
   | `private.has_workspace_role(ws, roles[])`              | caller has one of the roles                                                                                                      |
   | `private.workspace_is_writable(ws)`                    | workspace `active` and not soft-deleted                                                                                          |
   | `private.can_write(ws, roles[] default {owner,admin})` | role check **and** writable                                                                                                      |
   | `private.is_platform_admin()`                          | row in `platform_admins` (rarely used in RLS — Super Admin goes through the `admin` edge function with service role + audit log) |
4. Always `to authenticated` (never `to public`/`anon` unless the table is genuinely public
   catalogue data, documented in `DATABASE.md`).
5. Wrap `auth.uid()` as `(select auth.uid())` for per-statement evaluation.
6. New SECURITY DEFINER helpers go in schema `private`, `set search_path = ''`,
   schema-qualified names, `revoke all ... from public` then grant execute explicitly.

## Choose the access pattern

| Pattern                                                                                                         | Policies                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Member-readable, owner/admin-writable (config tables: bots, catalog, KB)                                        | `select using (private.is_workspace_member(workspace_id))` + `for all using/with check (private.can_write(workspace_id))` |
| Agent-workable (conversations, orders, reservations)                                                            | write policy uses `private.can_write(workspace_id, array['owner','admin','agent']::public.workspace_role[])`              |
| Read-only to clients, written by edge functions (channels, connection requests, messages)                       | `select` policy only; no insert/update/delete policies. Writes use service role.                                          |
| **Service-role only** (channel_credentials, webhook_events, jobs, usage_events, analytics_events, kb_chunks, …) | enable RLS, **no policies at all**, and `revoke all on public.<t> from anon, authenticated;`                              |
| Column-restricted update                                                                                        | policy for `update`, then `revoke update on t from authenticated; grant update (col_a, col_b) on t to authenticated;`     |
| Hide internal rows                                                                                              | add a predicate, e.g. `using (private.is_workspace_member(workspace_id) and not is_internal)`                             |

Plan limits are **not** RLS: they are triggers/functions that raise
`plan_limit:<key>:<limit>` or `plan_feature:<key>`, using `private.get_entitlement`.

## Template

```sql
alter table public.things enable row level security;

create policy things_select on public.things for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy things_write on public.things for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));
```

`with check` is mandatory on insert/update policies — without it a user could move a row into
another workspace.

## Required pgTAP coverage (add to `supabase/tests/database/`)

For every new table: **add a row to the matrix in `04_role_matrix.test.sql`** (expected allowed
roles for select / insert / update / delete; the suite fails if a tenant table is missing), add it
to the service-only list in `03_schema_conventions.test.sql` if no client may touch it, and add a
composite-FK case to `05_cross_tenant_references.test.sql`. The matrix covers:

- user A `select` sees only A rows (and 0 rows for service-role-only tables);
- cross-tenant `update`/`delete` affects 0 rows;
- `insert` with B's `workspace_id` throws `42501`;
- viewer/agent cannot do what their role forbids;
- writes blocked when the workspace is not `active` (if `can_write` used).

Run with `supabase test db` (needs Docker), `pnpm db:test:local` (plain Postgres harness) or
`pnpm db:remote:test` (dev project, see `docs/DEPLOYMENT.md`). If it cannot run in the session, say so and mark
the tests **UNVERIFIED** in `docs/DEVELOPMENT_PROGRESS.md`.

## Review checklist

- [ ] RLS enabled in the same file as the table
- [ ] every policy targets `authenticated` and uses `private.*` helpers
- [ ] `with check` present on all write policies
- [ ] service-role-only tables have zero policies + explicit revoke
- [ ] composite FK to parents
- [ ] pgTAP tests added and run (or marked UNVERIFIED)
