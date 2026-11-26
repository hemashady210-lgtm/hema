# Security

Scope: tenant isolation, secrets, credentials, webhooks, widget, AI path, audit. Source rules:
CLAUDE.md (non-negotiables, which win), MASTER_PROMPT §7, DECISIONS §D/§E. The database part is
**implemented and tested** (P2); the edge-function controls are designed here and built in the
phase of each function (`ROADMAP.md`).

## 1. Threat model (summary)

| Actor                    | Wants                                              | Main controls                                                                    |
| ------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Member of workspace A    | read / change workspace B's data                   | RLS on every table, composite FKs, role matrix tests                             |
| Low-privilege member     | act above their role (viewer edits, agent billing) | role-based policies + column grants (DATABASE §4)                                |
| Customer (owner/admin)   | fake a status, unlock a paid feature or model      | server-only columns, DB constraints, limit triggers, model from entitlement only |
| Anonymous internet       | read data through the REST API, abuse RPCs         | `anon` reads only the pricing catalogue; every RPC revoked from `anon`           |
| Website visitor (widget) | read other conversations, spam, inject prompts     | public key + exact Origin + signed session token, rate limits, data-only prompts |
| Forged webhook sender    | inject messages / payments                         | signature verification before parsing, idempotent `webhook_events`               |
| Leaked dashboard JWT     | read credentials                                   | `channel_credentials` + Vault unreadable by any client role                      |

## 2. Tenant isolation (implemented, P2)

- **RLS on every table** in `public` and on every analytics partition. Policies only target
  `authenticated` (and `anon` on the pricing catalogue) and use the `private.*` helpers
  (`is_workspace_member`, `has_workspace_role`, `can_write`, `workspace_is_writable`,
  `is_platform_admin`). Every INSERT/UPDATE policy has a `WITH CHECK`.
- **Composite foreign keys** `(workspace_id, id)` on core relations: no row can reference another
  tenant's row, even when written with the service role.
- **Column grants**: clients can only set the columns listed in DATABASE §4; e.g. `bots.status`,
  `readiness_score`, `public_key`, every `channels` column, `workspaces.status`.
- **Read-only workspaces** (trial ended, unpaid): `can_write` requires `status = 'active'`.
- **Service-role-only tables** (RLS on, no policies, no client privileges):
  `channel_credentials`, `webhook_events`, `analytics_events` (+ partitions), `jobs`,
  `usage_events`, `kb_chunks`, `provider_price_refs`, `ai_model_profiles`, `ai_model_prices`,
  `platform_events`, `internal_notes`, `platform_settings`.
- **Unexposed schema**: `private` (helpers, analytics partitions) is not in the PostgREST
  exposed schemas (checked on the dev project: `PGRST106 Invalid schema: private`).
- **Functions**: every function pins `search_path = ''`; every function is revoked from
  `PUBLIC`/`anon`/`authenticated` and granted per use (only `get_workspace_entitlements`, the
  RLS helpers and the i18n validators used by CHECK constraints are callable by
  `authenticated`; nothing by `anon`).
- **Security checks before plan checks**: BEFORE triggers on client-writable tables first apply
  the same write rule as RLS, so another tenant's limits or features never leak through
  `plan_limit:` / `plan_feature:` errors (cross-tenant probes get `42501`).
- **`workspace_id` is immutable** on every tenant table (trigger), so rows cannot be moved into
  another workspace to dodge insert-time limits.
- **No TRUNCATE / REFERENCES / TRIGGER / MAINTAIN** for client roles on any table.
- **Storage**: private buckets (`knowledge-files`, `attachments`, `exports`) have **no client
  read policies**; downloads go through `api`, which checks membership and returns short-lived
  signed URLs made with the service role (clients cannot mint long-lived URLs that survive their
  removal). The public bucket accepts PNG/JPEG/WebP only (no SVG).

### Evidence

| Check                                                                                                                                         | Where                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Every table × op × role (owner, admin, agent, viewer, other tenant, anon); platform tables; limit-leak probes; full workspace deletion        | `04_role_matrix` (268 assertions)                         |
| Catalog-wide conventions (RLS, indexes, grants, policies, functions, immutability triggers, storage policies)                                 | `03_schema_conventions` (21)                              |
| Cross-tenant references impossible                                                                                                            | `05_cross_tenant_references` (18)                         |
| Credential isolation + Vault (incl. disconnect cleanup)                                                                                       | `06_channel_credentials` (16)                             |
| Metering (release → retry re-reserved), entitlements from paid subscriptions only, plan gates                                                 | `02_plan_limits_metering` (47)                            |
| Results                                                                                                                                       | 459/459 on the dev project, in CI and locally             |
| Concurrent inserts at a plan limit (two sessions)                                                                                             | manual check, local Postgres, 2026-11-26: second rejected |
| REST layer (dev project, real keys): `anon` → 401 `42501` on tenant tables, service-only tables and RPCs; pricing readable; trial plan hidden | manual check 2026-11-26 (P2)                              |

