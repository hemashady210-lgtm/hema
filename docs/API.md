# API Specification (v1)

> Contract (designed in P1, synced with DECISIONS §E in P2). The workspace / member / invitation
> routes of `api` are **built and tested in P3**; every other route is built in the phase of its
> function (E7, `ROADMAP.md`). The database objects it
> relies on exist on the dev project since P2. Third-party payloads (Meta, PayPal) are
> described at the level we depend on and are marked **needs verification** wherever the exact
> vendor format, header or event name has to be confirmed against current docs before
> implementation.

## 1. Surfaces

| Surface                 | Base URL (Supabase Functions)                                | Auth                                                         | Consumers          |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------ |
| Dashboard reads         | PostgREST via supabase-js                                    | Supabase JWT + RLS                                           | dashboard          |
| App API                 | `/functions/v1/api/v1/*`                                     | `Authorization: Bearer <Supabase JWT>`                       | dashboard          |
| Public API (Enterprise) | `/functions/v1/api/v1/*` (same routes, subset)               | `Authorization: Bearer sk_live_…` (API key, scopes)          | customer systems   |
| Admin API               | `/functions/v1/api/admin/v1/*` (routes of `api`, E7)         | Supabase JWT + `platform_admins` row                         | dashboard `/admin` |
| Widget API              | `/functions/v1/widget-gateway/widget/v1/*`                   | bot `public_key` + exact Origin + signed session token       | widget.js          |
| Webhooks                | `/functions/v1/webhook-meta`, `/functions/v1/webhook-paypal` | vendor signatures                                            | Meta, PayPal       |
| Internal                | `/functions/v1/ai-worker`, `kb-ingest`, `scheduler`          | internal secret header; scheduler called by pg_cron + pg_net | internal only      |

A custom domain (`api.<product>.com` via Cloudflare) can front these later.

## 2. Conventions

- JSON only, UTF-8. Timestamps ISO 8601 UTC. Money `{ "amount_cents": 3900, "currency": "USD" }`.
- Workspace scoping: app routes are under `/v1/workspaces/{workspace_id}/…`; the function
  verifies membership/role before acting (RLS still applies to its user-scoped client).
  API-key routes infer the workspace from the key.
- `Accept-Language: ar|en` selects the language of error `message`s.
- **Idempotency:** every mutating `POST` accepts `Idempotency-Key` (≤ 128 chars); replays within
  24 h return the original response.
- **Pagination:** cursor-based — `?limit=50&cursor=<opaque>` → `{ "data": [...], "next_cursor": "…" | null }`.
- **Rate limits** (initial values, tuned later): app 120 req/min/user; public API 600 req/min/key;
  widget 30 msg/min/visitor and 600 msg/min/widget key. A refused request gets `429` with
  `Retry-After`. (P3: `RateLimit-*` headers on successful responses are not sent yet.) P3
  invitation caps: 30/h per user, 50/day per workspace, 5/day per recipient, 5 renewals/day per
  link; preview 30/10 min per IP and 3,000/10 min overall.

### Error envelope

```json
{
  "error": {
    "code": "plan_limit_reached",
    "message": "You've reached the bot limit for the Starter plan.",
    "details": { "entitlement": "max_bots", "limit": 1, "upgrade_url": "/billing/plans" },
    "request_id": "req_01J…"
  }
}
```

| HTTP | `code`                                                           | When                                                          |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| 400  | `validation_failed`                                              | body/query fails schema (`details.issues[]`)                  |
| 401  | `unauthenticated`                                                | missing/invalid token or key                                  |
| 402  | `plan_limit_reached` · `feature_not_in_plan` · `quota_exhausted` | DB raised `plan_limit:` / `plan_feature:`; AI quota hard stop |
| 403  | `forbidden` · `workspace_read_only`                              | role insufficient; trial ended/suspended                      |
| 404  | `not_found`                                                      | also used for other tenants' ids (no existence leak)          |
| 409  | `conflict` · `idempotency_conflict`                              | state transition invalid; same key, different body            |
| 422  | `unprocessable`                                                  | semantically invalid (e.g. reservation in the past)           |
| 429  | `rate_limited`                                                   |                                                               |
| 5xx  | `internal` · `upstream_unavailable`                              |                                                               |

