# MASTER BUILD PROMPT — AI Customer-Service CRM SaaS (Full Build, All Phases)

> Reconciled with the Phase 01 work on 2026-11-26 (`docs/DECISIONS.md` §E). Notes marked
> _[Reconciled: Ex]_ show where existing tested work was kept and why.

## 0. ROLE & MISSION
You are a Principal Software Architect + Senior Full-Stack Engineer + Database Architect + AI Systems Engineer + Security Engineer.
Build a production-ready, multi-tenant AI customer-service CRM SaaS end-to-end: architecture, database, backend, frontend, AI engine, integrations, billing, tests, and deployment configuration.
Work through the phases in order, ONE PHASE PER SESSION. At the start of each phase, write a plan and wait for my approval before building. Never start the next phase without my explicit approval (CLAUDE.md wins over this prompt). Within an approved phase, work autonomously and stop ONLY for blockers that require me (credentials, paid accounts, external approvals, irreversible actions).

## 1. OPERATING RULES (MANDATORY)
- Approval gate (CLAUDE.md wins wherever it and this prompt differ): one phase per session. Start each phase by presenting a plan and waiting for my approval. At the end of the phase, update DEVELOPMENT_PROGRESS.md and the draft PR, then stop. Never start the next phase without my explicit approval.
- Work on a feature branch. Commit after every milestone with clear messages. Keep a draft PR open and update its description with progress.
- Before each phase: read CLAUDE.md and docs/DEVELOPMENT_PROGRESS.md. After each phase: update DEVELOPMENT_PROGRESS.md (done / in-progress / pending / blockers / known issues / latest verified working state).
- Never claim something works unless you ran it and it passed. Mark untested items "UNVERIFIED".
- Never invent third-party API behavior. Verify against official docs; if unsure, mark "needs verification" and isolate behind an adapter.
- Never commit secrets. Use .env (gitignored) and .env.example with placeholders. Secrets go to Supabase secrets / Cloudflare env only.
- Never fake an integration. If credentials are missing, build the real code path, add tests with mocks, gate it behind a feature flag, and show the real status ("not configured") in the UI.
- When blocked by a missing credential, keep building everything else; list the blocker in DEVELOPMENT_PROGRESS.md under "Needs owner action".
- Write tests alongside code. A phase is done only when its acceptance criteria pass.
- Keep docs synchronized with actual code.
- If context runs out, the next session must be able to resume from DEVELOPMENT_PROGRESS.md alone.

## 2. PRODUCT
Multi-tenant SaaS where businesses (restaurants first, but any category) create a workspace, add business info + knowledge, connect channels (WhatsApp, Facebook Messenger, Instagram, Website Widget), test their AI assistant, subscribe to a plan, and run automated AI customer service with a CRM dashboard (conversations, customers, orders, reservations, analytics).
Each workspace's data, bots, conversations, integrations, analytics and billing are fully isolated.
Target market: Gulf first, international later. UI: Arabic + English.

## 3. APPROVED TECH STACK (do not change without documenting why)
- Monorepo: pnpm workspaces (+ Turborepo optional).
- Frontend: React + Vite + TypeScript (strict) + Tailwind + shadcn/ui + TanStack Query + React Router + React Hook Form + Zod + Recharts. Premium, realistic, advanced UI.
- i18n: i18next, Arabic + English, full RTL/LTR, user-switchable, persisted per user. Logical CSS properties (ms/me, ps/pe). Arabic font: IBM Plex Sans Arabic or similar; English: Inter.
- Backend: Supabase (PostgreSQL 15+, Auth, RLS, Storage, Realtime, pgvector, Postgres `jobs` table queue, pg_cron) + Supabase Edge Functions (Deno, TypeScript). _[Reconciled: E1. A custom `jobs` table (FOR UPDATE SKIP LOCKED, exponential backoff, `dead` state, admin retry) replaces pgmq. It was already built and tested in P1.]_
- AI generation: Anthropic Claude via provider abstraction (fast model for classification, stronger model for replies; configurable per plan/bot). Use prompt caching.
- Embeddings: Voyage AI multilingual via embeddings abstraction (OpenAI embeddings as alternative adapter).
- Email: Resend.
- Payments: PayPal (Subscriptions + one-time Orders) + Manual payment path. Payment provider abstraction so Stripe can be added later.
- Hosting: Cloudflare Pages (dashboard), Cloudflare CDN/Pages for widget script. Supabase cloud (region EU Frankfurt).
- Automation: n8n for side workflows only (admin notifications, reports). NEVER in the core message path.
- Testing: Vitest, Testing Library, Playwright (E2E), pgTAP or SQL tests for RLS, Deno tests for edge functions.
- Lint/format: ESLint + Prettier. CI: GitHub Actions (lint, typecheck, test, build).

