# AI CRM (working title)

Multi-tenant AI CRM SaaS: bilingual (Arabic/English) AI bots for website chat, WhatsApp,
Messenger and Instagram, with a shared inbox, orders/reservations, human handoff and
usage-based plans.

**Status:** Phase 01 (Architecture & Foundation): design docs, database migrations and repo
scaffold, awaiting owner approval. No product features are implemented yet.

- Project overview: [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
- Decisions (source of truth): [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Progress: [`docs/DEVELOPMENT_PROGRESS.md`](docs/DEVELOPMENT_PROGRESS.md)
- Contributor/AI guidance: [`CLAUDE.md`](CLAUDE.md)

## Requirements

Node ≥ 22.12, pnpm 10, Supabase CLI + Docker (from Phase 02).

```bash
pnpm install
pnpm lint && pnpm typecheck
cp .env.example .env.local   # fill in values locally; never commit
```