## 3. App API (dashboard)

### Workspaces & members

**Built in P3** (`supabase/functions/api`, service-role RPCs from migration `…000300`, zod schemas
in `packages/shared/src/api.ts`). Every route verifies the caller with Supabase Auth (`getUser`)
because the function runs with `verify_jwt = false` (the preview route is public); new-style API
keys are never accepted as user tokens. Rate limits are per user (per IP for the preview) and
return `429` + `Retry-After`. `Idempotency-Key` is **not implemented yet**; the RPCs are
naturally idempotent where it matters (accept replays, re-invite reissues).

| Method | Path                                         | Role               | Description                                                                                                                                                                                                                                                            |
| ------ | -------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                                    | public             | `{ok, service, product}` (product from `packages/shared`: R-14 probe)                                                                                                                                                                                                  |
| GET    | `/v1/config`                                 | signed-in          | `{email_delivery: configured \| not_configured}` (real Resend configuration)                                                                                                                                                                                           |
| GET    | `/v1/workspaces/slug-availability?slug=`     | signed-in          | `{slug, available}` (format, reserved list, taken)                                                                                                                                                                                                                     |
| POST   | `/v1/workspaces`                             | verified user      | `{name, slug, category, country_code, timezone, default_locale}` → workspace + owner + 7-day trial (+ `billing_events`) + onboarding row + audit, atomic. One trial workspace per user (`platform_settings.max_trial_workspaces_per_user`) → `402 trial_limit_reached` |
| PATCH  | (direct, supabase-js)                        | owner/admin        | name, category, country, timezone, default locale: through RLS + column grants (no route needed)                                                                                                                                                                       |
| POST   | `/v1/workspaces/{ws}/invitations`            | owner/admin        | `{email, role: admin\|agent\|viewer, locale}`; active members + open invitations count against `max_users` (`402 plan_limit_reached`); re-inviting an address reissues; returns `{invitation, invite_url, email_status}`                                               |
| POST   | `/v1/workspaces/{ws}/invitations/{id}/renew` | owner/admin        | new link (old token stops working), new expiry, email again                                                                                                                                                                                                            |
| DELETE | `/v1/workspaces/{ws}/invitations/{id}`       | owner/admin        | revoke                                                                                                                                                                                                                                                                 |
| POST   | `/v1/invitations/preview`                    | public             | `{token}` (POST keeps tokens out of URLs/logs) → workspace, role, inviter, expiry, state; email masked unless the signed-in caller owns it                                                                                                                             |
| POST   | `/v1/invitations/accept`                     | invitee            | `{token}`; signed-in, verified email equal to the invited address; idempotent for the same user                                                                                                                                                                        |
| PATCH  | `/v1/workspaces/{ws}/members/{user_id}`      | owner/admin        | `{role: admin\|agent\|viewer}`; never the owner, never yourself; demotion to viewer releases conversation assignments                                                                                                                                                  |
| DELETE | `/v1/workspaces/{ws}/members/{user_id}`      | owner/admin · self | remove (never the owner) or leave (anyone but the owner); allowed on read-only workspaces                                                                                                                                                                              |
| POST   | `/v1/workspaces/{ws}/ownership`              | owner              | `{user_id}`; the old owner becomes admin                                                                                                                                                                                                                               |

Invitation email: sent through Resend only when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set;
otherwise `email_status = not_configured` is stored and the dashboard shows the link to copy.
DB error codes `app:<code>` map to the envelope codes in `API_ERRORS`. The default bot + widget
channel are **not** created with the workspace (P3 decision 1): the P4 onboarding wizard's
"first bot" step creates them.

