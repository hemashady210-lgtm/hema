# MASTER BUILD PROMPT — AI Customer-Service CRM SaaS (Full Build, All Phases)

## 0. ROLE & MISSION
You are a Principal Software Architect + Senior Full-Stack Engineer + Database Architect + AI Systems Engineer + Security Engineer.
Build a production-ready, multi-tenant AI customer-service CRM SaaS end-to-end: architecture, database, backend, frontend, AI engine, integrations, billing, tests, and deployment configuration.
Work autonomously through all phases in order. Do not ask for approval between phases. Stop ONLY for blockers that require me (credentials, paid accounts, external approvals, irreversible actions).

## 1. OPERATING RULES (MANDATORY)
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
- Backend: Supabase (PostgreSQL 15+, Auth, RLS, Storage, Realtime, pgvector, Supabase Queues/pgmq, pg_cron) + Supabase Edge Functions (Deno, TypeScript).
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
- catalog_categories, catalog_items (name_ar, name_en, description, price, currency, availability, attributes JSONB, image path)
- faqs (question, answer, language, tags)
- policies (type: delivery/refund/reservation/other, content)
- kb_sources (type: profile/faq/catalog/policy/file/manual, status, last_synced_at)
- kb_documents (source_id, storage_path, mime, status: pending/processing/ready/failed, error, checksum)
- kb_chunks (document_id, content, language, token_count, embedding vector(n), metadata) + HNSW index
- bots (name, branch_id, status: draft/testing/ready/active/paused, language_mode, public_key unique, readiness_score)
- bot_configs (model routing, temperature, max_tokens, fallback_message, handoff_rules, greeting, persona, versioned)
- ai_providers / ai_model_configs (platform-level catalog of providers/models + cost per token)
- channels (bot_id, type: whatsapp/messenger/instagram/widget, status: not_connected/pending/connected/error/disabled, connection_mode: manual/oauth, external_ids JSONB)
- channel_credentials (channel_id, encrypted token via pgsodium/Vault, scopes, expires_at) — NEVER readable by client roles
- channel_connection_requests (channel_type, submitted data, status, admin notes, fee_paid)
- widget_settings (bot_id, allowed_domains[], theme, position, launcher text ar/en, installed_verified_at)
- customers (workspace_id, display_name, phone, email, channel identities, tags, notes, first_seen, last_seen)
- customer_identities (customer_id, channel_type, external_user_id, unique(workspace_id, channel_type, external_user_id))
- conversations (bot_id, channel_id, customer_id, status: open/pending/closed, handler: ai/human, assigned_to, last_message_at, last_message_preview)
- messages (conversation_id, direction: inbound/outbound, sender: customer/ai/agent/system, content, content_type, external_message_id, delivery_status, ai_run_id) + unique(channel_id, external_message_id)
- ai_runs (message_id, model, prompt_tokens, completion_tokens, cached_tokens, latency_ms, cost_usd, retrieved_chunk_ids, status, error)
- question_classifications (message_id, category: menu_products/reservations/prices/working_hours/services/complaints/orders/other, confidence)
- orders (customer_id, conversation_id, branch_id, status, items JSONB, subtotal, delivery_fee, total, currency, type: delivery/pickup/dine_in, address, notes, source)
- reservations (customer_id, branch_id, party_size, reserved_at, status, notes)
- webhook_events (provider, event_id, signature_valid, payload, status: received/processed/failed/ignored, attempts, unique(provider, event_id))
- analytics_events (append-only, partitioned by month) + analytics_daily rollup (workspace_id, date, messages_in, messages_out, conversations, orders, reservations, avg_response_ms, per-category counts)
- bot_tests, bot_test_cases, bot_test_results (question, expected facts, actual, pass/fail, score)
- subscription_plans (code, name, price_monthly, price_yearly, limits JSONB, features JSONB, is_public) — DATA-DRIVEN
- subscriptions (workspace_id, plan_id, provider: paypal/manual, provider_subscription_id, status: trialing/active/past_due/grace/canceled/expired/suspended, period_start, period_end, cancel_at_period_end)
- usage_periods (workspace_id, period_start, period_end, ai_replies_included, ai_replies_used, overage_units)
- usage_records (append-only, workspace_id, type: ai_reply, quantity, ai_run_id, idempotency_key unique, occurred_at)
- billing_events (append-only audit of every billing state change)
- payment_transactions (provider, provider_txn_id unique, amount, currency, status, type: subscription/one_time/manual/refund, raw)
- invoices_records (manual invoices for overage, status)
- notifications (in-app, user_id/workspace_id, type, read_at)
- audit_logs (actor_id, actor_type: user/admin/system, workspace_id, action, target, diff JSONB, ip)
- feature_flags (key, scope: global/workspace, enabled)
Deliver Mermaid ERD in docs/DATABASE.md.

## 7. SECURITY
- RLS ON for every table. Policies via helper functions: is_workspace_member(ws), has_workspace_role(ws, roles[]), is_platform_admin().
- Client never touches credentials, webhook_events, usage_records writes, billing writes, ai_runs writes — service role only via edge functions.
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
Inbound (any channel) → channel webhook/gateway → verify signature → store webhook_event (idempotent) → normalize via channel adapter to NormalizedInboundEvent {workspace_id, bot_id, channel_id, external_user_id, external_message_id, text, attachments, timestamp} → upsert customer + identity → upsert conversation → insert inbound message → enqueue job (pgmq) → return 200 fast.
ai-worker: dequeue → check subscription/usage limits → if conversation handler=human, skip AI (notify agents) → run AI engine → insert outbound message → send via channel adapter → record ai_run + usage_record (idempotent) → classification + intent → update conversation preview → emit analytics_event → Realtime pushes to dashboard.
Retries with exponential backoff, dead-letter queue, visible failure state in UI.
Synchronous: dashboard CRUD, auth, widget session creation. Asynchronous: AI replies, KB ingestion, embeddings, analytics rollups, emails, usage alerts.

## 9. AI ENGINE (packages/ai-engine, channel-agnostic)
- Input: normalized event + conversation history. Output: reply text + actions.
- Steps: load bot config + business context (cached) → language detection (reply in customer's language: Arabic MSA/Gulf/Egyptian or English) → classify question (fast model, structured output) → hybrid retrieval (pgvector similarity + keyword/full-text, filtered by workspace_id + bot) → build prompt (system guardrails, business instructions, working hours with timezone, retrieved facts, history window with summarization) → generate (Claude) → post-check → return.
- Tools (structured tool use): get_catalog, check_working_hours, create_order, create_reservation, request_human_handoff, get_policy. Tools are workspace-scoped and validated.
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
### 12.10 Billing: current plan, usage meter, upgrade/downgrade, PayPal checkout, manual paym

ADDENDUM (approved decisions, append to the end of MASTER_PROMPT.md):
- Model routing: default Haiku 5.5 for all plans (replies + classification). Auto-escalate to Sonnet 5.5 only for complaints, low-confidence, or complex multi-step questions; log escalation rate. Opus 5.5 = Enterprise only by contract. Model per plan is a DB row.
- Arabic dialect eval set (Gulf + Egyptian + MSA) required in P6.
- Widget uses Preact (~35kB target). Super Admin lives at /admin inside dashboard. Reply quotas reset monthly even on annual plans. Trial: 1 bot, 1 user, widget only. Meta channel caps: Starter 1, Growth 3, Enterprise unlimited.
- Product name placeholder "AI CRM" in packages/shared/src/brand.ts.
