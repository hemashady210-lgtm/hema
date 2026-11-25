# Master Prompt

> Saved verbatim from the project owner on 2026-11-25. Approved answers to the Phase 01
> clarifying questions and the approved pricing live in [`DECISIONS.md`](./DECISIONS.md);
> where the two differ, `DECISIONS.md` wins.

---

You are starting Phase 01 (Architecture & Foundation) of a multi-tenant AI CRM SaaS.
Read docs/MASTER_PROMPT.md fully. The decisions below are APPROVED and override any open options in it.

APPROVED DECISIONS
- Monorepo (pnpm workspaces): apps/dashboard, apps/widget, packages/shared, packages/ai-engine, supabase/, docs/
- Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui. Advanced, realistic, premium UI. Use my Apple design-system skill as the visual foundation for docs/DESIGN_SYSTEM.md.
- i18n: Arabic + English from day one, full RTL/LTR support, user-switchable.
- Database/Auth/Storage: NEW Supabase project (PostgreSQL + RLS + pgvector). Local dev via Supabase CLI.
- Backend: Supabase Edge Functions (REST API, webhooks, async AI worker). Async jobs via a Postgres-based queue.
- AI: Claude (Anthropic) for generation behind a provider abstraction. Embeddings via a separate provider (propose Voyage AI vs OpenAI embeddings).
- Hosting: Cloudflare (Pages for dashboard, CDN for widget script).
- Email: Resend.
- n8n: side automations only (admin notifications, reports). NOT in the core message path.
- Billing: PayPal subscriptions first. Also "manual payment" path: customer contacts admin, admin activates the plan manually. Payment provider abstraction so Stripe can be added later.
- Super Admin panel: manage workspaces, manually activate subscriptions, manually manage channel connections.

CONNECTORS (IMPORTANT)
- Build the full Connect section UI exactly as specified: WhatsApp, Messenger, Instagram, Website Widget.
- Meta channels are MANUAL for now: customer fills a connection request form -> status "pending" -> admin notified (via n8n/Resend) -> admin connects manually and sets status "connected".
- Do NOT implement Meta OAuth/Embedded Signup now, but design the schema and adapters so it can be added later (Embedded Signup v4) without rewrites.
- Website Widget works fully automatically.
- Never fake a working integration; show real statuses only.

YOUR TASK NOW
1. Inspect the repo and report what exists.
2. Ask me any remaining clarifying questions in ONE numbered list. Wait for answers.
3. Then produce the Phase 01 deliverables from the master prompt (architecture, DB schema + Mermaid ERD, SQL migration files (not executed), API spec, AI engine, billing, roadmap, testing, risks).
4. Create the folder structure, CLAUDE.md, docs/PROJECT_CONTEXT.md, docs/DEVELOPMENT_PROGRESS.md, docs/DESIGN_SYSTEM.md, docs/ARCHITECTURE.md, base configs, .env.example (no real secrets).

RULES
- No feature code, no UI pages, no auth implementation, no deployment in this phase.
- Never invent API behavior; mark unverified items "needs verification".
- Update DEVELOPMENT_PROGRESS.md at the end.
- Do not start Phase 02. Present everything for my approval.