### Bots, knowledge, catalog

Simple CRUD on bots, business profile, working hours (+ overrides), policies, FAQs, catalog,
manual KB notes, bot config versions, custom test cases and onboarding progress goes **directly
through supabase-js** (RLS + column grants + limit triggers). Function routes exist only where
there are side effects:

| Method | Path                                                     | Role        | Description                                                                                                                                                                                                                                                |
| ------ | -------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/workspaces/{ws}/knowledge/files`                    | owner/admin | `{file_name, mime_type, size_bytes, bot_id?}` → validates entitlements (`knowledge_files_max`, `knowledge_file_max_mb`, MIME) → creates `kb_sources(type=file)` + `kb_documents(status=pending)` → returns `{document_id, upload_url}` (signed upload URL) |
| POST   | `/v1/workspaces/{ws}/knowledge/documents/{id}/complete`  | owner/admin | confirms upload, verifies checksum/size, enqueues `ingest_knowledge_source`                                                                                                                                                                                |
| POST   | `/v1/workspaces/{ws}/knowledge/documents/{id}/reprocess` | owner/admin | re-ingest (skipped when the checksum is unchanged)                                                                                                                                                                                                         |
| POST   | `/v1/workspaces/{ws}/bots/{bot}/playground`              | owner/admin | sandbox reply (P11): same pipeline on an `is_test` conversation, **never billed** (DB-enforced), separately rate-limited, never delivered to a channel; returns sources, classification, latency, tokens                                                   |
| POST   | `/v1/workspaces/{ws}/bots/{bot}/tests`                   | owner/admin | run the readiness suite (`bot_tests` + `bot_test_results`, P11)                                                                                                                                                                                            |

### Channels (Connect section)

| Method | Path                                               | Role        | Description                                                                                                                                                                                                                                                                                                                                              |
| ------ | -------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/workspaces/{ws}/channels`                     | member      | Connect-page view model: per channel type → channel row (status, mode, last health check), open request, plan allowance, fee status                                                                                                                                                                                                                      |
| POST   | `/v1/workspaces/{ws}/channel-requests`             | owner/admin | `{channel_type: whatsapp\|messenger\|instagram, bot_id, contact_name, contact_email, contact_phone?, business_name, submitted_data{…}, customer_notes?, payment_method: paypal\|manual}` → status `pending`; emits `channel_request.created` (Resend + n8n); returns `{request, payment: {type:'paypal', approve_url} \| {type:'manual', instructions}}` |
| POST   | `/v1/workspaces/{ws}/channel-requests/{id}/cancel` | owner/admin | only while `pending`; refund flow if fee paid                                                                                                                                                                                                                                                                                                            |
| PATCH  | `/v1/workspaces/{ws}/widget`                       | owner/admin | `{allowed_origins[]}` (exact origins, validated)                                                                                                                                                                                                                                                                                                         |
| DELETE | `/v1/workspaces/{ws}/bots/{bot}`                   | owner/admin | delete a bot (clients cannot delete bots directly: cascades remove channels, credentials and history; confirm + audit)                                                                                                                                                                                                                                   |
| GET    | `/v1/workspaces/{ws}/files/download-url?path=…`    | member      | short-lived signed URL (service role) for a private object in the workspace (knowledge files, attachments; exports: owner) — clients have no direct read policy on private buckets                                                                                                                                                                       |
| POST   | `/v1/workspaces/{ws}/bots/{bot}/rotate-key`        | owner/admin | new `bots.public_key`, old key stops working                                                                                                                                                                                                                                                                                                             |
| POST   | `/v1/workspaces/{ws}/channels/{id}/disconnect`     | owner       | customer-initiated disconnect (status → `not_connected`, credential row + Vault secret deleted, event row)                                                                                                                                                                                                                                               |

### Inbox