## 3. Credentials and secrets

- **Channel tokens**: Supabase Vault (`vault.create_secret`); `channel_credentials` holds the
  secret id, scopes and expiry, and is readable by the service role only. Replacing or deleting a
  credential (or its channel / workspace) deletes the Vault secret (trigger, suite 06). Meta
  passwords are never asked for or stored (§7).
- **Browser**: only `VITE_*` publishable values (Supabase URL + publishable/anon key, widget CDN
  URL, feature toggles). Never the secret/service key or vendor keys.
- **Edge Function secrets**: service key, Anthropic, Voyage, Resend, PayPal, Meta app secret and
  verify token, `WIDGET_SIGNING_SECRET`, `N8N_SHARED_SECRET`.
- **API keys** (Enterprise): stored as SHA-256 hash + display prefix; the hash column is not
  client-readable; scopes; revocable.
- **Never commit** `.env` files; `.env.example` holds placeholders only.

## 4. Integrity rules enforced by the database

| Rule                                                                  | Mechanism                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Never show a Meta channel as connected without a passing health check | check constraint `channels_connected_requires_health`                                                   |
| One external account live in one workspace only                       | partial unique index on `(channel_type, external_account_id)`                                           |
| Playground never billed                                               | `consume_ai_reply` refuses `is_test` runs; check `not (is_test and billed)`                             |
| Every AI reply metered, retries included                              | a released reply is re-reserved under a new ledger attempt; keys bound to one workspace                 |
| A run of workspace A cannot consume workspace B's quota               | `consume_ai_reply` checks the run's and the key's workspace                                             |
| Only paid / trial subscriptions grant entitlements                    | `live_subscription` = trialing / active / past_due / grace; `pending_activation` grants nothing         |
| Model tier cannot be chosen by the customer                           | profile only from the `ai_model_profile` entitlement                                                    |
| Prices / totals server-side (P15)                                     | `order_items` snapshots + `total = subtotal + delivery_fee` check                                       |
| Append-only history                                                   | `audit_logs`, `billing_events`, `bot_configs` reject UPDATE/DELETE (FK cascades allowed)                |
| Plan limits on every path, race-safe (P4)                             | limit triggers with a per-workspace advisory lock, raising `plan_limit:` / `plan_feature:`              |
| Human takeover only with `human_handoff`                              | trigger on `conversations.handler`                                                                      |
| Assignees are real agents                                             | trigger on `conversations.assigned_to`                                                                  |
| No orphaned tokens                                                    | credential row deleted on disconnect / channel / workspace deletion; Vault secret deleted with it       |
| Rows stay in their workspace                                          | `workspace_id` immutable (trigger on every tenant table)                                                |
| Bounded client input                                                  | size caps on flexible jsonb / array columns; asset paths scoped to the row's prefix; ISO currency codes |

## 5. Edge-function controls (designed; built per phase)

- **Webhooks** (`webhook-meta` P13, `webhook-paypal` P12): verify `X-Hub-Signature-256` (Meta
  app secret) / PayPal verify-webhook-signature **before** parsing; reject invalid; store in
  `webhook_events` unique `(provider, event_id)`; ack fast; process idempotently. Vendor details
  are **needs verification**.
- **Widget** (`widget-gateway`, P8): bot public key + exact Origin match against
  `allowed_origins` (empty = disabled) → short-lived signed session token; per-IP, per-bot and
  per-visitor rate limits; size caps; no secrets client-side; Realtime pings carry no content.
- **API** (`api`, P3+): zod validation on every endpoint, error envelope without other tenants'
  data, rate limits, `Idempotency-Key`; admin routes require a `platform_admins` row and write
  `audit_logs`.
- **Uploads**: type/size limits from entitlements, private buckets, per-workspace paths, signed
  URLs (signed upload URL vs Storage RLS = **needs verification**, P5).
- **Prompt injection**: business instructions and KB content are data, not system prompt;
  customer text is user-role content; tools take workspace / bot / conversation from the job,
  never from the model; prices and ids come from the database.

## 6. Supabase keys (verified against Supabase docs, 2026-11-26)

- Current key types: publishable `sb_publishable_…` and secret `sb_secret_…`. Legacy `anon` /
  `service_role` JWT keys still work alongside them; **Supabase is deprecating the legacy keys in
  early 2027** (RISKS R-21).
