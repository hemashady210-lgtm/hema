# Project Context

## What we're building

A multi-tenant **AI CRM SaaS** for small and mid-size businesses in Arabic-speaking markets
(and English). Each business (a _workspace_) gets AI bots that answer customers on a **website
widget, WhatsApp, Messenger and Instagram** — in the customer's language and dialect — using the
business's own knowledge (profile, hours, policies, Q&A, menu/catalog, documents). Bots can take
orders and reservations, hand conversations to human agents, and every conversation lands in a
shared inbox with analytics.

Product name is a placeholder: `packages/shared/src/brand.ts`.

## Who uses it

| Persona                         | Needs                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Business owner (Owner)          | Set up bot + knowledge fast, connect channels, see value (answered questions, orders), control cost/plan |
| Manager (Admin)                 | Maintain knowledge/catalog, manage team and channels                                                     |
| Support/sales staff (Agent)     | Inbox, take over from AI, confirm orders/reservations                                                    |
| Viewer                          | Read analytics and conversations                                                                         |
| Platform operator (Super Admin) | Activate manual payments, connect Meta channels manually, manage workspaces, watch health/cost           |
| End customer                    | Fast, correct answers in their language on the channel they already use                                  |

## Business model

Subscription per workspace, billed on **AI-generated replies** (inbound free). Trial (7 days,
100 replies, widget only) → Starter $39 → Growth $99 → Enterprise from $299; annual = 2 months
free; $49 one-time per Meta channel connection. PayPal + manual payment in v1. Full detail:
[`DECISIONS.md §B`](./DECISIONS.md), [`BILLING.md`](./BILLING.md).

## Key constraints

- Arabic + English with full RTL/LTR from day one; Arabic dialects (MSA, Gulf, Egyptian).
- Never fake an integration: Meta channels are connected manually by the operator in v1,
  statuses are real.
- Limits and plans are data, never hardcoded.
- n8n only for side automations; core message path is Supabase-only.
- EU (Frankfurt) hosting in v1.

## Stack (approved)

pnpm monorepo · React + Vite + TS + Tailwind v4 + shadcn/ui · Supabase (Postgres + RLS +
pgvector, Auth, Storage, Realtime, Vault, Edge Functions) · Claude (generation) · Voyage AI
(embeddings) · Cloudflare Pages + CDN · Resend · PayPal · n8n (side automations).

## Document map

| Doc                                                    | Purpose                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| [`MASTER_PROMPT.md`](./MASTER_PROMPT.md)               | Original brief (verbatim)                                                  |
| [`DECISIONS.md`](./DECISIONS.md)                       | Approved decisions, pricing, answers, open proposals — **source of truth** |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                 | System design, flows, security, environments                               |
| [`DATABASE.md`](./DATABASE.md)                         | Schema, ERD, RLS matrix, functions, retention                              |
| [`API_SPEC.md`](./API_SPEC.md)                         | App, public, widget, admin APIs and webhooks                               |
| [`AI_ENGINE.md`](./AI_ENGINE.md)                       | Pipeline, providers, prompts, tools, evals, cost model                     |
| [`BILLING.md`](./BILLING.md)                           | Plans, PayPal/manual flows, metering, trial, fees                          |
| [`CHANNELS.md`](./CHANNELS.md)                         | Connect section, manual Meta flow, adapters, Embedded Signup path          |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)               | Visual language, tokens, RTL rules, components                             |
| [`ROADMAP.md`](./ROADMAP.md)                           | Phases 01–10 with exit criteria                                            |
| [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md)         | Test layers, rules, AI gates                                               |
| [`RISK_REGISTER.md`](./RISK_REGISTER.md)               | Risks, scores, mitigations                                                 |
| [`DEVELOPMENT_PROGRESS.md`](./DEVELOPMENT_PROGRESS.md) | What's done, what's next                                                   |
