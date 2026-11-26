# Gap Analysis: Phase 01 work vs MASTER_PROMPT + ADDENDUM

Date: 2026-11-26. Scope: `docs/*` and the 12 migrations in `supabase/migrations/` (plus
`.env.example`, CI and the scaffold), compared with `docs/MASTER_PROMPT.md` §0–§25 and its
ADDENDUM. **Report only. Nothing has been changed to close these gaps yet.**

Method: I read every migration and the relevant sections of each doc, then searched docs and
migrations for each master-prompt requirement. "Missing" means it appears in no doc and no
migration. The migrations have **not** been applied to a real Supabase stack (only to a stub
Postgres in Phase 01), so nothing below is runtime-verified.

Legend: ⚠️ conflict (needs owner decision) · ❌ missing · 🔶 partial or renamed · ✅ covered

---

## 1. Conflicts that need an owner decision

These conflict with an **approved** entry in `DECISIONS.md` or `ROADMAP.md`, or are naming choices
that every later phase depends on. Migrations have not been applied anywhere, so changing them
now costs little.

| #    | Topic                    | Master prompt says                                                                                                                               | Phase 01 has                                                                                                                                                                 | Options                                                                                                                       |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ⚠️1  | Job queue                | Supabase Queues / **pgmq** (§3, §8)                                                                                                              | Custom `jobs` table + `claim_jobs()` with `SKIP LOCKED`, approved as **P1** (pgmq explicitly rejected)                                                                       | Keep P1 and amend the prompt, **or** switch to pgmq (rewrite 0009/0010 queue parts)                                           |
| ⚠️2  | Meta OAuth / Emb. Signup | **Build** Embedded Signup v4 (WhatsApp) and Facebook Login for Business (Messenger/IG) behind flag `meta_embedded_signup`, OFF (§11.2–11.4, P13) | **A14**: "No Meta OAuth / Embedded Signup now". ROADMAP puts it in Phase 10 (post-launch). Enum has `embedded_signup` only; no `oauth` method for Messenger/IG               | Supersede A14 (build behind flag in P13) **or** keep A14                                                                      |
| ⚠️3  | Phase plan               | 17 phases P1–P17 (§22); dialect eval in **P6**                                                                                                   | `ROADMAP.md` has 10 phases; Phase 02 "Platform core" ≈ master P2 + P3; dialect eval in **Phase 04**; Growth features (orders, handoff) in a separate Phase 08                | Rewrite ROADMAP to P1–P17 and re-label progress (Phase 01 = P1 done)                                                          |
| ⚠️4  | Table names              | `customers`, `customer_identities`, `channels`, `kb_sources`, `kb_documents`, `faqs`, `subscription_plans`, `webhook_events`, `usage_records`    | `contacts`, `contact_identities`, `channel_connections`, `knowledge_sources` (sources + documents merged), `knowledge_qa`, `plans`, `payment_webhook_events`, `usage_events` | Keep the repo names and document the mapping in DATABASE.md (the prompt allows "merge/split if justified"), **or** rename now |
| ⚠️5  | Conversation model       | `status` open/pending/closed + `handler` ai/human                                                                                                | `status` open/pending_handoff/human/closed + `ai_paused` boolean                                                                                                             | Keep (equivalent; documented in AI_ENGINE §8) **or** reshape                                                                  |
| ⚠️6  | Subscription states      | trialing → active → past_due → **grace (3 days)** → suspended; canceled → expired                                                                | Enum has no `grace`. Has `pending_activation` (manual path). BILLING.md: `past_due → suspended` when "grace elapsed" (implicit). `workspace_status` has `read_only`          | Add `grace` + `grace_ends_at`, **or** model grace as a timed `past_due` and amend the prompt                                  |
| ⚠️7  | Channel status enum      | not_connected / pending / connected / error / **disabled**; mode manual / **oauth**                                                              | not_connected / pending / **in_progress** / connected / error / **disconnected** / **rejected**; method automatic / manual / embedded_signup                                 | Add `disabled` (+ `oauth` if ⚠️2 changes); keep the richer states                                                             |
| ⚠️8  | AI tool set              | get_catalog, check_working_hours, create_order, create_reservation, request_human_handoff, **get_policy**                                        | search_catalog, get_business_hours, create_order, **confirm_order**, create_reservation, request_handoff, **capture_contact_details**; **no get_policy**                     | Add `get_policy`; settle the names                                                                                            |
| ⚠️9  | Edge function topology   | api, widget-gateway, webhook-meta, webhook-paypal, ai-worker, **kb-ingest**, **scheduler**, \_shared                                             | api, widget, worker (runs every job type incl. ingestion and cron work), webhooks-meta, webhooks-paypal, **admin**                                                           | Keep the merged worker (fewer cold starts) and document why, **or** split it                                                  |
| ⚠️10 | Google sign-in           | Email+password, magic link, **Google OAuth (configurable)** in auth phase (§12.1)                                                                | ROADMAP Phase 02: "email + magic link; Google later"                                                                                                                         | Include Google in P3 behind config, **or** defer                                                                              |
| ⚠️11 | Doc file names           | API.md, INTEGRATIONS.md, TESTING.md, RISKS.md, SECURITY.md, DEPLOYMENT.md (§4)                                                                   | API_SPEC.md, CHANNELS.md, TESTING_STRATEGY.md, RISK_REGISTER.md; SECURITY.md and DEPLOYMENT.md do not exist (CLAUDE.md also references the current names)                    | Rename and update CLAUDE.md, **or** keep and amend §4                                                                         |

