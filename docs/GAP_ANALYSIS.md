# Gap Analysis: Phase 01 work vs MASTER_PROMPT + ADDENDUM

Date: 2026-11-26. Scope: `docs/*` and the 12 migrations in `supabase/migrations/` (plus
`.env.example`, CI and the scaffold), compared with `docs/MASTER_PROMPT.md` §0–§25 and its
ADDENDUM.

**Status: every item is resolved.** The owner decided all items on 2026-11-26; the decisions are
recorded in `DECISIONS.md` §E and each item is assigned to a phase in `ROADMAP.md`. **All P2
items are done** (2026-11-26): applied to the Supabase dev project and covered by the pgTAP suite
(394/394 on the dev project and in CI). Feature items remain in the phase shown.

Legend: ✅ resolved (decision + phase) · ✅ done (completed in this session)

**Correction (2026-11-26).** The first version of this report listed `N8N_WEBHOOK_URL` and
`N8N_SHARED_SECRET` as missing from `.env.example`. That was wrong. The check skipped variable
names that contain digits. `N8N_WEBHOOK_URL` existed, and `N8N_WEBHOOK_SECRET` already played
the role of the shared secret. It has now been renamed to `N8N_SHARED_SECRET`.

---

## 1. Conflicts → owner decisions

| #   | Topic                    | Decision (DECISIONS §E)                                                                                                                                                                                         | Phase           | Status  |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------- |
| 1   | Job queue                | **E1:** keep the custom `jobs` table. Dead state already exists; add `retry_job()` (P2), a UI failure state (P7) and an admin dead-letter viewer with retry (P14). MASTER_PROMPT now says "Postgres jobs table" | P2, P7, P14     | ✅      |
| 2   | Meta OAuth / Emb. Signup | **E2:** build in P13 behind `meta_embedded_signup` (OFF); manual mode is the active path; A14 updated                                                                                                           | P13             | ✅      |
| 3   | Phase plan               | **E3:** P1–P17 adopted; dialect eval in P6; ROADMAP rewritten                                                                                                                                                   | —               | ✅ done |
| 4   | Table names              | **E9:** master names, except tested objects whose rename adds risk (entitlement tables, `usage_events`, `ai_model_profiles`/`ai_model_prices`, `jobs`). Full map in DECISIONS §E9                               | P2              | ✅      |
| 5   | Conversation model       | **E10** (resolved by the general rule E0): master `status` open/pending/closed + `handler` ai/human                                                                                                             | P2              | ✅      |
| 6   | Subscription states      | **E4:** add `grace` (3 days). `pending_activation` kept (approved, E13)                                                                                                                                         | P2, P12         | ✅      |
| 7   | Channel status enum      | **E5:** not_connected / pending / connected / error / disabled; `connection_mode` automatic / manual / oauth                                                                                                    | P2              | ✅      |
| 8   | AI tool set              | **E6:** add `get_policy`; master tool names; `confirm_order`, `capture_contact_details` kept (approved, E13)                                                                                                    | P6              | ✅      |
| 9   | Edge function topology   | **E7:** split per §4 (`admin` → `api` `admin/*`; `worker` → `ai-worker` / `kb-ingest` / `scheduler`)                                                                                                            | Built per phase | ✅      |
| 10  | Google sign-in           | **E8:** P3, configurable, off when not configured (`VITE_AUTH_GOOGLE_ENABLED`)                                                                                                                                  | P3              | ✅      |
| 11  | Doc file names           | **E11:** master names + SECURITY.md, DEPLOYMENT.md, along with the doc sync                                                                                                                                     | P2              | ✅      |

New finding while reconciling (not in the first report): §6 keeps channel credentials in a
separate `channel_credentials` table that no client role can read. Phase 01 stores the Vault
secret reference on the member-readable channel row. Adopted per E0 → **P2**.

## 2. Missing items → phase

**P2 Database & security** (all missing tables and columns; owner rule: "all missing TABLES → P2")

| Item                                                                                                                                                    | Status       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `feature_flags` (+ `meta_embedded_signup` row, OFF)                                                                                                     | ✅ done (P2) |
| `notifications` (in-app)                                                                                                                                | ✅ done (P2) |
| `billing_events` (append-only)                                                                                                                          | ✅ done (P2) |
| Generic `webhook_events` covering Meta + PayPal, with status + attempts                                                                                 | ✅ done (P2) |
| `analytics_events` (monthly partitions) + `analytics_daily`                                                                                             | ✅ done (P2) |
| Knowledge-gap storage                                                                                                                                   | ✅ done (P2) |
| `bot_tests`, `bot_test_cases`, `bot_test_results`; bot `status` + `readiness_score`                                                                     | ✅ done (P2) |
| Channel health-check fields (last check at / result)                                                                                                    | ✅ done (P2) |
| WhatsApp templates schema                                                                                                                               | ✅ done (P2) |
| Versioned `bot_configs`                                                                                                                                 | ✅ done (P2) |
| `working_hours` + holiday overrides; typed `policies`; `faqs.tags`; KB types policy/manual                                                              | ✅ done (P2) |
| `invoices_records` (overage invoices)                                                                                                                   | ✅ done (P2) |
| `orders.delivery_fee_cents`; `conversations.last_message_preview`                                                                                       | ✅ done (P2) |
| Conversation internal notes (agents) + customer notes                                                                                                   | ✅ done (P2) |
| Onboarding progress state                                                                                                                               | ✅ done (P2) |
| `widget_settings.installed_verified_at`                                                                                                                 | ✅ done (P2) |
| Sandbox/test markers on `messages` / `ai_runs` (playground not billed)                                                                                  | ✅ done (P2) |
| Question category constrained to the §6 taxonomy                                                                                                        | ✅ done (P2) |
| `channel_credentials` (new finding above)                                                                                                               | ✅ done (P2) |
| `retry_job()` for dead jobs (E1)                                                                                                                        | ✅ done (P2) |
| pgTAP for every table + role matrix, run on the real Supabase stack                                                                                     | ✅ done (P2) |
| `supabase/seed.sql` (local demo data; plans stay seeded by migration)                                                                                   | ✅ done (P2) |
| Doc sync: rename docs (E11); ARCHITECTURE, DATABASE (+ ERD), API, AI_ENGINE, BILLING, INTEGRATIONS, TESTING in line with §E; SECURITY.md, DEPLOYMENT.md | ✅ done (P2) |

