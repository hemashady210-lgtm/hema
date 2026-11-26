-- =============================================================================
-- 0006 · Orders & reservations (Growth+). Created by the AI through structured tool calls
-- (decision C3) or by agents. External sync is designed (columns + adapter interface in
-- AI_ENGINE.md §8) but not implemented.
-- P2 (§6 names): customer_id, orders.type / address / notes / delivery_fee_cents,
-- reservations.reserved_at / notes.
-- =============================================================================

create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  branch_id            uuid,
  conversation_id      uuid,
  customer_id          uuid not null,
  -- Human-friendly per-workspace number (assigned by trigger in 0010)
  order_number         integer,
  status               public.order_status not null default 'pending_confirmation',
  source               public.record_source not null,
  type                 text check (type in ('pickup', 'delivery', 'dine_in')),
  address              text,
  notes                text check (char_length(notes) <= 2000),
  currency             char(3) not null,
  -- All amounts are computed server-side from the catalog (P15).
  subtotal_cents       bigint not null default 0 check (subtotal_cents >= 0),
  delivery_fee_cents   bigint not null default 0 check (delivery_fee_cents >= 0),
  total_cents          bigint not null default 0 check (total_cents >= 0),
  confirmed_at         timestamptz,
  canceled_at          timestamptz,
  cancel_reason        text,
  -- External system sync (later): adapter key, remote id, status
  external_system      text,
  external_ref         text,
  external_sync_status public.external_sync_status not null default 'not_applicable',
  external_synced_at   timestamptz,
  created_by_user_id   uuid references auth.users (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, order_number),
  foreign key (workspace_id, customer_id) references public.customers (workspace_id, id) on delete cascade,
  foreign key (workspace_id, conversation_id) references public.conversations (workspace_id, id) on delete set null (conversation_id),
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete set null (branch_id),
  constraint orders_total_matches check (total_cents = subtotal_cents + delivery_fee_cents),
  check (type <> 'delivery' or address is not null)
);
create index orders_workspace_status_idx on public.orders (workspace_id, status, created_at desc);
create index orders_customer_idx on public.orders (customer_id);
create trigger orders_updated_at before update on public.orders
  for each row execute function private.set_updated_at();

-- Line items snapshot name + unit price at order time; prices come from catalog_items
-- server-side, never from model output (proposal P15).
create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null,
  order_id         uuid not null,
  catalog_item_id  uuid,
  name_snapshot    jsonb not null check (private.is_i18n_text(name_snapshot)),
  selected_options jsonb not null default '[]'::jsonb,
  quantity         integer not null check (quantity between 1 and 999),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  line_total_cents bigint not null check (line_total_cents >= 0),
  notes            text,
  foreign key (workspace_id, order_id) references public.orders (workspace_id, id) on delete cascade,
  foreign key (workspace_id, catalog_item_id) references public.catalog_items (workspace_id, id) on delete set null (catalog_item_id)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_workspace_idx on public.order_items (workspace_id);

create table public.reservations (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  branch_id            uuid,
  conversation_id      uuid,
  customer_id          uuid not null,
  status               public.reservation_status not null default 'pending_confirmation',
  source               public.record_source not null,
  party_size           integer not null check (party_size between 1 and 500),
  reserved_at          timestamptz not null,
  ends_at              timestamptz,              -- kept (E0): optional end time / duration
  notes                text check (char_length(notes) <= 2000),
  confirmed_at         timestamptz,
  canceled_at          timestamptz,
  cancel_reason        text,
  external_system      text,
  external_ref         text,
  external_sync_status public.external_sync_status not null default 'not_applicable',
  external_synced_at   timestamptz,
  created_by_user_id   uuid references auth.users (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (workspace_id, customer_id) references public.customers (workspace_id, id) on delete cascade,
  foreign key (workspace_id, conversation_id) references public.conversations (workspace_id, id) on delete set null (conversation_id),
  foreign key (workspace_id, branch_id) references public.branches (workspace_id, id) on delete set null (branch_id),
  check (ends_at is null or ends_at > reserved_at)
);
create index reservations_schedule_idx on public.reservations (workspace_id, reserved_at);
create index reservations_customer_idx on public.reservations (customer_id);
create trigger reservations_updated_at before update on public.reservations
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — read for members; status updates for agents+ (column grants); creation via
-- the AI worker or the `api` function (price computation must be server-side).
-- -----------------------------------------------------------------------------
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.reservations enable row level security;

create policy orders_select on public.orders for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy orders_update on public.orders for update to authenticated
  using (private.can_write(workspace_id, array['owner', 'admin', 'agent']::public.workspace_role[]))
  with check (private.can_write(workspace_id, array['owner', 'admin', 'agent']::public.workspace_role[]));
revoke insert, update, delete on public.orders from authenticated;
grant update (status, cancel_reason) on public.orders to authenticated;

create policy order_items_select on public.order_items for select to authenticated
  using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.order_items from authenticated;

create policy reservations_select on public.reservations for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy reservations_update on public.reservations for update to authenticated
  using (private.can_write(workspace_id, array['owner', 'admin', 'agent']::public.workspace_role[]))
  with check (private.can_write(workspace_id, array['owner', 'admin', 'agent']::public.workspace_role[]));
revoke insert, update, delete on public.reservations from authenticated;
grant update (status, cancel_reason, reserved_at, ends_at, party_size) on public.reservations to authenticated;
