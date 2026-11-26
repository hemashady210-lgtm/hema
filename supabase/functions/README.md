# Edge Functions (Deno)

No function code exists yet. The database they rely on is live on the dev project since P2.
Functions follow MASTER_PROMPT §4 (decision E7); contracts are in [`docs/API.md`](../../docs/API.md)
and [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md#4-edge-functions-e7).

| Function         | Auth                                                       | Purpose                                                                 | Phase    |
| ---------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| `api`            | Supabase JWT / API key; `admin/*`: JWT + `platform_admins` | Dashboard mutations, Enterprise `/v1`, Super Admin `admin/*` routes     | P3+      |
| `widget-gateway` | Bot public key + exact Origin + signed session token       | Website-widget session and message endpoints                            | P8       |
| `webhook-meta`   | Verify token + `X-Hub-Signature-256`                       | WhatsApp / Messenger / Instagram inbound + statuses                     | P13      |
| `webhook-paypal` | PayPal signature verification                              | Subscription + one-time payment events                                  | P12      |
| `ai-worker`      | Internal secret header                                     | Jobs `ai_reply`, `deliver_message`                                      | P7       |
| `kb-ingest`      | Internal secret header                                     | Jobs `ingest_knowledge_source`, `embed_chunks`, reindex                 | P5       |
| `scheduler`      | pg_cron + pg_net sweep                                     | Stuck jobs, rollovers, trial / grace expiry, retention, rollups, outbox | P7 / P10 |

Shared code lives in `supabase/functions/_shared/`, with a `deno.json` per function (the pattern
Supabase documents, checked 2026-11-26). Whether `supabase functions deploy` bundles imports from
`packages/*` (outside this directory) is not stated in the docs — **needs verification** with the
first function in P3 (see `docs/RISKS.md` R-14); fallback: vendor `packages/*` into
`_shared/vendor/` at build time.
