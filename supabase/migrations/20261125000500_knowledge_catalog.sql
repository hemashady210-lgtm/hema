-- =============================================================================
-- 0005 · Knowledge base (RAG) and product/menu catalog
-- v1 sources (decision C4): business_info, qa, catalog, file (PDF/DOCX/TXT). 'url' = later.
-- Embeddings: Voyage AI, 1024 dims (proposal P10 — dimension needs verification per model).
-- =============================================================================

create table public.knowledge_sources (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  bot_id          uuid,                 -- null = shared by all bots in the workspace
  type            public.knowledge_source_type not null,
  title           text not null,
  status          public.processing_status not null default 'pending',
  -- file sources
  storage_path    text,                 -- bucket `knowledge-files`, `<workspace_id>/<source_id>/<name>`
  mime_type       text check (mime_type is null or mime_type in (
                    'application/pdf',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'text/plain')),
  size_bytes      bigint check (size_bytes >= 0),
  checksum_sha256 text,
  -- url sources (later phase)
  source_url      text,
  language        text,                 -- dominant language detected at ingestion
  chunk_count     integer not null default 0,
  error           text,
  processed_at    timestamptz,
  created_by      uuid references auth.users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, bot_id) references public.bots (workspace_id, id) on delete cascade,
  check (type <> 'file' or storage_path is not null),
  check (type <> 'url' or source_url is not null)
);
create index knowledge_sources_workspace_idx on public.knowledge_sources (workspace_id, type);
create trigger knowledge_sources_updated_at before update on public.knowledge_sources
  for each row execute function private.set_updated_at();

-- Manual Q&A pairs. Each pair is embedded as one chunk.
create table public.knowledge_qa (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  source_id    uuid not null,
  question     text not null check (char_length(question) <= 1000),
  answer       text not null check (char_length(answer) <= 4000),
  language     text not null default 'ar',
  -- Alternative phrasings (dialect variants help retrieval: MSA / Gulf / Egyptian)
  alt_questions text[] not null default '{}',
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (workspace_id, source_id) references public.knowledge_sources (workspace_id, id) on delete cascade
);
create index knowledge_qa_source_idx on public.knowledge_qa (source_id);
create trigger knowledge_qa_updated_at before update on public.knowledge_qa
  for each row execute function private.set_updated_at();

-- Retrieval units. Written only by the ingestion worker (service role).
create table public.knowledge_chunks (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  bot_id          uuid,                       -- copied from source for filter speed
  source_id       uuid not null,
  source_type     public.knowledge_source_type not null,
  ref_id          uuid,                       -- knowledge_qa.id / catalog_items.id when applicable
  chunk_index     integer not null,
  content         text not null,
  language        text,
  token_count     integer,
  embedding       extensions.vector(1024),
  embedding_model text,                       -- e.g. 'voyage-multilingual-2' (re-embed on change)
  -- 'simple' config: Postgres has no built-in Arabic stemmer guarantee (needs verification
  -- for the server's snowball build); 'simple' works for both languages as a lexical signal.
  fts             tsvector generated always as (to_tsvector('simple', content)) stored,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  foreign key (workspace_id, source_id) references public.knowledge_sources (workspace_id, id) on delete cascade
);
create index knowledge_chunks_scope_idx on public.knowledge_chunks (workspace_id, bot_id);
create index knowledge_chunks_source_idx on public.knowledge_chunks (source_id);
create index knowledge_chunks_fts_idx on public.knowledge_chunks using gin (fts);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- -----------------------------------------------------------------------------
-- Catalog (menu / products with prices). Prices are authoritative here; the AI never
-- invents prices (proposal P15).
-- -----------------------------------------------------------------------------
create table public.catalog_categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  branch_id    uuid,
  name         jsonb not null check (private.is_i18n_text(name)),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete cascade
);
create trigger catalog_categories_updated_at before update on public.catalog_categories
  for each row execute function private.set_updated_at();

create table public.catalog_items (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  branch_id     uuid,
  category_id   uuid,
  sku           text,
  name          jsonb not null check (private.is_i18n_text(name)),
  description   jsonb check (private.is_i18n_text(description)),
  price_cents   bigint not null check (price_cents >= 0),     -- minor units (proposal P14)
  currency      char(3) not null default 'SAR',
  -- [{"name":{"ar":"..","en":".."},"choices":[{"label":{...},"price_delta_cents":500}]}]
  options       jsonb not null default '[]'::jsonb,
  image_path    text,
  is_available  boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, category_id) references public.catalog_categories (workspace_id, id) on delete set null (category_id),
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete cascade
);
create index catalog_items_workspace_idx on public.catalog_items (workspace_id, is_available);
create unique index catalog_items_sku_unique on public.catalog_items (workspace_id, sku) where sku is not null;
create index catalog_items_name_trgm_idx on public.catalog_items
  using gin ((coalesce(name ->> 'ar', '') || ' ' || coalesce(name ->> 'en', '')) extensions.gin_trgm_ops);
create trigger catalog_items_updated_at before update on public.catalog_items
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.knowledge_sources  enable row level security;
alter table public.knowledge_qa       enable row level security;
alter table public.knowledge_chunks   enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_items      enable row level security;

create policy knowledge_sources_select on public.knowledge_sources for select to authenticated
  using (private.is_workspace_member(workspace_id));
-- Files are registered through the `api` function (upload URL + ingestion job); manual Q&A /
-- business_info / catalog sources may be created directly by owner/admin.
create policy knowledge_sources_write on public.knowledge_sources for all to authenticated
  using (private.can_write(workspace_id))
  with check (private.can_write(workspace_id) and type in ('qa', 'business_info', 'catalog'));

create policy knowledge_qa_select on public.knowledge_qa for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy knowledge_qa_write on public.knowledge_qa for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

-- Chunks are internal: no client policies (service role only).

create policy catalog_categories_select on public.catalog_categories for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy catalog_categories_write on public.catalog_categories for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

create policy catalog_items_select on public.catalog_items for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy catalog_items_write on public.catalog_items for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));