- New keys go in the `apikey` header, not `Authorization: Bearer`. Inside Edge Functions,
  Supabase documents `SUPABASE_SECRET_KEYS`; `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
  still exist but are on the deprecated path. A secret key is rejected when used from a browser.
- Our env names stay as in §21 (E12): `SUPABASE_ANON_KEY` should hold the **publishable** key and
  `SUPABASE_SERVICE_ROLE_KEY` a **secret** key. The dev environment currently provides legacy JWT
  keys; switch before 2027.

## 7. Findings fixed in P2

Design findings fixed while writing the P2 schema (migrations 0001–0012):

| Finding (Phase 01 design)                                                                             | Fix                                                            |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Vault secret reference stored on the member-readable channel row                                      | `channel_credentials`, service role only                       |
| `bots.model_profile_id` client-writable → a customer could select the Enterprise-only premium profile | removed; profile from entitlement only                         |
| Bot status / readiness writable by clients                                                            | column grants (server-only)                                    |
| `anon` inherited platform default grants on every new table                                           | default + final sweep: `anon` only reads the pricing catalogue |
| Several child tables lacked composite FKs                                                             | composite FKs added                                            |
| Conversations could be assigned to any user id                                                        | assignee must be an active owner/admin/agent                   |

Review findings (code-reviewer + security-reviewer subagents, 2026-11-26), fixed in forward
migration `…20261126000100_p2_review_fixes` with regression tests:

| Severity  | Finding                                                                                                                                                                                                                                            | Fix                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| medium    | Concurrent inserts passed plan limits (count without lock)                                                                                                                                                                                         | advisory lock per workspace + limit key                            |
| medium    | `consume → release → consume` with the same key was allowed and never counted                                                                                                                                                                      | re-reservation under `<key>:r<n>`; workspace-bound keys            |
| medium    | `pending_activation` granted the target plan's entitlements before payment                                                                                                                                                                         | entitling statuses only; separate unique index for one pending row |
| medium    | Clients could mint long-lived signed URLs on private buckets                                                                                                                                                                                       | client read policies removed; downloads via `api`                  |
| medium    | Hard delete failed for any workspace with structured knowledge (re-index job FK)                                                                                                                                                                   | re-index skipped for a workspace being deleted; full-deletion test |
| important | Manual Meta connect step rejected by its own request's slot                                                                                                                                                                                        | the fulfilled request is not counted twice                         |
| important | Mid-trial upgrade stayed on the trial period; month-end anchors produced ended periods                                                                                                                                                             | periods per subscription (open only); UTC month bounds             |
| important | Admin deleting a bot wiped channels, credentials, Vault token and history                                                                                                                                                                          | `DELETE` on bots revoked for clients (via `api`)                   |
| important | `handler = human` bypassed the `human_handoff` gate                                                                                                                                                                                                | trigger on `handler`                                               |
| low       | BEFORE triggers revealed another tenant's plan via `plan_limit` errors                                                                                                                                                                             | RLS-equivalent check first                                         |
| low       | Rows could move between workspaces                                                                                                                                                                                                                 | `workspace_id` immutable                                           |
| low       | File KB sources deletable directly (orphaned storage, quota bypass)                                                                                                                                                                                | delete policy excludes `file`                                      |
| low       | Test runner's COMMIT guard missed `END` / `COMMIT AND CHAIN`                                                                                                                                                                                       | statement-level guard; applied-migration drift check               |
| hardening | TRUNCATE/REFERENCES/TRIGGER/MAINTAIN grants, SVG in public bucket, unbounded jsonb, unscoped asset paths, empty i18n, currency format, `kb_chunks.bot_id` FK, disconnect leaving tokens, queue workers finishing others' jobs, known seed password | fixed (see migration header)                                       |

## 8. Open items

- **Owner decision:** billing history (`payment_transactions`, `billing_events`,
  `invoices_records`) is cascade-deleted with a workspace today; DATABASE §7 / C8 expect it to
  be retained (anonymized) — choose archive-before-delete or retained FKs (legal retention =
  **needs verification**). The deletion job is built in P10.
- **Owner decision:** row quotas for FAQs / catalog items per plan (limits are data; not in the
  approved pricing) to cap embedding and prompt cost on trials.
- `consume_ai_reply` can only refuse playground runs when the worker passes `ai_run_id`; P7 must
  always pass it.
- Security review / RLS audit and pen-test checklist (P16) · rate limits (P3/P8) · Realtime
  broadcast authorization (**needs verification**) · legal retention rules (**needs
  verification**) · rotate to new Supabase keys before 2027 · consider running remote pgTAP on a
  Supabase branch instead of the shared dev database · **revoke the P2 personal access token**.
