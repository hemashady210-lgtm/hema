# API Specification (v1)

> Phase 01 contract. Nothing here is implemented yet. Third-party payloads (Meta, PayPal) are
> described at the level we depend on and are marked **needs verification** wherever the exact
> vendor format, header or event name has to be confirmed against current docs before
> implementation.

## 1. Surfaces

| Surface                 | Base URL (Supabase Functions)                                  | Auth                                                         | Consumers          |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ | ------------------ |
| Dashboard reads         | PostgREST via supabase-js                                      | Supabase JWT + RLS                                           | dashboard          |
| App API                 | `/functions/v1/api/v1/*`                                       | `Authorization: Bearer <Supabase JWT>`                       | dashboard          |
| Public API (Enterprise) | `/functions/v1/api/v1/*` (same routes, subset)                 | `Authorization: Bearer sk_live_…` (API key, scopes)          | customer systems   |
| Widget API              | `/functions/v1/widget/v1/*`                                    | `X-Widget-Key: wk_…` + Origin allow-list + `X-Visitor-Token` | widget.js          |
| Admin API               | `/functions/v1/admin/v1/*`                                     | Supabase JWT + `platform_admins`                             | dashboard `/admin` |
| Webhooks                | `/functions/v1/webhooks-meta`, `/functions/v1/webhooks-paypal` | vendor signatures                                            | Meta, PayPal       |
| Worker                  | `/functions/v1/worker`                                         | `X-Worker-Secret`                                            | internal only      |

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
  widget 30 msg/min/visitor and 600 msg/min/widget key. Responses include `RateLimit-*` headers
  and `429` with `Retry-After`.

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

| Method | Path                                    | Role               | Description                                                                                                                                              |
| ------ | --------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/workspaces`                        | any signed-in user | Create workspace + owner membership + 7-day trial subscription + default bot + widget connection (atomic). Body `{name, slug, default_locale, timezone}` |
| PATCH  | `/v1/workspaces/{ws}`                   | owner/admin        | name, locale, timezone, logo (also allowed directly via RLS)                                                                                             |
| POST   | `/v1/workspaces/{ws}/invitations`       | owner/admin        | `{email, role}`; checks `max_users`; sends Resend email                                                                                                  |
| POST   | `/v1/invitations/accept`                | invitee            | `{token}`                                                                                                                                                |
| DELETE | `/v1/workspaces/{ws}/invitations/{id}`  | owner/admin        | revoke                                                                                                                                                   |
| PATCH  | `/v1/workspaces/{ws}/members/{user_id}` | owner/admin        | `{role?, status?}`; owner transfer only by owner                                                                                                         |
| DELETE | `/v1/workspaces/{ws}/members/{user_id}` | owner/admin        | remove (cannot remove owner)                                                                                                                             |

### Bots, knowledge, catalog

Simple CRUD on bots, business profile, Q&A, catalog goes **directly through supabase-js** (RLS +
limit triggers). Function routes exist only where there are side effects:

| Method | Path                                                       | Role        | Description                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/workspaces/{ws}/knowledge/files`                      | owner/admin | `{file_name, mime_type, size_bytes, bot_id?}` → validates entitlements (`knowledge_files_max`, `knowledge_file_max_mb`, MIME) → creates `knowledge_sources(type=file,status=pending)` → returns `{source_id, upload_url}` (signed upload URL) |
| POST   | `/v1/workspaces/{ws}/knowledge/files/{source_id}/complete` | owner/admin | confirms upload, verifies checksum/size, enqueues `ingest_knowledge_source`                                                                                                                                                                   |
| POST   | `/v1/workspaces/{ws}/knowledge/sources/{id}/reprocess`     | owner/admin | re-ingest                                                                                                                                                                                                                                     |
| POST   | `/v1/workspaces/{ws}/bots/{bot}/test`                      | owner/admin | sandbox reply for the "Test your bot" panel: same pipeline, **not billed**, rate-limited (20/hour), never delivered to a channel                                                                                                              |

### Channels (Connect section)

| Method | Path                                               | Role        | Description                                                                                         |
| ------ | -------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| GET    | `/v1/workspaces/{ws}/channels`                     | member      | Connect-page view model: per channel type → connection(s), open request, plan allowance, fee status |
| POST   | `/v1/workspaces/{ws}/channel-requests`             | owner/admin | `{channel_type: whatsapp                                                                            | messenger | instagram, bot_id, contact_name, contact_email, contact_phone?, business_name, details{…}, customer_notes?, payment_method: paypal | manual}`→ status`pending`; emits `channel_request.created`(Resend + n8n); returns`{request, payment: {type:'paypal', approve_url} | {type:'manual', instructions}}` |
| POST   | `/v1/workspaces/{ws}/channel-requests/{id}/cancel` | owner/admin | only while `pending`; refund flow if fee paid                                                       |
| PATCH  | `/v1/workspaces/{ws}/widget`                       | owner/admin | `{allowed_origins[]}` (exact origins, validated)                                                    |
| POST   | `/v1/workspaces/{ws}/widget/rotate-key`            | owner/admin | new `public_key`, old key stops working                                                             |
| POST   | `/v1/workspaces/{ws}/channels/{id}/disconnect`     | owner       | customer-initiated disconnect (status → `disconnected`, token deleted from Vault)                   |

