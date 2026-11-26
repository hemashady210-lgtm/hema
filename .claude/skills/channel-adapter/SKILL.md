---
name: channel-adapter
description: Build or review a messaging channel adapter (Website Widget, WhatsApp Cloud API, Messenger, Instagram) or a connection provisioner. Use when touching webhook verification, inbound normalization, outbound sending, channel capabilities, connection status changes, or Meta Embedded Signup code.
---

# Channel adapter

Source of truth: `docs/ARCHITECTURE.md §8`, `docs/CHANNELS.md` (status machines, adapter
contract, platform specifics table), `docs/DECISIONS.md` (A14). Schema: `channel_connections`,
`channel_connection_requests`, `channel_connection_events`, `widget_configs`.

## Contract (do not change without updating ARCHITECTURE.md)

```ts
interface ChannelAdapter {
  readonly type: 'widget' | 'whatsapp' | 'messenger' | 'instagram';
  parseWebhook(req: Request, rawBody: string): Promise<NormalizedInboundEvent[]>; // verify + normalize
  send(
    conn: ChannelConnection,
    msg: OutboundMessage,
    creds: ChannelCredentials,
  ): Promise<SendResult>;
  capabilities(conn: ChannelConnection): ChannelCapabilities;
}
interface ConnectionProvisioner {
  readonly method: 'automatic' | 'manual' | 'embedded_signup';
  provision(input: unknown): Promise<ProvisionResult>;
}
```

Manual connection and (future) Embedded Signup produce the **same** `channel_connections` row —
only `connection_method` differs — so adapters and the message path never fork on it.

## Rules

1. **No AI or business logic in adapters.** They verify, normalize, send, and report
   capabilities. Everything else lives in the pipeline / `packages/ai-engine`.
2. **Verify before parse.** Meta: HMAC-SHA256 of the **raw body** with the app secret vs
   `X-Hub-Signature-256`, constant-time compare; reject on mismatch (no processing). GET
   subscription handshake echoes `hub.challenge` only when `hub.verify_token` matches.
   Widget: signed short-lived session token + Origin in `allowed_origins`.
3. **Idempotency.** Store the webhook event first (unique provider + event id); messages are
   unique on `(channel, external_message_id)`. Replays must be no-ops.
4. **Return 200 fast.** Normalize → persist → enqueue a job. No model calls inside the webhook.
5. **Unknown event types never throw** — log them as `unsupported` and acknowledge.
6. **Errors map to** `retryable | permanent | auth_error`. `auth_error` moves the connection to
   `error` (recorded as a `channel_connection_events` row). Never set `connected` unless a live
   health check passed.
7. **Credentials** are read server-side from Vault via `credentials_secret_id`; never logged,
   never returned to the client, never in `NormalizedInboundEvent`.
8. **Never invent Meta behavior.** Graph API version comes from `META_GRAPH_API_VERSION`. Field
   names, permissions, messaging-window rules, template requirements and Embedded Signup steps
   must be checked against current official Meta docs; anything unconfirmed is marked
   `needs verification` in `docs/CHANNELS.md §5` and kept behind the adapter. Instagram is not
   assumed identical to Messenger.
9. **Feature flags.** OAuth / Embedded Signup code paths stay behind `meta_embedded_signup`
   (OFF). Missing credentials → real code path + mocked tests + UI status "not configured".
10. **Plan gating** (`allowed_channel_types`, `max_meta_channels`) is enforced by DB triggers —
    adapters don't re-check plan codes.

## Tests (Deno, in the function or package)

- valid signature accepted; tampered body / wrong secret / missing header rejected
- verify-token handshake success + failure
- fixture payloads for text, media, status updates (sent/delivered/read/failed), unknown type
- duplicate delivery → single message
- send(): success, retryable (5xx/429), permanent (4xx), auth_error (expired token) mapping
- outside-window send on WhatsApp requires a template (capabilities)

Use recorded fixture JSON under a `__fixtures__/` folder; mark any fixture not taken from
official docs as **UNVERIFIED**.
