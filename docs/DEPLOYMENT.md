# Deployment & Environments

Status: **P2** — the database side is live on the Supabase dev project; application deployment
(Cloudflare Pages, widget CDN, Edge Functions, production project) is P17. MASTER_PROMPT §21.

## 1. Environments

| Env        | Supabase                                                                               | Dashboard / widget                              | Data                                |
| ---------- | -------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| local      | Supabase CLI local stack (`supabase start` / `db start`), `config.toml`                | Vite dev servers                                | `supabase/seed.sql` demo            |
| CI         | Supabase CLI local stack in GitHub Actions (job `db`)                                  | —                                               | seed + pgTAP fixtures (rolled back) |
| staging    | **dev project `ai-crm-dev`** (ref `jpzgdyzbhszyrvzcsljq`, `eu-west-1`, Postgres 17.12) | Cloudflare Pages preview, CDN `/staging/` (P17) | no demo seed (owner decision)       |
| production | new project, **EU · Frankfurt (`eu-central-1`, A5)** — not created yet                 | Cloudflare Pages, CDN `/v1/` (P17)              | real                                |

The dev project's region (Ireland) differs from A5's Frankfurt. It is fine for dev/staging; the
production project must be created in Frankfurt (RISKS R-20).

## 2. Migrations policy

- Files: `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`, applied in order, each in one
  transaction. RLS, policies and grants live in the same file as the table.
- **Applied migrations are frozen.** The 14 baseline files were rewritten in place during P2
  (never applied anywhere before) and applied to the dev project on 2026-11-26; the review fixes
  went into a forward migration (`…20261126000100_p2_review_fixes`). `pnpm db:remote:migrate`
  refuses to run if an applied file changed on disk (checksum against the stored statements). Every later change is a
  new, reviewed, non-destructive migration (no drops of data-bearing objects without an explicit
  owner-approved plan).
- History is recorded in `supabase_migrations.schema_migrations` (version, name, statements), the
  table the Supabase CLI reads, so `supabase migration list --linked` / `db push` can take over.
- Every migration must keep `03_schema_conventions` and `04_role_matrix` green (new tables must
  be added to the matrix).

## 3. Applying and testing against the dev project

The sandbox used in P2 cannot reach Postgres ports, so migrations run through the Supabase
**Management API** with `scripts/db/supabase-remote.mjs`:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...        # personal access token (or proxy placeholder)
export SUPABASE_PROJECT_REF=jpzgdyzbhszyrvzcsljq   # or SUPABASE_URL=https://<ref>.supabase.co
pnpm db:remote:status      # version, extensions, migration table, public table count
pnpm db:remote:migrate     # applies pending files (add `-- --dry-run` to preview)
pnpm db:remote:test        # all pgTAP suites; each file runs in an always-aborted transaction
                           # (files that would end the transaction are refused)
pnpm db:types:remote       # regenerates packages/shared/src/database.types.ts
```

Behind an HTTPS proxy, also set `NODE_USE_ENV_PROXY=1`. Endpoints used:
`POST /v1/projects/{ref}/database/query`, `GET /v1/projects/{ref}/types/typescript`. Verified
behaviour (P2): multi-statement queries return the last statement's rows; an error rolls the whole
request back; queries run as `postgres` (not a superuser).

With direct database access (e.g. a developer machine), the CLI works too:
`supabase link --project-ref <ref>` then `supabase db push` / `supabase test db --linked`.

## 4. Local development

```bash
pnpm install
supabase start          # or: supabase db start   (needs Docker)
supabase db reset       # migrations + seed.sql
supabase test db        # pgTAP
pnpm db:types           # types from the local stack
```

Without Docker / the CLI: `pnpm db:test:local` runs the migrations, seed and suites on a plain
Postgres with pgvector + pgTAP and stub Supabase schemas (`scripts/db/local-stub.sql`). It is a
fast approximation only; CI and the dev project are authoritative.

## 5. CI (`.github/workflows/ci.yml`)

| Job      | Steps                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `checks` | `pnpm install --frozen-lockfile`, lint, format check, typecheck, test                                                     |
| `db`     | `supabase/setup-cli` (CLI **2.122.1**, pinned), `supabase db start`, `supabase test db`, `supabase db lint --level error` |

CI never connects to the dev project (no token in CI). Deploy jobs (staging on merge to `main`,
production on tag) are P17.

## 6. Environment variables

`.env.example` lists every name (§21, E12), placeholders only. Notes verified in P2:

- `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` → the **publishable** key (`sb_publishable_…`);
  `SUPABASE_SERVICE_ROLE_KEY` → a **secret** key (`sb_secret_…`). Legacy JWT keys work until
  Supabase deprecates them in early 2027 (SECURITY.md §6).
- Google sign-in (E8, P3): `config.toml` section `[auth.external.google]` with `enabled`,
  `client_id`, `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"` (name as in the
  Supabase Google guide; the generic config reference shows `…_GOOGLE_SECRET` — use the guide's
  name and verify when wiring P3). Local redirect URI: `http://127.0.0.1:54321/auth/v1/callback`.
- `SUPABASE_ACCESS_TOKEN` is a developer/ops credential for the Management API runner; it is not
  an application variable and must never reach Edge Functions or the browser.

## 7. Production checklist (P17, not started)

Create the Frankfurt project · apply migrations from a clean history · set Edge Function secrets ·
Vault available · pg_cron + pg_net enabled · no `seed.sql` · Cloudflare Pages + versioned widget
CDN · new-style Supabase keys · backups / PITR · health endpoint + structured logs · runbook.