**Features** (owner rule: "features → their matching phase")

| Item                                                                                                  | Phase | Status |
| ----------------------------------------------------------------------------------------------------- | ----- | ------ |
| Google sign-in (configurable)                                                                         | P3    | ✅     |
| Onboarding wizard (saveable/resumable); catalog CSV import                                            | P4    | ✅     |
| Knowledge-gap logging in the AI engine; `get_policy` tool; dialect eval                               | P6    | ✅     |
| Dead-letter failure state visible in UI; `packages/channel-adapters`                                  | P7    | ✅     |
| Widget installation verification; signed widget session token                                         | P8    | ✅     |
| Agent internal notes, customer notes; orders/reservations CSV export                                  | P9    | ✅     |
| Rollups (15 min + nightly), unique customers, response time, 10-day charts, knowledge-gaps list       | P10   | ✅     |
| Playground & readiness (entire §13)                                                                   | P11   | ✅     |
| PayPal setup script; `grace` lifecycle; overage invoices                                              | P12   | ✅     |
| Health checks stored + shown; WhatsApp template sending; flagged Embedded Signup / Facebook Login     | P13   | ✅     |
| Read-only impersonation (audited); platform metrics incl. MRR; feature-flag UI; dead-letter retry UI  | P14   | ✅     |
| Emails (verify, invite, reset, payment failed, handoff, …); in-app notification center; `n8n/` folder | P15   | ✅     |
| Performance targets (webhook ack < 500 ms, overview < 1.5 s); zero-duplicate gates                    | P16   | ✅     |
| Deploy policy (staging on `main`, production on tag)                                                  | P17   | ✅     |

**Env vars** (owner rule: "env vars → now in .env.example"). ✅ **done**: `.env.example` uses the §21 names.

| §21 name                             | Before                          | Now                                                                                     |
| ------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------- |
| `SUPABASE_ANON_KEY` (+ `VITE_` copy) | `VITE_SUPABASE_PUBLISHABLE_KEY` | renamed (the value may be the publishable key; needs verification)                      |
| `META_VERIFY_TOKEN`                  | `META_WEBHOOK_VERIFY_TOKEN`     | renamed                                                                                 |
| `APP_URL`                            | `APP_BASE_URL`                  | renamed                                                                                 |
| `WIDGET_CDN_URL` (+ `VITE_` copy)    | `VITE_WIDGET_CDN_URL` only      | added                                                                                   |
| `WIDGET_SIGNING_SECRET`              | `WIDGET_VISITOR_TOKEN_PEPPER`   | renamed (signed session tokens, §7)                                                     |
| `META_CONFIG_ID`                     | missing                         | added                                                                                   |
| `N8N_WEBHOOK_URL`                    | present (see correction above)  | unchanged                                                                               |
| `N8N_SHARED_SECRET`                  | `N8N_WEBHOOK_SECRET`            | renamed                                                                                 |
| Google auth (E8)                     | missing                         | `VITE_AUTH_GOOGLE_ENABLED`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` (names need verification) |

Both apps' `vite-env.d.ts` typings were updated to match the renamed browser variable.

## 3. Already covered (unchanged — keep)

- Tenancy: workspace → optional branches → bots; `workspace_id NOT NULL` + composite FKs
  `(workspace_id, id)`; RLS on every table with `private.*` helpers; separate
  `platform_admins`; one owner per workspace; hashed, expiring invitations.
- Plans as data; the seed matches §14 and the ADDENDUM: Starter $39 / 1,000 / 1 bot /
  1 user / 1 Meta channel / hard stop; Growth $99 / 5,000 / 2 bots / 3 users / 3 Meta channels /
  overage $10 per 1,000; Enterprise from $299 with unlimited Meta channels; trial 7 days / 100 /
  1 bot / 1 user / widget only; annual = 10× monthly; $49 refundable connection fee.
- Metering: `consume_ai_reply` / `release_ai_reply`, idempotency keys, monthly periods on
  annual plans, 80/100 % alerts, limits enforced by triggers.
- Model routing = ADDENDUM (Haiku 5.5 default, Sonnet 5.5 escalation, Opus 5.5 premium only).
- RAG: vector(1024) + HNSW + FTS hybrid search scoped by workspace + bot; re-index triggers;
  checksums.
- Idempotency: unique message external ids, unique webhook event ids, usage idempotency keys.
- Vault for tokens; manual Meta request flow + fee + history; widget public key + origin
  allow-list + content-free Realtime ping; Preact widget; `/admin` inside the dashboard.
- Orders/reservations with server-side prices; handoffs; append-only audit log; data
  export/delete; retention per plan; private storage buckets; API keys stored as hashes.
- Design system (dark-first, Royal Blue, IBM Plex Sans Arabic + Inter, ⌘K, RTL, AA); product
  name only in `brand.ts`.

## 4. Still open (owner)

- ~~OK or veto for the items kept pending approval~~: **all three approved** (DECISIONS E13):
  `allowed_origins`, `pending_activation`, `confirm_order` + `capture_contact_details`.
- ~~Approve the P2 plan, including the column-level rename list~~: approved and applied (2026-11-26).
