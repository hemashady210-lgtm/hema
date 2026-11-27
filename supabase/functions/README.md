# Edge Functions (Deno)

`api` is built (P3: workspaces, invitations, members); the others are built in their phase. The
database they rely on is live on the dev project since P2.
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

Shared code lives in `supabase/functions/_shared/` (env + keys, error envelope + CORS, DB-error
mapping, Auth verification, rate limiter, router, JSON logs, tokens, Resend adapter), with a
`deno.json` per function. `packages/shared` is imported through the import map
(`"@ai-crm/shared": "../../../packages/shared/src/index.ts"`).

**R-14 verified (P3):** `supabase functions deploy api --project-ref <ref> --use-api` bundles the
`packages/shared` files; Docker-based bundling was not tested. `deno.json` sets `"lock": false`
(Deno 2.9 writes lockfile v5; the edge runtime is Deno 2.1-compatible); versions are pinned exactly
in the import map instead.

```bash
pnpm test:functions                 # unit tests (fakes): _shared + api
deno lint supabase/functions
# integration (local stack running):
API_INTEGRATION_URL=http://127.0.0.1:54321/functions/v1/api SUPABASE_URL=… \
  SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… \
  deno test --config supabase/functions/api/deno.json --allow-env --allow-net supabase/functions/api/integration_test.ts
pnpm dev:api                        # host Deno on :54399 when the edge-runtime container cannot reach npm
```

Secrets: `APP_URL` (dashboard origin for invitation links; required on hosted projects before
invitations work), optional `ALLOWED_ORIGINS` (extra CORS origins), `RESEND_API_KEY` +
`RESEND_FROM_EMAIL` (both, or email reports `not_configured`). Supabase injects `SUPABASE_URL` and
the keys.