## 2. Missing: no design and no schema

Grouped by master-prompt phase (§22).

**P2 Database & security**

- ❌ `feature_flags` (key, scope global/workspace, enabled). The P13 flag `meta_embedded_signup`
  needs it. `platform_settings` is global key/value only.
- ❌ `notifications` (in-app: user/workspace, type, read_at). Needed for handoff alerts, usage
  alerts and the notification center (§12.12).
- ❌ `billing_events` (append-only audit of every billing state change, §6/§14). Today the
  history is spread over `billing_transactions`, `audit_logs` and `payment_webhook_events`.
- ❌ Generic `webhook_events` covering **Meta** (provider, event_id, signature_valid,
  status received/processed/failed/ignored, attempts). `payment_webhook_events` covers payments
  only and has no status or attempt columns. Meta dedupe relies on the unique index on
  `messages` external ids alone, so status-only events have no inbox.
- ❌ `analytics_events` (append-only, **monthly partitions**) and `analytics_daily` rollups (§6, §18).
- 🔶 pgTAP coverage: 2 suites (32 assertions) cover a subset of tables. §20 requires every
  table plus a role matrix.

**P4 Onboarding & business data**

- ❌ Onboarding wizard state (saveable, resumable, progress) (§12.1).
- ❌ Catalog CSV import (§12.1); orders/reservations CSV export (§12.5). No API routes in the spec.
- 🔶 Working hours: `business_profiles.opening_hours` + `special_hours` JSONB (per branch via
  `branch_id`) rather than a `working_hours` table. Functionally covered; the deviation is not
  documented as a "merge, justified".
- 🔶 Policies: `business_profiles.policies` JSONB, not a typed `policies` table
  (delivery/refund/reservation/other).
- 🔶 FAQs: `knowledge_qa` has `language` and alternative phrasings but no `tags`.
- ❌ `orders.delivery_fee` (only subtotal/total) (§6).

**P5 Knowledge base**

- 🔶 Source types: `business_info | qa | catalog | file | url`. The prompt's `policy` and
  `manual` (free-text notes) types are missing. There is no separate `kb_documents` table
  (merged into `knowledge_sources`).

**P6 AI engine**

- ❌ **Knowledge-gap logging** (questions the AI could not answer, §9, §12.2). No table, field
  or design.