## 4. REPOSITORY STRUCTURE
ai-crm/
├─ apps/
│  ├─ dashboard/            # React app (customer dashboard + super admin area)
│  └─ widget/               # Embeddable website chat widget (vanilla TS/Preact, tiny bundle, Shadow DOM)
├─ packages/
│  ├─ shared/               # Types, Zod schemas, constants, API contracts, i18n keys
│  ├─ ai-engine/            # Orchestration, providers, RAG, classification, tools, prompts
│  └─ channel-adapters/     # WhatsApp, Messenger, Instagram, Widget adapters (normalize in/out)
├─ supabase/
│  ├─ migrations/           # Ordered SQL migrations (schema, RLS, functions, triggers, seed plans)
│  ├─ seed.sql
│  ├─ tests/                # RLS + tenant isolation tests
│  └─ functions/
│     ├─ api/               # REST API router (dashboard)
│     ├─ widget-gateway/    # Widget session + messages
│     ├─ webhook-meta/      # WhatsApp/Messenger/Instagram webhooks
│     ├─ webhook-paypal/    # PayPal webhooks
│     ├─ ai-worker/         # Queue consumer: AI pipeline
│     ├─ kb-ingest/         # Document parsing, chunking, embedding
│     ├─ scheduler/         # Cron jobs: usage alerts, trial expiry, retention, analytics rollups
│     └─ _shared/           # Auth, tenancy, errors, logging, rate limit, validation
├─ n8n/                     # Exported workflow JSONs (admin notifications, reports)
├─ docs/
│  ├─ PROJECT_CONTEXT.md
│  ├─ ARCHITECTURE.md
│  ├─ DATABASE.md           # Schema + Mermaid ERD
│  ├─ API.md
│  ├─ AI_ENGINE.md
│  ├─ INTEGRATIONS.md
│  ├─ BILLING.md
│  ├─ SECURITY.md
│  ├─ TESTING.md
│  ├─ DEPLOYMENT.md
│  ├─ RISKS.md
│  ├─ DESIGN_SYSTEM.md
│  └─ DEVELOPMENT_PROGRESS.md
├─ .github/workflows/ci.yml
├─ CLAUDE.md
└─ .env.example

## 5. TENANCY & ROLES
- Hierarchy: workspace (tenant) → branches (optional, Enterprise) → bots. Design so an organization layer can be added later.
- Workspace roles: owner, admin, agent, viewer.
  - owner: everything incl. billing, delete workspace, transfer ownership.
  - admin: everything except billing ownership and workspace deletion.
  - agent: conversations, customers, orders, reservations, handoff.
  - viewer: read-only.
- Super Admin: platform-level, stored in a separate platform_admins table, never mixed with workspace roles. Super admin actions go through service-role edge functions and are audit-logged.
- Invitations by email (Resend), token-based, expiring.