### Inbox

| Method | Path                                                        | Role   | Description                                                                                                                                                               |
| ------ | ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/workspaces/{ws}/conversations/{id}/messages`           | agent+ | Human reply `{body, attachments?[], client_message_id}` → insert + deliver; **not billed**. WhatsApp outside 24 h window → `409 outside_service_window` (templates later) |
| POST   | `/v1/workspaces/{ws}/conversations/{id}/handoff`            | agent+ | `{action: take                                                                                                                                                            | release | resolve}`; requires `human_handoff` |
| POST   | `/v1/workspaces/{ws}/conversations/{id}/close`              | agent+ | close conversation                                                                                                                                                        |
| POST   | `/v1/workspaces/{ws}/orders/{id}/confirm` · `/cancel`       | agent+ | status transitions with customer notification                                                                                                                             |
| POST   | `/v1/workspaces/{ws}/reservations/{id}/confirm` · `/cancel` | agent+ | same                                                                                                                                                                      |

### Billing

| Method | Path                                         | Role        | Description                                                                                                            |
| ------ | -------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/workspaces/{ws}/billing`                | owner/admin | plan, status, period, usage (used/included/overage), entitlements, upcoming changes                                    |
| POST   | `/v1/workspaces/{ws}/billing/checkout`       | owner       | `{plan_code, interval: month                                                                                           | year}`→ PayPal subscription →`{approve_url}` |
| POST   | `/v1/workspaces/{ws}/billing/change-plan`    | owner       | upgrade/downgrade; upgrade immediate, downgrade at period end (BILLING.md §6)                                          |
| POST   | `/v1/workspaces/{ws}/billing/cancel`         | owner       | cancel at period end                                                                                                   |
| POST   | `/v1/workspaces/{ws}/billing/manual-request` | owner       | manual payment request `{plan_code?, interval?, product_code?, contact_*, preferred_method, message}` → admin notified |
| GET    | `/v1/workspaces/{ws}/billing/transactions`   | owner/admin | billing history                                                                                                        |

### Data rights

| Method | Path                                | Role        | Description                                                  |
| ------ | ----------------------------------- | ----------- | ------------------------------------------------------------ |
| POST   | `/v1/workspaces/{ws}/exports`       | owner       | start export → `data_requests`                               |
| GET    | `/v1/workspaces/{ws}/exports/{id}`  | owner       | status + signed URL when ready                               |
| POST   | `/v1/workspaces/{ws}/deletion`      | owner       | schedule deletion (grace period); `DELETE` same path cancels |
| POST   | `/v1/workspaces/{ws}/api-keys`      | owner/admin | Enterprise (`api_access`): returns full key **once**         |
| DELETE | `/v1/workspaces/{ws}/api-keys/{id}` | owner/admin | revoke                                                       |

## 4. Public API (Enterprise, API keys)

Scopes: `conversations:read`, `messages:write`, `contacts:read`, `contacts:write`,
`orders:read`, `orders:write`, `reservations:read`, `knowledge:write`.

| Method    | Path                                                                               | Scope                                             |
| --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| GET       | `/v1/conversations` · `/v1/conversations/{id}` · `/v1/conversations/{id}/messages` | conversations:read                                |
| POST      | `/v1/conversations/{id}/messages`                                                  | messages:write (human/system message, not billed) |
| GET/PATCH | `/v1/contacts[/{id}]`                                                              | contacts:*                                        |
| GET/PATCH | `/v1/orders[/{id}]`                                                                | orders:*                                          |
| GET       | `/v1/reservations[/{id}]`                                                          | reservations:read                                 |
| POST      | `/v1/knowledge/qa` (bulk upsert)                                                   | knowledge:write                                   |

Outbound webhooks to customer systems (order created, etc.) are a later phase.

## 5. Widget API

Every request: `X-Widget-Key`, browser `Origin` must exactly match an entry in
`widget_configs.allowed_origins` (empty list = widget disabled). CORS echoes the allowed origin only.