- ❌ `get_policy` tool (see ⚠️8).
- 🔶 `message_classifications.category` is free text. The prompt fixes the taxonomy
  menu_products / reservations / prices / working_hours / services / complaints / orders / other.
- ❌ `bot_configs` **versioning** (§6, §12.7). Bot settings live inline on `bots`. Model settings
  live in `ai_model_profiles`. There is no `temperature`, no persona field and no version history.

**P8 Website widget**

- ❌ Installation verification (widget ping → "installed on domain X at time Y",
  `installed_verified_at`) (§11.1).
- 🔶 `.env.example` has `WIDGET_VISITOR_TOKEN_PEPPER`. The prompt names `WIDGET_SIGNING_SECRET`
  (short-lived **signed** session token). The token scheme must be settled.

**P9 Inbox & CRM**

- ❌ `conversations.last_message_preview` (§6, §8).
- ❌ Agent **internal notes** on conversations and **customer notes** (§12.3/§12.4).
  `internal_notes` is Super-Admin-only by design.

**P10 Dashboard & analytics**

- ❌ Rollup jobs (15 min + nightly reconciliation), unique-customers metric, response time =
  inbound→outbound, 10-day charts. No design (depends on `analytics_*` above).

**P11 Playground & readiness (entire §13)**

- ❌ Sandbox chat (not billed, separately rate-limited, flagged as test). No `is_test` marker on
  `messages`/`ai_runs`, and no billing exemption in `consume_ai_reply`.
- ❌ `bot_tests`, `bot_test_cases`, `bot_test_results`; auto-generated suite from KB.
- ❌ Bot status `draft/testing/ready/active/paused` + `readiness_score` (bots only have
  `is_active`); the 9-point weighted readiness checklist.
- ROADMAP mentions only a "test panel" in Phase 04.

**P12 Billing**

- ❌ Idempotent PayPal products/plans **setup script** (§14).
- 🔶 Overage invoices: `usage_periods.overage_transaction_id` → `billing_transactions` instead
  of an `invoices_records` table with its own status.
- 🔶 `grace` state (⚠️6).

**P13 Meta channels**

- ❌ Stored **health check** result/timestamp on `channel_connections` (Connect card shows
  "last health check", §11.5). The state machine already requires a live check before
  `connected`.
- ❌ WhatsApp **template** schema + sending (§11.2). Only the `template` content type exists.
- ❌ `META_CONFIG_ID` (Embedded Signup config) in `.env.example`.

**P14 Super Admin**

- ❌ Read-only **impersonation** (audited), **platform metrics** (MRR, active workspaces,
  AI cost vs revenue, error rates).
- ❌ Feature-flag management (depends on `feature_flags`).

**P15 Notifications, emails, n8n**

- ❌ Email set: verify email, invite, password reset, payment failed, handoff alert. Today the
  `platform_events` types cover requests, subscription, usage, trial and daily report only.
  Whether auth emails go through Supabase Auth or a Resend SMTP setup is **needs verification**.
- ❌ n8n **monthly workspace report**; `/n8n` folder with exported workflows;
  `N8N_WEBHOOK_URL` + `N8N_SHARED_SECRET`.

**P16 Hardening / P17 Deployment**

- ❌ Performance targets: webhook ack < 500 ms p95 and overview < 1.5 s are not in
  TESTING_STRATEGY. Only the widget ≤ 6 s p95 target is present.
- ❌ Deploy policy "staging on merge to main, production on tag". `DEPLOYMENT.md` and
  `SECURITY.md` do not exist.
- ❌ Zero-duplicate gates (usage records, processed webhooks) are not listed as CI gates.

**Repo structure (§4)**

- ❌ `packages/channel-adapters/`, `n8n/`, `supabase/seed.sql` (reference data is seeded by
  migration `…001200` instead; deliberate but undocumented as a deviation).
- 🔶 Stack libs not mentioned in ARCHITECTURE: Recharts, React Hook Form, Turborepo (optional).