## 6. DATABASE (design fully, then implement as migrations)
Rules: UUID PKs, created_at/updated_at (trigger), soft delete where needed (deleted_at), every tenant-owned table has workspace_id NOT NULL + index, FK ON DELETE behavior documented, enums via Postgres enums or check constraints, JSONB only for truly flexible data.
Core tables (merge/split if justified, document why):
- profiles (user_id → auth.users, full_name, locale, avatar)
- platform_admins
- workspaces (name, slug unique, category, country, timezone, default_locale, status, plan_id, trial_ends_at)
- workspace_members (workspace_id, user_id, role, unique(workspace_id,user_id))
- workspace_invitations (email, role, token_hash, expires_at, accepted_at)
- business_profiles (description, contact, social links, custom_ai_instructions, tone)
- branches (name, address, geo, phone, timezone)
- working_hours (branch_id/workspace_id, weekday, open, close, is_closed) + holiday overrides
- catalog_categories, catalog_items (name as jsonb {"ar","en"} _[Reconciled: E9, CLAUDE.md localized-content rule]_, description, price, currency, availability, attributes JSONB, image path)
- faqs (question, answer, language, tags)
- policies (type: delivery/refund/reservation/other, content)
- kb_sources (type: profile/faq/catalog/policy/file/manual, status, last_synced_at)
- kb_documents (source_id, storage_path, mime, status: pending/processing/ready/failed, error, checksum)
- kb_chunks (document_id, content, language, token_count, embedding vector(n), metadata) + HNSW index
- bots (name, branch_id, status: draft/testing/ready/active/paused, language_mode, public_key unique, readiness_score)
- bot_configs (model routing, temperature, max_tokens, fallback_message, handoff_rules, greeting, persona, versioned)
- ai_model_profiles / ai_model_prices (platform-level model routing profiles per plan/bot + cost per token) _[Reconciled: E9. Tested in P1 and holds the A15 routing; replaces ai_providers / ai_model_configs.]_
- channels (bot_id, type: whatsapp/messenger/instagram/widget, status: not_connected/pending/connected/error/disabled, connection_mode: automatic (widget)/manual/oauth, external_ids JSONB)
- channel_credentials (channel_id, encrypted token via pgsodium/Vault, scopes, expires_at) — NEVER readable by client roles
- channel_connection_requests (channel_type, submitted data, status, admin notes, fee_paid)
- widget_settings (bot_id, allowed_domains[] _[Reconciled: E13. Exact `allowed_origins` (scheme + host + port) is used instead of `allowed_domains`, a stricter Origin check.]_, theme, position, launcher text ar/en, installed_verified_at)
- customers (workspace_id, display_name, phone, email, channel identities, tags, notes, first_seen, last_seen)
- customer_identities (customer_id, channel_type, external_user_id, unique(workspace_id, channel_type, external_user_id))
- conversations (bot_id, channel_id, customer_id, status: open/pending/closed, handler: ai/human, assigned_to, last_message_at, last_message_preview)
- messages (conversation_id, direction: inbound/outbound, sender: customer/ai/agent/system, content, content_type, external_message_id, delivery_status, ai_run_id) + unique(channel_id, external_message_id)
- ai_runs (message_id, model, prompt_tokens, completion_tokens, cached_tokens, latency_ms, cost_micros _[Reconciled: E9, integer money rule]_, retrieved_chunk_ids, status, error)
- question_classifications (message_id, category: menu_products/reservations/prices/working_hours/services/complaints/orders/other, confidence)
- orders (customer_id, conversation_id, branch_id, status, items in an order_items table _[Reconciled: E9, P15 server-side prices per line]_, subtotal, delivery_fee, total, currency, type: delivery/pickup/dine_in, address, notes, source)
- reservations (customer_id, branch_id, party_size, reserved_at, status, notes)
- webhook_events (provider, event_id, signature_valid, payload, status: received/processed/failed/ignored, attempts, unique(provider, event_id))
- analytics_events (append-only, partitioned by month) + analytics_daily rollup (workspace_id, date, messages_in, messages_out, conversations, orders, reservations, avg_response_ms, per-category counts)
- bot_tests, bot_test_cases, bot_test_results (question, expected facts, actual, pass/fail, score)
- plans (code, name, is_public, trial) + plan_prices (interval month/year, amount, currency) + entitlement_definitions / plan_entitlements / workspace_entitlement_overrides (limits and features by key) — DATA-DRIVEN _[Reconciled: E9. Tested in P1; replaces subscription_plans with limits/features JSONB. CLAUDE.md requires entitlements asked for by key.]_
- subscriptions (workspace_id, plan_id, provider: paypal/manual, provider_subscription_id, status: trialing/active/past_due/grace/canceled/expired/suspended (+ pending_activation for a PayPal approval or manual payment awaiting activation _[Reconciled: E13]_), period_start, period_end, cancel_at_period_end)
- usage_periods (workspace_id, period_start, period_end, ai_replies_included, ai_replies_used, overage_units)
- usage_events (append-only reserve/release ledger, workspace_id, usage_period_id, kind: ai_reply_reserved/ai_reply_released, quantity ±1, ai_run_id, idempotency_key unique, created_at) _[Reconciled: E9. Tested in P1 behind consume_ai_reply/release_ai_reply; replaces usage_records.]_
- billing_events (append-only audit of every billing state change)
- payment_transactions (provider, provider_txn_id unique, amount, currency, status, type: subscription/one_time/manual/refund, raw)
- invoices_records (manual invoices for overage, status)
- notifications (in-app, user_id/workspace_id, type, read_at)
- audit_logs (actor_id, actor_type: user/admin/system, workspace_id, action, target, diff JSONB, ip)
- feature_flags (key, scope: global/workspace, enabled)
Deliver Mermaid ERD in docs/DATABASE.md.