| Method | Path                                                    | Description                                                                                                              |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/widget/v1/bootstrap`                                  | Theme, greeting, launcher label, position, pre-chat fields, languages, branding flag, `status: online                    | offline` (real: offline if workspace not active or widget disabled) |
| POST   | `/widget/v1/sessions`                                   | `{locale?}` → `{visitor_token}` (opaque, 256-bit, stored hashed; long-lived per browser)                                 |
| POST   | `/widget/v1/conversations`                              | start or resume (one open conversation per visitor) `{prechat?{name,phone,email}}` → `{conversation_id, realtime_topic}` |
| POST   | `/widget/v1/conversations/{id}/messages`                | `{client_message_id, text ≤ 2000}` → `202 {message_id}`; enqueues AI reply                                               |
| GET    | `/widget/v1/conversations/{id}/messages?after={cursor}` | messages for this visitor's conversation only                                                                            |

Realtime: the widget subscribes to Broadcast topic `widget:{realtime_topic}` and only receives
`{"type":"new_message"}` / `{"type":"typing"}` pings — never content (P6). Polling fallback every
4 s → 15 s with backoff when Realtime is unavailable. Exact Realtime authorization model for
public broadcast channels — **needs verification**.

## 6. Admin API (Super Admin)

| Method  | Path                                               | Description                                                                                                                                                                                                                                                                                                                                                    |
| ------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/admin/v1/workspaces?query=&status=&plan=`        | search/list with plan, usage, channels                                                                                                                                                                                                                                                                                                                         |
| GET     | `/admin/v1/workspaces/{ws}`                        | full detail incl. internal notes                                                                                                                                                                                                                                                                                                                               |
| POST    | `/admin/v1/workspaces/{ws}/status`                 | `{status: active                                                                                                                                                                                                                                                                                                                                               | read_only            | suspended, reason}`              |
| POST    | `/admin/v1/workspaces/{ws}/subscriptions/activate` | manual activation `{plan_code, interval?, period_start, period_end, custom_amount_cents?, currency?, transaction{amount_cents, currency, provider_ref?, note}}`                                                                                                                                                                                                |
| POST    | `/admin/v1/workspaces/{ws}/entitlement-overrides`  | `{key, value, reason, expires_at?}` (Enterprise custom limits)                                                                                                                                                                                                                                                                                                 |
| GET     | `/admin/v1/channel-requests?status=pending`        | queue                                                                                                                                                                                                                                                                                                                                                          |
| POST    | `/admin/v1/channel-requests/{id}/status`           | `{status: in_progress                                                                                                                                                                                                                                                                                                                                          | rejected             | canceled, note, internal_note?}` |
| POST    | `/admin/v1/channel-requests/{id}/connect`          | `{external_account_id, external_business_id?, phone_number_display?, display_name, access_token, token_expires_at?, config{}}` → token to **Vault**, `channel_connections` row `connected` only after a live check succeeds (e.g. fetch phone number / page via Graph API — **needs verification** of endpoint). Never marks connected without the check (A14) |
| POST    | `/admin/v1/channel-connections/{id}/status`        | `{status: error                                                                                                                                                                                                                                                                                                                                                | disconnected, note}` |
| POST    | `/admin/v1/transactions/{id}/refund`               | PayPal refund or manual refund record                                                                                                                                                                                                                                                                                                                          |
| POST    | `/admin/v1/usage-periods/{id}/overage-invoice`     | create manual overage transaction (C5)                                                                                                                                                                                                                                                                                                                         |
| GET/PUT | `/admin/v1/plans…`, `/admin/v1/settings/{key}`     | edit plans, prices, entitlements, platform settings                                                                                                                                                                                                                                                                                                            |

Every admin mutation writes `audit_logs` (`actor_type = platform_admin`).

## 7. Webhooks (inbound)

### 7.1 Meta — `webhooks-meta` (**needs verification** for every vendor detail below)

- `GET` verification handshake: echo `hub.challenge` when `hub.verify_token` matches
  `META_VERIFY_TOKEN`.
- `POST`: verify `X-Hub-Signature-256` = `sha256=` HMAC of the raw body with `META_APP_SECRET`
  **before** parsing; respond `200` quickly; process asynchronously.
- Routing: WhatsApp events identify the connection by phone-number id in the change metadata;
  Messenger/Instagram by page / IG account id in the entry. Unknown ids are logged and dropped.
- Normalized into `NormalizedInboundEvent { kind: message|status|reaction|unsupported, connection_id, external_contact_id, external_message_id, timestamp, content }`.
- Status callbacks (sent/delivered/read/failed) update `messages.delivery_status`.

### 7.2 PayPal — `webhooks-paypal` (**needs verification**)

- Verify signature using PayPal's verification API (`PAYPAL_WEBHOOK_ID`) or certificate method.
- Insert into `payment_webhook_events` keyed by event id (duplicates ignored), then process.
- Events we expect to handle (exact names to verify): subscription activated, updated,
  suspended, cancelled, expired, payment failed; sale/capture completed; capture refunded.
  Mapping in [`BILLING.md §5`](./BILLING.md).

## 8. Outbound integrations (from the worker)

| Target                 | Purpose                          | Notes                                                                                                                      |
| ---------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Anthropic Messages API | generation, classification       | via `@anthropic-ai/sdk` in Deno (npm specifier) — Deno compatibility **needs verification**                                |
| Voyage AI embeddings   | chunk + query embeddings         | REST; batch size/limits **need verification**                                                                              |
| Meta Graph API         | send messages, verify connection | version pinned via `META_GRAPH_API_VERSION`                                                                                |
| Resend                 | transactional email              | from `RESEND_FROM_EMAIL`, templates in `ar`/`en`                                                                           |
| n8n                    | side automations                 | `POST N8N_WEBHOOK_URL` with `X-Signature: sha256=<hmac>`; payload `{event_type, occurred_at, workspace{ id, name }, data}` |