**Env vars (§21)**: renamed or missing vs the prompt's list

| Prompt                  | Repo `.env.example`                                                             |
| ----------------------- | ------------------------------------------------------------------------------- |
| `SUPABASE_ANON_KEY`     | `VITE_SUPABASE_PUBLISHABLE_KEY` (newer Supabase key naming, needs verification) |
| `META_VERIFY_TOKEN`     | `META_WEBHOOK_VERIFY_TOKEN`                                                     |
| `APP_URL`               | `APP_BASE_URL`                                                                  |
| `WIDGET_CDN_URL`        | `VITE_WIDGET_CDN_URL`                                                           |
| `WIDGET_SIGNING_SECRET` | ❌ (has `WIDGET_VISITOR_TOKEN_PEPPER`)                                          |
| `META_CONFIG_ID`        | ❌                                                                              |
| `N8N_WEBHOOK_URL`       | ❌                                                                              |
| `N8N_SHARED_SECRET`     | ❌                                                                              |

## 3. Already covered (keep)

- ✅ Tenancy: workspace → optional branches → bots; `workspace_id NOT NULL` + composite FKs
  `(workspace_id, id)`; RLS enabled on every table with `private.*` SECURITY DEFINER helpers;
  separate `platform_admins`; one owner per workspace; hashed, expiring invitations.
- ✅ Plans as data: `plans`, `plan_prices`, `entitlement_definitions`, `plan_entitlements`,
  overrides. The seed matches §14 and the ADDENDUM: Starter $39 / 1,000 / 1 bot / 1 user /
  1 Meta channel / hard stop; Growth $99 / 5,000 / 2 bots / 3 users / 3 Meta channels /
  overage $10 per 1,000; Enterprise from $299 with unlimited Meta channels; trial 7 days /
  100 / 1 bot / 1 user / widget only; annual = 10× monthly; $49 refundable connection fee.
- ✅ Metering: `consume_ai_reply` / `release_ai_reply`, idempotency keys, monthly periods
  even on annual plans (P11), 80/100 % alerts, limits enforced by triggers.
- ✅ Model routing = ADDENDUM: `ai_model_profiles` rows (Haiku 5.5 default, Sonnet 5.5
  escalation on complaint / low confidence / complex, Opus 5.5 premium-only), escalation
  fields on `ai_runs`.
- ✅ RAG: `knowledge_chunks` vector(1024) + HNSW + FTS, hybrid `match_knowledge_chunks`
  scoped by workspace + bot; re-index triggers on structured data; checksums on files.
- ✅ Idempotency: messages unique `(channel_connection_id, external_message_id)`; payment
  webhook unique `(provider, event_id)`; usage `idempotency_key`.
- ✅ Credentials in Vault by reference; manual Meta request flow + fee status + event history;
  widget public key + `allowed_origins` + content-free Realtime ping (P6); Preact widget (P8);
  `/admin` inside the dashboard (P7).
- ✅ Orders/reservations with server-side prices (P15), `pending_confirmation`; handoffs.
- ✅ Audit log (append-only), data export/delete requests, retention per plan, private
  storage buckets with workspace-prefixed paths, API keys (hash only).
- ✅ Design system: dark-first, Royal Blue, IBM Plex Sans Arabic + Inter, ⌘K, RTL rules, AA.
- ✅ Product name only in `packages/shared/src/brand.ts`.

## 4. Suggested reconciliation order (next session, after approval)

1. Owner decides ⚠️1–⚠️11.
2. Update DECISIONS.md and ROADMAP.md (P1–P17), and rename docs if ⚠️11 is chosen.
3. Add one new migration for the P2-level gaps (feature_flags, notifications, billing_events,
   webhook inbox, analytics tables, enum additions, missing columns). The 12 migrations are
   unapplied, so they could also be edited in place; decide which before touching them.
4. Extend pgTAP to every table + role matrix; run it on the real Supabase local stack.