| Method | Path                                                        | Role   | Description                                                                                                                                                                  |
| ------ | ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/workspaces/{ws}/conversations/{id}/messages`           | agent+ | Human reply `{content, attachments?[], client_message_id}` → insert + deliver; **not billed**. WhatsApp outside 24 h window → `409 outside_service_window` (templates later) |
| POST   | `/v1/workspaces/{ws}/conversations/{id}/handoff`            | agent+ | `handler ai ⇄ human` + `handoffs` row; `{action: take\|release\|resolve}`; requires `human_handoff` (also enforced by the database)                                          |
| POST   | `/v1/workspaces/{ws}/conversations/{id}/close`              | agent+ | close conversation                                                                                                                                                           |
| POST   | `/v1/workspaces/{ws}/orders/{id}/confirm` · `/cancel`       | agent+ | status transitions with customer notification                                                                                                                                |
| POST   | `/v1/workspaces/{ws}/reservations/{id}/confirm` · `/cancel` | agent+ | same                                                                                                                                                                         |

### Billing

| Method | Path                                         | Role        | Description                                                                                                            |
| ------ | -------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/workspaces/{ws}/billing`                | owner/admin | plan, status, period, usage (used/included/overage), entitlements, upcoming changes                                    |
| POST   | `/v1/workspaces/{ws}/billing/checkout`       | owner       | `{plan_code, interval: month\|year}` → PayPal subscription (pending row beside the live plan) → `{approve_url}`        |
| POST   | `/v1/workspaces/{ws}/billing/change-plan`    | owner       | upgrade/downgrade; upgrade immediate, downgrade at period end (BILLING.md §6)                                          |
| POST   | `/v1/workspaces/{ws}/billing/cancel`         | owner       | cancel at period end                                                                                                   |
| POST   | `/v1/workspaces/{ws}/billing/manual-request` | owner       | manual payment request `{plan_code?, interval?, product_code?, contact_*, preferred_method, message}` → admin notified |
| GET    | `/v1/workspaces/{ws}/billing/transactions`   | owner/admin | billing history (`payment_transactions`, `billing_events`, `invoices_records`)                                         |

### Data rights

| Method | Path                                | Role        | Description                                                  |
| ------ | ----------------------------------- | ----------- | ------------------------------------------------------------ |
| POST   | `/v1/workspaces/{ws}/exports`       | owner       | start export → `data_requests`                               |
| GET    | `/v1/workspaces/{ws}/exports/{id}`  | owner       | status + signed URL when ready                               |
| POST   | `/v1/workspaces/{ws}/deletion`      | owner       | schedule deletion (grace period); `DELETE` same path cancels |
| POST   | `/v1/workspaces/{ws}/api-keys`      | owner/admin | Enterprise (`api_access`): returns full key **once**         |
| DELETE | `/v1/workspaces/{ws}/api-keys/{id}` | owner/admin | revoke                                                       |

## 4. Public API (Enterprise, API keys)

Scopes: `conversations:read`, `messages:write`, `customers:read`, `customers:write`,
`orders:read`, `orders:write`, `reservations:read`, `knowledge:write`.

| Method    | Path                                                                               | Scope                                             |
| --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| GET       | `/v1/conversations` · `/v1/conversations/{id}` · `/v1/conversations/{id}/messages` | conversations:read                                |
| POST      | `/v1/conversations/{id}/messages`                                                  | messages:write (human/system message, not billed) |
| GET/PATCH | `/v1/customers[/{id}]`                                                             | customers:*                                       |
| GET/PATCH | `/v1/orders[/{id}]`                                                                | orders:*                                          |
| GET       | `/v1/reservations[/{id}]`                                                          | reservations:read                                 |
| POST      | `/v1/knowledge/faqs` (bulk upsert)                                                 | knowledge:write                                   |

Outbound webhooks to customer systems (order created, etc.) are a later phase.

## 5. Widget API

