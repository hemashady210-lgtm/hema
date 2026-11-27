# Pro Coders

**Pro Coders** is a multi-tenant AI CRM SaaS: bilingual (Arabic/English) AI bots for website chat, WhatsApp,
Messenger and Instagram, with a shared inbox, orders/reservations, human handoff and
usage-based plans.

**Status:** see [`docs/DEVELOPMENT_PROGRESS.md`](docs/DEVELOPMENT_PROGRESS.md) (P3 auth,
workspaces and app shell, plus the P3 design pass). The product name lives in
`packages/shared/src/brand.ts`; brand assets in [`docs/brand/`](docs/brand).

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
