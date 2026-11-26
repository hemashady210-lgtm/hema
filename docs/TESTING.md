# Testing Strategy

## 1. Pyramid & tools

| Layer         | Tool                                                                              | Scope                                                                                                                                     | Runs                                    |
| ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Database      | **pgTAP** via `supabase test db` (`supabase/tests/database/*.test.sql`)           | RLS isolation per table, column grants, plan-limit triggers, metering (`consume/release`), queue RPCs, retrieval function, seed integrity | every PR (CI)                           |
| Unit          | **Vitest** (packages, dashboard logic), **Deno test** (edge functions, `_shared`) | prompt builder, tool validators, price computation, language detection, entitlement mapping, webhook normalizers, zod schemas             | every PR                                |
| Integration   | Deno tests against the local Supabase stack                                       | edge function routes with real DB + RLS; webhook signature verification with recorded fixtures; job lifecycle                             | every PR (Phase 02+)                    |
| Contract      | recorded vendor fixtures (Meta, PayPal, Anthropic, Voyage)                        | parsing/normalization of real payloads; no live calls in CI                                                                               | every PR                                |
| E2E           | **Playwright** (Chromium + WebKit), both `ar`/RTL and `en`/LTR                    | sign-up → workspace, KB, widget chat, billing sandbox flows, admin flows                                                                  | PR (smoke) + nightly (full)             |
| Accessibility | `@axe-core/playwright`                                                            | every E2E page in both directions                                                                                                         | with E2E                                |
| Visual        | Playwright screenshots                                                            | key screens × {dark, light} × {ar, en}                                                                                                    | nightly                                 |
| AI quality    | eval harness (`packages/ai-engine/evals`)                                         | golden set (AI_ENGINE §10)                                                                                                                | on prompt/model change + nightly sample |
| Load          | k6 (or similar)                                                                   | widget message throughput, queue latency, webhook bursts                                                                                  | before launch (Phase 09)                |

## 2. Phase 01 status

- `supabase/tests/database/01_rls_tenant_isolation.test.sql` — 14 assertions.
- `supabase/tests/database/02_plan_limits_metering.test.sql` — 18 assertions (incl. model routing profiles).
- Validated on a throwaway local Postgres 16 + pgvector with stub `auth`/`storage` schemas:
  **32/32 passed**. Must be re-run against the real Supabase local stack in Phase 02.

## 3. Mandatory test rules

1. **Every new table** ships with RLS tests: member of A cannot read/write B; each role's
   allowed/denied operations; anonymous access denied unless intended.
2. **Every plan limit or feature gate** ships with a trigger test (allowed at limit − 1, rejected
   at limit, override raises the limit).
3. **Every money or usage path** is tested for idempotency (replay the same webhook/job twice).
4. **Every webhook** has signature-valid, signature-invalid, duplicate and out-of-order tests.
5. **Every UI string** exists in `ar` and `en` (missing-key check in CI); RTL snapshot for new
   screens.
6. No test calls live third-party APIs in CI; live smoke tests run manually against sandboxes.
7. Bugs get a regression test before the fix is merged.

## 4. RTL/LTR checks

- Playwright projects run each E2E spec twice (`locale: ar`, `locale: en`).
- Lint rule bans physical direction utilities (`ml-`, `pr-`, `left-`…) in app code.
- Snapshot tests for mixed content: Arabic message containing an English product name, phone
  number and price.

## 5. AI evaluation gates (from Phase 04)

| Metric                                                        | Gate    |
| ------------------------------------------------------------- | ------- |
| Reply language matches customer language                      | ≥ 98 %  |
| Grounded in provided knowledge (judge + rules)                | ≥ 95 %  |
| Invented prices / hours / policies                            | 0       |
| Correct tool call when expected (orders/reservations/handoff) | ≥ 95 %  |
| Unnecessary handoff                                           | ≤ 5 %   |
| p95 latency (widget, end-to-end)                              | ≤ 6 s   |
| Escalation rate (Haiku → Sonnet) on the golden set            | 10–20 % |

The language-match, grounding and invented-facts gates apply **per dialect** (Gulf, Egyptian,
MSA) on the Arabic dialect eval set, run with production routing (decision A15). A failure in
any dialect switches the `standard` profile's `generation_model` in the DB and the eval is re-run.

## 6. Test data

- Seed script (Phase 02) creates demo workspaces per plan with realistic bilingual businesses
  (restaurant in Riyadh, clinic in Cairo, store in Dubai) — fictional names only.
- No production data in non-production environments.
