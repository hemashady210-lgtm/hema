# Testing Strategy

## 1. Pyramid & tools

| Layer         | Tool                                                                              | Scope                                                                                                                                     | Runs                                    |
| ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Database      | **pgTAP** via `supabase test db` (`supabase/tests/database/*.test.sql`)           | RLS isolation per table, column grants, plan-limit triggers, metering (`consume/release`), queue RPCs, retrieval function, seed integrity | every PR (CI)                           |
| Unit          | **Vitest** (packages, dashboard logic), **Deno test** (edge functions, `_shared`) | prompt builder, tool validators, price computation, language detection, entitlement mapping, webhook normalizers, zod schemas             | every PR                                |
| Integration   | Deno tests against the local Supabase stack                                       | edge function routes with real DB + RLS; webhook signature verification with recorded fixtures; job lifecycle                             | every PR (P3+)                          |
| Contract      | recorded vendor fixtures (Meta, PayPal, Anthropic, Voyage)                        | parsing/normalization of real payloads; no live calls in CI                                                                               | every PR                                |
| E2E           | **Playwright** (Chromium + WebKit), both `ar`/RTL and `en`/LTR                    | sign-up → workspace, KB, widget chat, billing sandbox flows, admin flows                                                                  | PR (smoke) + nightly (full)             |
| Accessibility | `@axe-core/playwright`                                                            | every E2E page in both directions                                                                                                         | with E2E                                |
| Visual        | Playwright screenshots                                                            | key screens × {dark, light} × {ar, en}                                                                                                    | nightly                                 |
| AI quality    | eval harness (`packages/ai-engine/evals`)                                         | golden set (AI_ENGINE §10)                                                                                                                | on prompt/model change + nightly sample |
| Load          | k6 (or similar)                                                                   | widget message throughput, queue latency, webhook bursts                                                                                  | before launch (P16)                     |

## 2. Database suites (P2, P3)