## 7. SECURITY
- RLS ON for every table. Policies via helper functions: is_workspace_member(ws), has_workspace_role(ws, roles[]), is_platform_admin().
- Client never touches credentials, webhook_events, usage_events writes, billing writes, ai_runs writes — service role only via edge functions.
- Tokens encrypted at rest (Supabase Vault/pgsodium).
- Webhook signature verification (Meta X-Hub-Signature-256 with app secret; PayPal verify-webhook-signature). Reject invalid.
- Idempotency: webhook_events unique(provider,event_id); messages unique external id; usage idempotency_key.
- Rate limiting on widget-gateway and api (per IP + per bot/workspace).
- Widget: only a public bot key in the browser; server validates Origin against allowed_domains; issues short-lived signed session token; no secrets client-side.
- Input validation with Zod on every endpoint. Output never leaks other tenants' data.
- File uploads: type/size limits, private buckets, per-workspace paths, signed URLs.
- Audit log for sensitive actions (role changes, billing changes, credential changes, admin actions).
- Never ask for or store customers' social-media passwords.
- Prompt-injection defenses: business instructions and KB content treated as data; system prompt guardrails; no tool can access other workspaces.

## 8. MESSAGE PIPELINE (async)
Inbound (any channel) → channel webhook/gateway → verify signature → store webhook_event (idempotent) → normalize via channel adapter to NormalizedInboundEvent {workspace_id, bot_id, channel_id, external_user_id, external_message_id, text, attachments, timestamp} → upsert customer + identity → upsert conversation → insert inbound message → enqueue job (Postgres `jobs` table) → return 200 fast.
ai-worker: dequeue → check subscription/usage limits → if conversation handler=human, skip AI (notify agents) → run AI engine → insert outbound message → send via channel adapter → record ai_run + usage_record (idempotent) → classification + intent → update conversation preview → emit analytics_event → Realtime pushes to dashboard.
Retries with exponential backoff, dead-letter state (`jobs.status = dead`) with admin retry, visible failure state in UI.
Synchronous: dashboard CRUD, auth, widget session creation. Asynchronous: AI replies, KB ingestion, embeddings, analytics rollups, emails, usage alerts.

