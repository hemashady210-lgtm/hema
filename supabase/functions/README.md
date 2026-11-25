# Edge Functions (Deno)

No function code exists yet (Phase 01 = design only). Planned functions, owners and contracts
are specified in [`docs/API_SPEC.md`](../../docs/API_SPEC.md) and
[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md#4-edge-functions).

| Function          | Auth                              | Purpose                                               | Phase |
| ----------------- | --------------------------------- | ----------------------------------------------------- | ----- |
| `api`             | Supabase JWT / API key            | Dashboard mutations + Enterprise public API (`/v1/*`) | 02+   |
| `widget`          | Widget public key + visitor token | Website-widget endpoints                              | 03    |
| `worker`          | `WORKER_SECRET` header            | Claims and runs jobs from `public.jobs`               | 03    |
| `webhooks-meta`   | `X-Hub-Signature-256`             | WhatsApp / Messenger / Instagram inbound              | 06    |
| `webhooks-paypal` | PayPal signature verification     | Subscription + one-time payment events                | 05    |
| `admin`           | Supabase JWT + `platform_admins`  | Super Admin operations                                | 07    |

Shared code will live in `supabase/functions/_shared/`. How `packages/ai-engine` is imported into
functions (import map vs. vendored build) is an open item — **needs verification** against the
current Supabase CLI bundler (see RISK_REGISTER R-14).