| Suite                        | Assertions | What it proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01_rls_tenant_isolation`    |         14 | basic isolation, service-only tables, client-unwritable columns, service-only RPCs, public pricing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `02_plan_limits_metering`    |         57 | plan limits + feature gates (branches, orders, reservations, handoffs, API keys), overrides + expiry, trial hard stop, 80/100 % alerts, idempotent consume/release, **release → retry re-reserved**, key/workspace binding, Growth overage, pending activation grants nothing, mid-trial upgrade, month-end periods, model routing, `grace`, test runs never billed, **content limits per plan (F3)**                                                                                                                                                                                   |
| `03_schema_conventions`      |         21 | catalog-wide: RLS on every table + partition, `workspace_id` NOT NULL + index + immutable, service-only tables, `anon` scope, no TRUNCATE/REFERENCES/TRIGGER, policy shape, function grants + empty `search_path`, storage policies, no SVG                                                                                                                                                                                                                                                                                                                                             |
| `04_role_matrix`             |        281 | **every tenant table × select/insert/update/delete × owner/admin/agent/viewer/other tenant/anon**, platform tables write-denied, limit-leak probes, file-source delete guard, read-only workspace, profiles, **soft delete of a fully populated workspace (F1): billing kept detached, everything else purged, final purge after retention**; fails if a table is missing                                                                                                                                                                                                               |
| `05_cross_tenant_references` |         18 | composite FKs block cross-tenant references from any role; retrieval never crosses tenants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `06_channel_credentials`     |         16 | credentials unreadable by clients, Vault round trip, no orphaned Vault secrets (replace / delete / disconnect / channel delete)                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `07_jobs_retry`              |         20 | queue idempotency, backoff, dead-letter, `retry_job` + audit, stuck-job sweep, worker ownership, RPCs service-only                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `08_table_behaviour`         |         55 | E4/E5/E10 vocabularies, bot config versions + immutability, server-only bot columns, flags, partitions, append-only + workspace deletion, previews, assignee + handoff gates, channel health constraint, manual connect sequence, immutable workspace_id, i18n / currency / path checks, order totals, categories, hours, KB documents                                                                                                                                                                                                                                                  |
| `09_auth_workspaces_members` |         88 | **P3:** profile trigger (name/locale from metadata, email sync), column grants (`profiles.email`, `token_hash`), P3 RPCs service-only, `create_workspace` (verified email, trial + billing event + onboarding + audit, one trial per user, reserved/duplicate slugs, time zone/country), invitations (owner not invitable, capacity incl. open invites, reissue, preview states, accept rules: email match, verified, expired, revoked, used, idempotent, member trigger final), role change / remove / leave / transfer rules, read-only workspace, assignments released, rate limiter |
| `10_p3_review_fixes`         |         32 | **P3 review:** pre-confirmation passwords cleared (admin same-request confirmations kept), invitations die with the inviter's rights (accept check + auto-revoke + audit), no acceptance on read-only workspaces, revoke still allowed there, only open work released (handoffs back to `requested`, history kept), cross-workspace actors get `not_found`, replay after removal refused, no preview for deleted workspaces, private helpers not client-executable                                                                                                                      |

Total **602** (+ a two-session concurrency check of the limit locks, run manually). Where they run (all green on 2026-11-26):

1. **Supabase dev project** — `pnpm db:remote:test` (Management API; each file runs in a
   transaction that is always aborted, so no fixture persists).
2. **CI** — job `db`: `supabase db start` + `supabase test db` + `supabase db lint` on the
   Supabase CLI local stack (CLI 2.122.1, Postgres 17).
3. **Local harness** — `pnpm db:test:local` on plain Postgres + pgvector + pgTAP with stub
   `auth` / `storage` / `vault` schemas (fast loop; not authoritative). Not run in the P3
   session (no plain Postgres server in that sandbox); the CLI local stack was used instead.

## 2a. Application tests (P3)

| Layer            | Where                                                            | Count | What it proves                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (shared)    | `packages/shared/src/shared.test.ts` (Vitest)                    |    13 | capability matrix, `canManageMember`, slugify (Arabic names), password rules, safe redirects, API schemas, error catalogue in ar + en                                                                                               |
| Unit + component | `apps/dashboard/src/test/*` (Vitest + Testing Library, jsdom)    |   134 | token contrast (every text/status token × every surface × both themes), i18n parity/placeholders/untranslated/Arabic plurals, RTL ⇄ LTR switching + profile persistence, auth forms (ar + en), role-based UI by role, lint rule     |
| Edge Function    | `supabase/functions/{_shared,api}/*_test.ts` (Deno, fakes)       |    33 | env/key resolution (new keys first), CORS, 401 envelope localized, validation, DB-error mapping, invitation token hashing + email states, path binding, preview masking, rate limit 429 + fail-open, Resend adapter, email template |
| Integration      | `supabase/functions/api/integration_test.ts` (Deno, local stack) |     1 | one end-to-end flow on real Auth + PostgREST + RLS + RPCs: trial limit, seat limit, override, invite, preview, accept, RLS reads, role rules, viewer leaves                                                                         |
| E2E              | `apps/dashboard/e2e/journey.spec.ts` (Playwright, ar + en)       |     2 | sign up → verify (local mail catcher) → create workspace → invite → second user accepts → restricted view → AR/EN switch persists; axe 0 critical on every page visited                                                             |
| Visual           | `apps/dashboard/e2e/screenshots.spec.ts`                         |   144 | 18 screens × ar/en × dark/light × desktop/mobile (`docs/screenshots/p3/`)                                                                                                                                                           |

CI: job `checks` (lint incl. `local/logical-css`, format, typecheck, Vitest), job `functions`
(deno lint/check/test), job `db` (pgTAP), job `e2e` (local stack + integration + Playwright).

## 3. Mandatory test rules

1. **Every new table** ships with RLS tests: add it to the role matrix (`04_role_matrix`, which
   fails otherwise) and, if service-only, to the list in `03_schema_conventions`; composite FKs
   to parents get a case in `05`.
2. **Every plan limit or feature gate** ships with a trigger test (allowed at limit − 1, rejected
   at limit, override raises the limit).
3. **Every money or usage path** is tested for idempotency (replay the same webhook/job twice).
4. **Every webhook** has signature-valid, signature-invalid, duplicate and out-of-order tests.
5. **Every UI string** exists in `ar` and `en` (missing-key check in CI); RTL snapshot for new
   screens.
6. No test calls live third-party APIs in CI; live smoke tests run manually against sandboxes.
7. Bugs get a regression test before the fix is merged.

## 4. RTL/LTR checks

- Playwright projects run each E2E spec twice (`locale: ar`, `locale: en`).
- Lint rule `local/logical-css` bans physical direction utilities (`ml-`, `pr-`, `left-`…) in app
  class strings (P3, with RuleTester tests).
- Snapshot tests for mixed content: Arabic message containing an English product name, phone
  number and price.

## 5. AI evaluation gates (from P6)

| Metric                                                        | Gate    |
| ------------------------------------------------------------- | ------- |
| Reply language matches customer language                      | ≥ 98 %  |
| Grounded in provided knowledge (judge + rules)                | ≥ 95 %  |
| Invented prices / hours / policies                            | 0       |
| Correct tool call when expected (orders/reservations/handoff) | ≥ 95 %  |
| Unnecessary handoff                                           | ≤ 5 %   |
| p95 latency (widget, end-to-end)                              | ≤ 6 s   |
| Escalation rate (Haiku → Sonnet) on the golden set            | 10–20 % |

The language-match, grounding and invented-facts gates apply **per dialect** (Gulf, Egyptian,
MSA) on the Arabic dialect eval set, run with production routing (decision A15). A failure in
any dialect switches the `standard` profile's `generation_model` in the DB and the eval is re-run.

## 6. Test data

- `supabase/seed.sql` (P2) creates a bilingual demo restaurant (Riyadh) for the local stack and
  CI only — never the dev or production project. More verticals (clinic in Cairo, store in
  Dubai) are added with the features that need them. Fictional names only. pgTAP fixtures use
  their own ids and never depend on seed rows.
- No production data in non-production environments.