## 9. AI ENGINE (packages/ai-engine, channel-agnostic)
- Input: normalized event + conversation history. Output: reply text + actions.
- Steps: load bot config + business context (cached) → language detection (reply in customer's language: Arabic MSA/Gulf/Egyptian or English) → classify question (fast model, structured output) → hybrid retrieval (pgvector similarity + keyword/full-text, filtered by workspace_id + bot) → build prompt (system guardrails, business instructions, working hours with timezone, retrieved facts, history window with summarization) → generate (Claude) → post-check → return.
- Tools (structured tool use): get_catalog, check_working_hours, create_order, create_reservation, request_human_handoff, get_policy (+ confirm_order and capture_contact_details _[Reconciled: E13]_). Tools are workspace-scoped and validated.
- Missing info: never invent prices, hours, or policies. Say it doesn't know and offer handoff. Log as "knowledge gap" for the dashboard.
- Human handoff: on request, complaint threshold, low confidence, or rule → handler=human, notify agents (in-app + email).
- Provider abstraction: interface LLMProvider {generate, stream?, countTokens}; EmbeddingsProvider {embed}. Model routing per plan/bot.
- Failure handling: timeouts, retries, fallback model, fallback message; never leave customer without response or silent failure.
- Observability: every run logged in ai_runs with tokens, cost, latency, retrieved chunks.
- Plan gating: Starter has no orders/reservations/handoff tools.

## 10. KNOWLEDGE BASE
- Sources v1: structured business profile, working hours, catalog/menu with prices, FAQs, policies, manual notes, file upload (PDF, DOCX, TXT). URL crawl = later (design for it).
- Structured data is converted to retrievable chunks AND available to tools directly (prices come from catalog tables, not embeddings).
- kb-ingest: parse → clean → chunk (semantic, ~500–800 tokens, overlap) → embed → store. Re-embed on update. Status visible in UI. Checksums to skip unchanged files.

## 11. CHANNELS & INTEGRATIONS
Common: each channel implements ChannelAdapter {verifyWebhook, parseInbound, send, healthCheck}. Messaging integrations contain NO AI business logic.

### 11.1 Website Widget (fully automatic, v1 live)
- Unique snippet per bot: <script src="https://cdn.<domain>/widget.js" data-bot="PUBLIC_KEY" async></script>
- Shadow DOM, < 50KB gzipped target, RTL/LTR, theme from widget_settings, mobile responsive, typing indicator, offline/fallback state.
- widget-gateway: POST /widget/session (validate public key + Origin in allowed_domains → signed short-lived token), POST /widget/messages, GET /widget/messages (or Realtime channel scoped by token).
- Installation verification: widget pings on load; dashboard shows "Installed on domain X at time Y".
- Test page inside dashboard.

### 11.2 WhatsApp Business (WhatsApp Cloud API)
- Two connection modes:
  a) MANUAL (active now): customer submits a connection request form (business name, phone number, Meta Business ID, WABA ID if any, contact) → status pending → admin notified (n8n + email) → admin enters phone_number_id, WABA ID, access token in Super Admin → backend runs health check → status connected.
  b) EMBEDDED SIGNUP v4 (built, behind feature flag `meta_embedded_signup`, OFF): FB JS SDK launch, capture code + WABA ID + phone number ID from message event, server-side code→business token exchange, subscribe app to WABA webhooks, register number. Verify every step against current Meta docs (v2 is deprecated).
- Webhook: GET verification (hub.mode/hub.verify_token/hub.challenge), POST with X-Hub-Signature-256 validation. Handle messages + statuses (sent/delivered/read/failed).
- Respect the 24-hour customer service window; outside it only approved templates (template support: schema + sending; template management later).
- Send text + interactive buttons/lists where supported.

### 11.3 Facebook Messenger
- Same two modes. Manual: admin enters Page ID + Page access token. OAuth (flagged OFF): Facebook Login for Business with required page messaging permissions (verify exact permission names and App Review requirements in docs).
- Webhook subscription to page messaging events, signature validation, standard messaging window rules.

### 11.4 Instagram Messaging
- Same two modes. Manual: admin enters IG account ID + token. OAuth flagged OFF. Verify current Instagram messaging API path and permissions in docs (do not assume they match Messenger).

### 11.5 Connect page UI
- Cards for all 4 channels with real status, mode, last health check, last message time, errors.
- Meta channels show "Request connection" form + $49 connection fee (PayPal or manual) + pending tracker. Never show "connected" unless health check passed.

