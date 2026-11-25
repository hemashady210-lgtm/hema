-- =============================================================================
-- 0004 · Contacts, conversations, messages, attachments, handoffs
-- Inbound messages are free (analytics only); billing counts AI replies (see 0008/0010).
-- =============================================================================

create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  display_name  text,
  phone         text,
  email         text,
  locale        text check (locale in ('ar', 'en')),
  -- Free-form CRM attributes, e.g. {"city":"Riyadh","vip":true}
  attributes    jsonb not null default '{}'::jsonb,
  tags          text[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, id)
);
create index contacts_workspace_last_seen_idx on public.contacts (workspace_id, last_seen_at desc);
create index contacts_phone_idx on public.contacts (workspace_id, phone) where phone is not null;
create trigger contacts_updated_at before update on public.contacts
  for each row execute function private.set_updated_at();

-- One contact can be reachable on several channels.
create table public.contact_identities (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  contact_id    uuid not null,
  channel_type  public.channel_type not null,
  -- WhatsApp: wa_id · Messenger: PSID · Instagram: IGSID · Widget: visitor id
  -- (identifier semantics per Meta platform = needs verification)
  external_id   text not null,
  created_at    timestamptz not null default now(),
  foreign key (workspace_id, contact_id) references public.contacts (workspace_id, id) on delete cascade,
  unique (workspace_id, channel_type, external_id)
);
create index contact_identities_contact_idx on public.contact_identities (contact_id);

create table public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  bot_id                uuid not null,
  branch_id             uuid,
  channel_connection_id uuid not null,
  contact_id            uuid not null,
  status                public.conversation_status not null default 'open',
  assigned_to           uuid references auth.users (id),
  ai_paused             boolean not null default false,  -- true while a human handles it
  language              text,                            -- last detected: 'ar' | 'en' | other ISO code
  dialect               text,                            -- e.g. 'msa' | 'gulf' | 'egyptian' (best effort)
  summary               text,                            -- rolling summary for long threads (AI_ENGINE §6)
  summary_message_id    uuid,                            -- last message folded into summary
  -- WhatsApp customer-service window end (24 h after last inbound) — rule = needs verification
  service_window_ends_at timestamptz,
  -- Widget conversations: unguessable topic id used for content-free Realtime pings (P6)
  realtime_topic        text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  last_message_at       timestamptz,
  last_inbound_at       timestamptz,
  closed_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, bot_id) references public.bots (workspace_id, id) on delete cascade,
  foreign key (workspace_id, channel_connection_id)
    references public.channel_connections (workspace_id, id) on delete cascade,
  foreign key (workspace_id, contact_id) references public.contacts (workspace_id, id) on delete cascade,
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete set null (branch_id)
);
create index conversations_inbox_idx on public.conversations (workspace_id, status, last_message_at desc);
create index conversations_contact_idx on public.conversations (contact_id);
create index conversations_assigned_idx on public.conversations (assigned_to) where assigned_to is not null;
create trigger conversations_updated_at before update on public.conversations
  for each row execute function private.set_updated_at();

-- Messages. High-volume table: partitioning by month is planned before scale (RISK R-09);
-- not done in v1 to keep FKs simple.
create table public.messages (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null,
  conversation_id       uuid not null,
  channel_connection_id uuid not null,   -- denormalized for webhook idempotency + analytics
  direction             public.message_direction not null,
  sender_type           public.sender_type not null,
  sender_user_id        uuid references auth.users (id),
  content_type          public.message_content_type not null default 'text',
  body                  text check (char_length(body) <= 8000),
  -- Raw/structured provider payload (buttons, template params, location...). No secrets.
  payload               jsonb not null default '{}'::jsonb,
  language              text,
  external_message_id   text,            -- provider message id (wamid, mid, ...)
  delivery_status       public.delivery_status not null,
  delivery_error        text,
  ai_run_id             uuid,            -- FK added in 0007
  -- Idempotency key from the sender (widget client id / API Idempotency-Key)
  client_message_id     text,
  created_at            timestamptz not null default now(),
  foreign key (workspace_id, conversation_id)
    references public.conversations (workspace_id, id) on delete cascade,
  check (sender_type <> 'agent' or sender_user_id is not null),
  check ((direction = 'inbound') = (sender_type = 'contact'))
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_workspace_created_idx on public.messages (workspace_id, created_at);
-- Webhook de-duplication (Meta may redeliver).
create unique index messages_external_unique on public.messages (channel_connection_id, external_message_id)
  where external_message_id is not null;
create unique index messages_client_unique on public.messages (conversation_id, client_message_id)
  where client_message_id is not null;

create table public.message_attachments (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  message_id    uuid not null references public.messages (id) on delete cascade,
  storage_path  text not null,        -- bucket `attachments`, path `<workspace_id>/...`
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes >= 0),
  file_name     text,
  created_at    timestamptz not null default now()
);
create index message_attachments_message_idx on public.message_attachments (message_id);

-- Human handoff (Growth+, entitlement `human_handoff`)
create table public.handoffs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  conversation_id uuid not null,
  requested_by    public.sender_type not null,     -- ai | contact | agent
  reason          text,
  status          public.handoff_status not null default 'requested',
  assigned_to     uuid references auth.users (id),
  resolved_by     uuid references auth.users (id),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (workspace_id, conversation_id)
    references public.conversations (workspace_id, id) on delete cascade
);
create index handoffs_open_idx on public.handoffs (workspace_id, status) where status in ('requested', 'assigned');
create trigger handoffs_updated_at before update on public.handoffs
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.contacts            enable row level security;
alter table public.contact_identities  enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.message_attachments enable row level security;
alter table public.handoffs            enable row level security;

create policy contacts_select on public.contacts for select to authenticated
  using (private.is_workspace_member(workspace_id));
-- Agents may edit CRM fields (name, tags, attributes).
create policy contacts_update on public.contacts for update to authenticated
  using (private.can_write(workspace_id, array['owner', 'admin', 'agent']::public.workspace_role[]))
  with check (private.can_write(workspace_id, array['owner', 'admin', 'agent']::public.workspace_role[]));
revoke update on public.contacts from authenticated;
grant update (display_name, email, phone, attributes, tags) on public.contacts to authenticated;

create policy contact_identities_select on public.contact_identities for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy conversations_select on public.conversations for select to authenticated
  using (private.is_workspace_member(workspace_id));
-- Assignment / close / pause AI. Status transitions with side effects go through `api`.
create policy conversations_update on public.conversations for update to authenticated
  using (private.can_write(workspace_id, array['owner', 'admin', 'agent']::public.workspace_role[]))
  with check (private.can_write(workspace_id, array['owner', 'admin', 'agent']::public.workspace_role[]));
revoke update on public.conversations from authenticated;
grant update (assigned_to, ai_paused) on public.conversations to authenticated;

-- Messages are written only by edge functions (delivery must happen with the insert).
create policy messages_select on public.messages for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy message_attachments_select on public.message_attachments for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy handoffs_select on public.handoffs for select to authenticated
  using (private.is_workspace_member(workspace_id));