`POST /widget/v1/sessions` takes the bot's `public_key`; the browser `Origin` must exactly match
an entry in `widget_settings.allowed_origins` (empty list = widget disabled, E13). It returns a
short-lived token signed with `WIDGET_SIGNING_SECRET` that every later request carries. CORS
echoes the allowed origin only.

| Method | Path                                                    | Description                                                                                                                                                   |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/widget/v1/bootstrap`                                  | Theme, greeting, launcher label, position, pre-chat fields, languages, branding flag, `status: online                                                         | offline` (real: offline if workspace not active or widget disabled) |
| POST   | `/widget/v1/sessions`                                   | `{public_key, visitor_id?, locale?}` → `{session_token, expires_at, visitor_id}` (signed, short-lived; `visitor_id` = `customer_identities.external_user_id`) |
| POST   | `/widget/v1/install-ping`                               | records `widget_settings.installed_verified_at` + `installed_origin` from the real page (P8)                                                                  |
| POST   | `/widget/v1/conversations`                              | start or resume (one open conversation per visitor) `{prechat?{name,phone,email}}` → `{conversation_id, realtime_topic}`                                      |
| POST   | `/widget/v1/conversations/{id}/messages`                | `{client_message_id, text ≤ 2000}` → `202 {message_id}`; enqueues AI reply                                                                                    |
| GET    | `/widget/v1/conversations/{id}/messages?after={cursor}` | messages for this visitor's conversation only                                                                                                                 |

Realtime: the widget subscribes to Broadcast topic `widget:{realtime_topic}` and only receives
`{"type":"new_message"}` / `{"type":"typing"}` pings — never content (proposal P6). Polling fallback every
4 s → 15 s with backoff when Realtime is unavailable. Exact Realtime authorization model for
public broadcast channels — **needs verification**.

## 6. Admin API (Super Admin)

All routes below are `api` function routes under `/admin/v1/*` (E7), guarded by a
`platform_admins` row.

| Method  | Path                                               | Description                                                                                                                                                                                                                                                                                                                                                                                       |
| ------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/admin/v1/workspaces?query=&status=&plan=`        | search/list with plan, usage, channels                                                                                                                                                                                                                                                                                                                                                            |
| GET     | `/admin/v1/workspaces/{ws}`                        | full detail incl. internal notes                                                                                                                                                                                                                                                                                                                                                                  |
| POST    | `/admin/v1/workspaces/{ws}/status`                 | `{status: active                                                                                                                                                                                                                                                                                                                                                                                  | read_only | suspended, reason}`              |
| POST    | `/admin/v1/workspaces/{ws}/subscriptions/activate` | manual activation `{plan_code, interval?, period_start, period_end, custom_amount_cents?, currency?, transaction{amount_cents, currency, provider_ref?, note}}`                                                                                                                                                                                                                                   |
| POST    | `/admin/v1/workspaces/{ws}/entitlement-overrides`  | `{key, value, reason, expires_at?}` (Enterprise custom limits)                                                                                                                                                                                                                                                                                                                                    |
| GET     | `/admin/v1/channel-requests?status=pending`        | queue                                                                                                                                                                                                                                                                                                                                                                                             |
| POST    | `/admin/v1/channel-requests/{id}/status`           | `{status: in_progress                                                                                                                                                                                                                                                                                                                                                                             | rejected  | canceled, note, internal_note?}` |
| POST    | `/admin/v1/channel-requests/{id}/connect`          | `{external_account_id, external_ids{}, phone_number_display?, display_name, access_token, scopes?[], expires_at?, config{}}` → token to **Vault** + `channel_credentials` row; `channels` row becomes `connected` only after a passing health check (e.g. fetch phone number / page via Graph API — **needs verification** of endpoint). The database rejects `connected` without it (A14, §11.5) |
| POST    | `/admin/v1/channels/{id}/health-check`             | run the adapter `healthCheck()`; store result on the channel                                                                                                                                                                                                                                                                                                                                      |
| POST    | `/admin/v1/channels/{id}/status`                   | `{status: error                                                                                                                                                                                                                                                                                                                                                                                   | disabled  | not_connected, note}`            |
| POST    | `/admin/v1/transactions/{id}/refund`               | PayPal refund or manual refund record                                                                                                                                                                                                                                                                                                                                                             |
| POST    | `/admin/v1/usage-periods/{id}/overage-invoice`     | create / issue a manual overage invoice (`invoices_records`, C5)                                                                                                                                                                                                                                                                                                                                  |
| GET     | `/admin/v1/jobs?status=dead`                       | dead-letter viewer (P14)                                                                                                                                                                                                                                                                                                                                                                          |
| POST    | `/admin/v1/jobs/{id}/retry`                        | `retry_job(id, admin_user_id, reason)` (E1) — re-queues a dead job; audited                                                                                                                                                                                                                                                                                                                       |
| PUT     | `/admin/v1/feature-flags/{key}`                    | `{scope: global or workspace, workspace_id?, enabled}` (e.g. `meta_embedded_signup`, E2)                                                                                                                                                                                                                                                                                                          |
| GET/PUT | `/admin/v1/plans…`, `/admin/v1/settings/{key}`     | edit plans, prices, entitlements, platform settings                                                                                                                                                                                                                                                                                                                                               |

Every admin mutation writes `audit_logs` (`actor_type = platform_admin`).

## 7. Webhooks (inbound)

### 7.1 Meta — `webhook-meta` (**needs verification** for every vendor detail below)

- `GET` verification handshake: echo `hub.challenge` when `hub.verify_token` matches
  `META_VERIFY_TOKEN`.
- `POST`: verify `X-Hub-Signature-256` = `sha256=` HMAC of the raw body with `META_APP_SECRET`
  **before** parsing; store the raw event in `webhook_events` (unique `(provider, event_id)`;
  the event id for Meta is the provider id where one exists, else a hash of the raw body —
  **needs verification**); respond `200` quickly; process asynchronously.
- Routing: WhatsApp events identify the channel by phone-number id in the change metadata;
  Messenger/Instagram by page / IG account id in the entry (`channels.external_account_id`).
  Unknown ids are logged and the event marked `ignored`.
- Normalized into `NormalizedInboundEvent { kind: message|status|reaction|unsupported, workspace_id, bot_id, channel_id, external_user_id, external_message_id, text, attachments, timestamp }` (§8).
- Status callbacks (sent/delivered/read/failed) update `messages.delivery_status`.

### 7.2 PayPal — `webhook-paypal` (**needs verification**)

- Verify signature using PayPal's verification API (`PAYPAL_WEBHOOK_ID`) or certificate method.
- Insert into `webhook_events` (provider `paypal`) keyed by event id (duplicates ignored), then
  process; each state change writes `billing_events`.
- Events we expect to handle (exact names to verify): subscription activated, updated,
  suspended, cancelled, expired, payment failed; sale/capture completed; capture refunded.
  Mapping in [`BILLING.md §5`](./BILLING.md).

## 8. Outbound integrations (from `ai-worker`, `kb-ingest`, `scheduler`)

| Target                 | Purpose                          | Notes                                                                                                                      |
| ---------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Anthropic Messages API | generation, classification       | via `@anthropic-ai/sdk` in Deno (npm specifier) — Deno compatibility **needs verification**                                |
| Voyage AI embeddings   | chunk + query embeddings         | REST; batch size/limits **need verification**                                                                              |
| Meta Graph API         | send messages, verify connection | version pinned via `META_GRAPH_API_VERSION`                                                                                |
| Resend                 | transactional email              | from `RESEND_FROM_EMAIL`, templates in `ar`/`en`                                                                           |
| n8n                    | side automations                 | `POST N8N_WEBHOOK_URL` with `X-Signature: sha256=<hmac>`; payload `{event_type, occurred_at, workspace{ id, name }, data}` |