## 12. CUSTOMER JOURNEY & DASHBOARD
### 12.1 Auth & onboarding
- Sign up/in: email+password, magic link, Google OAuth (configurable). Email verification. Password reset.
- Onboarding wizard (saveable, resumable, progress bar): business basics → category → locations/branches → working hours → contact → catalog/menu (manual + CSV import) → FAQs → policies → AI instructions & tone → file uploads → create first bot → widget setup.
### 12.2 Dashboard overview
- KPIs: total messages, conversations, orders, reservations, active conversations, avg AI response time, AI replies used vs plan.
- 10-day charts: daily messages, orders, conversations, unique customers.
- Question classification: percentage + volume per category (donut + table).
- Knowledge gaps list (questions AI couldn't answer).
- Live conversations widget.
### 12.3 Inbox (conversations)
- List with filters (channel, status, handler, assigned, date, search), real-time updates.
- Conversation view: messages thread, customer panel, AI/human toggle (take over / return to AI), agent reply box, internal notes, close/reopen, assign.
### 12.4 Customers (CRM): list, profile, identities across channels, tags, notes, order/reservation history.
### 12.5 Orders & Reservations: lists, filters, status workflow, details, manual create/edit, export CSV. Category-flexible (not restaurant-only).
### 12.6 Knowledge base: manage sources, catalog, FAQs, policies, files with ingestion status.
### 12.7 Bots: settings, persona, instructions, model tier, fallback, handoff rules, greeting, versions.
### 12.8 Connect (section 11.5).
### 12.9 AI Playground (section 13).
### 12.10 Billing: current plan, usage meter, upgrade/downgrade, PayPal checkout, manual payment request, billing history, transactions.
### 12.11 Settings: workspace profile, members & invites, roles, locale, timezone, notifications, data export, delete workspace.
### 12.12 Notifications center (in-app) + email.

## 13. AI PLAYGROUND & READINESS
- Sandbox chat (not billed, separately rate-limited, marked as test). Show retrieved sources, classification, latency, tokens per answer.
- Auto-generated test suite from KB (hours, prices, policies, FAQ) + custom test cases with expected facts.
- Weighted readiness score; bot cannot be "ready" below threshold. Checks: profile complete; working hours set; ≥1 KB source ready and 0 failed ingestions; catalog present if category requires; test pass rate ≥85%; no hallucinated price/hour (fact-check vs DB); fallback + handoff configured if plan allows; ≥1 channel connected with passing health check; simulated AI-provider failure sends fallback message. Generating a reply alone never counts as ready.

## 14. BILLING
- Plans are DB rows. Billable unit = AI-generated reply. Inbound messages and playground are free.
- Starter $39/mo: 1,000 replies, 1 bot, 1 user, Widget + 1 channel, basic analytics, no orders/reservations/handoff, hard stop at limit + upgrade prompt.
- Growth $99/mo: 5,000 replies, 2 bots, 3 users, all channels, advanced analytics + classification, orders/reservations, handoff, overage $10 per 1,000 (tracked automatically, invoiced manually in v1).
- Enterprise from $299/mo: custom limits, usage-based, multi-branch, API access, unlimited users, manual contracts.
- Trial 7 days, 100 replies, widget only. Annual = 10x monthly. Meta connection fee $49/channel (PayPal one-time or manual), refundable if connection fails. Alerts at 80% and 100%.
- States: trialing → active → past_due → grace (3 days) → suspended; canceled (until period end) → expired. On trial end/limit: AI stops, fallback message sent, dashboard read-only + upgrade prompt, data kept 30 days.
- PayPal: idempotent setup script for products/plans; Subscriptions API (recurring) + Orders API (one-time); webhook signature verification; idempotent processing; every state change → billing_events. Sandbox first. Verify event names in official docs.
- Manual path: "Pay another way" → request + admin notified → admin records payment → subscription activated → audited.
- VAT and PDF invoices deferred; keep full billing history.

## 15. SUPER ADMIN (/admin, platform admins only)
Workspaces (search, details, read-only impersonation audited, suspend/reactivate); subscriptions (manual activate/extend/change plan, record payments, overage invoices); connection requests queue (enter credentials, health check, mark connected/failed, refund flag); plans editor; platform metrics (MRR, active workspaces, AI cost vs revenue, error rates); feature flags; audit log; dead-letter jobs with retry.

## 16. NOTIFICATIONS & n8n
- Resend templates (ar/en): verify email, invite, password reset, usage 80/100%, trial ending, payment failed, connection request received/connected, handoff alert.
- n8n (export JSON to /n8n): new connection request → notify admin; daily platform summary; monthly workspace report. Triggered by DB webhook or edge function with shared secret.

## 17. API
REST via supabase/functions/api, documented in docs/API.md. Per endpoint: method, path, auth, role, Zod request/response schemas (packages/shared), errors, DB operations.
Modules: auth/session, workspaces, members/invitations, business profile, branches, hours, catalog, faqs, policies, kb, bots, bot-configs, channels/connect requests, widget settings, conversations, messages (agent send, handoff), customers, orders, reservations, analytics (overview, daily, classifications, knowledge gaps), playground/tests, plans, subscriptions, checkout, usage, billing history, notifications, admin/*.
Public: /widget/*, /webhooks/meta, /webhooks/paypal. Error envelope {error:{code,message,details}}, cursor pagination. Simple reads may use supabase-js under RLS; business-rule writes go through the API.

## 18. ANALYTICS
analytics_events append-only (monthly partitions) → rollups into analytics_daily every 15 min + nightly reconciliation. Dashboard reads rollups only. Response time = inbound→outbound. Retention 12 months default (per plan), nightly cleanup, per-workspace export and delete.

## 19. DESIGN SYSTEM
Dark-first premium minimal, Apple HIG principles + Stripe/Linear dashboards. Royal Blue primary + electric blue accents, light mode supported. Tokens: colors, ar/en type scale, 4px spacing, radii, elevation, blur materials, motion. Skeletons, empty and error states, toasts, ⌘K palette, sticky-header tables, accessible charts. Collapsible sidebar + top bar (workspace switcher, search, language, notifications, user). Responsive. WCAG 2.1 AA, keyboard nav, reduced motion. Product name in ONE config file.

## 20. TESTING
Unit (ai-engine, adapters, billing, metering, validators); RLS per table + role matrix; API (happy, auth fail, validation fail, cross-tenant); webhooks (signature, duplicates, out-of-order); AI eval golden set ar/en (prices/hours from DB, no invention, handoff, language match, dialects); billing (limits, hard stop, overage, trial, PayPal state machine, duplicates, manual activation); Playwright E2E full journey; performance (webhook ack <500ms p95, widget first reply <6s p95, overview <1.5s); failure recovery. Gates: zero cross-tenant leaks, zero duplicate usage records, zero duplicate processed webhooks.

## 21. DEPLOYMENT & ENV
Local, staging (Supabase dev), production. Cloudflare Pages auto-deploy from GitHub; widget on CDN with versioning. Edge functions via Supabase CLI in CI (staging on main, prod on tag). Reviewed, non-destructive migrations. .env.example placeholders: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, VOYAGE_API_KEY, RESEND_API_KEY, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_ENV, META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN, META_CONFIG_ID, WIDGET_SIGNING_SECRET, N8N_WEBHOOK_URL, N8N_SHARED_SECRET, APP_URL, WIDGET_CDN_URL. Structured JSON logs, health endpoint, AI cost view in admin.

## 22. BUILD PHASES
P1 Foundation · P2 Database & security · P3 Auth, workspaces, app shell, i18n, tokens · P4 Onboarding & business data · P5 Knowledge base · P6 AI engine (+ Arabic dialect eval) · P7 Message pipeline · P8 Website widget (first live channel) · P9 Inbox & CRM · P10 Dashboard & analytics · P11 Playground & readiness · P12 Billing · P13 Meta channels (manual + flagged OAuth/Embedded Signup v4) · P14 Super Admin · P15 Notifications, emails, n8n · P16 Hardening (E2E, perf, security, a11y) · P17 Deployment configs + runbook.
Each phase ends with passing acceptance criteria, commit, push, progress update.

## 23. CLAUDE.md RULES
Read DEVELOPMENT_PROGRESS.md and relevant docs first; follow architecture + design system; never invent API behavior; never claim untested work works; update progress; keep docs in sync; never commit secrets; preserve tenant isolation.

## 24. EXTERNAL DEPENDENCIES
Owner credentials (Supabase, Anthropic, Voyage, Resend + domain, PayPal sandbox/live, Cloudflare, DNS, GitHub secrets). External approvals (Meta Business verification — owner has no commercial registration, so manual mode is the workaround; Meta App Review; WhatsApp templates; PayPal review). Paid services. Everything else testable locally with mocks.

## 25. DEFINITION OF DONE
All phases complete or blocked with reason; CI green incl. RLS suite; widget E2E in staging with real AI; billing E2E in PayPal sandbox + manual; Meta manual mode works with credentials, OAuth behind flags; docs match code; final PR report: verified / unverified / blocked / owner next steps / env vars.

ADDENDUM (approved decisions):
- Model routing: default Haiku 5.5 for all plans (replies + classification). Auto-escalate to Sonnet 5.5 only for complaints, low-confidence, or complex multi-step questions; log escalation rate. Opus 5.5 = Enterprise only by contract. Model per plan is a DB row.
- Arabic dialect eval set (Gulf + Egyptian + MSA) required in P6.
- Widget: Preact (~35kB). Super Admin at /admin inside dashboard. Quotas reset monthly even on annual plans. Trial: 1 bot, 1 user, widget only. Meta caps: Starter 1, Growth 3, Enterprise unlimited.
- Product name placeholder "AI CRM" in packages/shared/src/brand.ts.
- APPROVAL RULE: CLAUDE.md wins. Stop after EACH phase for my approval. Update §0/§1 of MASTER_PROMPT.md to say this.
