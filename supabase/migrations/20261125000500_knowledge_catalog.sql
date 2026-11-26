-- =============================================================================
-- 0005 · Knowledge base (RAG) and product/menu catalog
-- P2 (E9): knowledge_sources → kb_sources + kb_documents, knowledge_qa → faqs (+ tags),
-- knowledge_chunks → kb_chunks (+ document_id). Source types per §6.
-- Embeddings: Voyage AI, 1024 dims (proposal P10 — dimension needs verification per model).
-- =============================================================================

create table public.kb_sources (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  bot_id         uuid,                 -- null = shared by all bots in the workspace
  type           public.kb_source_type not null,
  title          text not null check (char_length(title) between 1 and 200),
  status         public.processing_status not null default 'pending',
  error          text,
  last_synced_at timestamptz,
  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, bot_id) references public.bots (workspace_id, id) on delete cascade
);
create index kb_sources_workspace_idx on public.kb_sources (workspace_id, type);
create trigger kb_sources_updated_at before update on public.kb_sources
  for each row execute function private.set_updated_at();

-- One uploaded file (type `file`) or one manual note (type `manual`) per row.
-- Ingestion status columns are written by `kb-ingest` (service role) only.
create table public.kb_documents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  source_id     uuid not null,
  title         text check (char_length(title) <= 200),
  -- file documents: bucket `knowledge-files`, `<workspace_id>/<source_id>/<document_id>/<name>`
  storage_path  text,
  file_name     text,
  mime_type     text check (mime_type is null or mime_type in (
                  'application/pdf',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'text/plain')),
  size_bytes    bigint check (size_bytes >= 0),
  checksum      text,                 -- sha-256 of the file; unchanged files are not re-embedded
  -- manual notes
  body          text check (char_length(body) <= 20000),
  status        public.processing_status not null default 'pending',
  error         text,
  language      text,                 -- dominant language detected at ingestion
  chunk_count   integer not null default 0,
  processed_at  timestamptz,
  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, source_id) references public.kb_sources (workspace_id, id) on delete cascade,
  check ((storage_path is null) <> (body is null))
);
create index kb_documents_workspace_idx on public.kb_documents (workspace_id);
create index kb_documents_source_idx on public.kb_documents (source_id);
create trigger kb_documents_updated_at before update on public.kb_documents
  for each row execute function private.set_updated_at();

-- FAQs (§6). Each pair is embedded as one chunk.
create table public.faqs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  source_id     uuid not null,
  question      text not null check (char_length(question) <= 1000),
  answer        text not null check (char_length(answer) <= 4000),
  language      text not null default 'ar',
  -- Alternative phrasings (dialect variants help retrieval: MSA / Gulf / Egyptian)
  alt_questions text[] not null default '{}',
  tags          text[] not null default '{}',
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, source_id) references public.kb_sources (workspace_id, id) on delete cascade
);
create index faqs_workspace_idx on public.faqs (workspace_id);
create index faqs_source_idx on public.faqs (source_id);
create index faqs_tags_idx on public.faqs using gin (tags);
create trigger faqs_updated_at before update on public.faqs
  for each row execute function private.set_updated_at();

-- Retrieval units. Written only by `kb-ingest` (service role).
create table public.kb_chunks (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  bot_id          uuid,                       -- copied from source for filter speed
  source_id       uuid not null,
  document_id     uuid,                       -- null for structured sources (profile/faq/catalog/policy)
  source_type     public.kb_source_type not null,
  ref_id          uuid,                       -- faqs.id / catalog_items.id / policies.id when applicable
  chunk_index     integer not null,
  content         text not null,
  language        text,
  token_count     integer,
  embedding       extensions.vector(1024),
  embedding_model text,                       -- e.g. 'voyage-multilingual-2' (re-embed on change)
  -- 'simple' config works for both languages as a lexical signal. An `arabic` config exists
  -- on the dev project (Postgres 17, verified P2); per-language FTS can be added later.
  fts             tsvector generated always as (to_tsvector('simple', content)) stored,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  foreign key (workspace_id, source_id) references public.kb_sources (workspace_id, id) on delete cascade,
  foreign key (workspace_id, document_id) references public.kb_documents (workspace_id, id) on delete cascade
);
create index kb_chunks_scope_idx on public.kb_chunks (workspace_id, bot_id);
create index kb_chunks_source_idx on public.kb_chunks (source_id);
create index kb_chunks_document_idx on public.kb_chunks (document_id) where document_id is not null;
create index kb_chunks_fts_idx on public.kb_chunks using gin (fts);
create index kb_chunks_embedding_idx on public.kb_chunks
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
create index catalog_categories_workspace_idx on public.catalog_categories (workspace_id);
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
  -- §6 attributes: free-form, e.g. {"spicy":true,"calories":420}
  attributes    jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
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
alter table public.kb_sources         enable row level security;
alter table public.kb_documents       enable row level security;
alter table public.faqs               enable row level security;
alter table public.kb_chunks          enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_items      enable row level security;

create policy kb_sources_select on public.kb_sources for select to authenticated
  using (private.is_workspace_member(workspace_id));
-- File sources are registered through `api` (signed upload URL + ingestion job); structured
-- and manual sources may be created directly by owner/admin. Status is server-only.
create policy kb_sources_write on public.kb_sources for all to authenticated
  using (private.can_write(workspace_id))
  with check (private.can_write(workspace_id) and type <> 'file');
revoke insert, update on public.kb_sources from authenticated;
grant insert (workspace_id, bot_id, type, title) on public.kb_sources to authenticated;
grant update (bot_id, title) on public.kb_sources to authenticated;

-- Documents: members read. Manual notes may be written by owner/admin (body only); file
-- documents and all ingestion columns are written by `api` / `kb-ingest`.
create policy kb_documents_select on public.kb_documents for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy kb_documents_write_manual on public.kb_documents for all to authenticated
  using (private.can_write(workspace_id) and storage_path is null)
  with check (
    private.can_write(workspace_id) and storage_path is null
    and exists (select 1 from public.kb_sources s
                where s.workspace_id = kb_documents.workspace_id
                  and s.id = kb_documents.source_id and s.type = 'manual')
  );
revoke insert, update on public.kb_documents from authenticated;
grant insert (workspace_id, source_id, title, body) on public.kb_documents to authenticated;
grant update (title, body) on public.kb_documents to authenticated;

create policy faqs_select on public.faqs for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy faqs_write on public.faqs for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

-- Chunks are internal: service role only.
revoke all on public.kb_chunks from anon, authenticated;

create policy catalog_categories_select on public.catalog_categories for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy catalog_categories_write on public.catalog_categories for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

create policy catalog_items_select on public.catalog_items for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy catalog_items_write on public.catalog_items for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));
