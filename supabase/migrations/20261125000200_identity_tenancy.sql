-- =============================================================================
-- 0002 · Identity & tenancy: profiles, platform admins, workspaces, members, branches
-- Tenant = workspace (decision C1). No organization layer in v1; adding one later is a new
-- `organizations` table + nullable `workspaces.organization_id` (non-breaking).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- Row creation on sign-up (auth trigger) is implemented in P3 with auth.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  avatar_path   text,
  locale        text not null default 'ar' check (locale in ('ar', 'en')),
  theme         text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  numeral_style text not null default 'latin' check (numeral_style in ('latin', 'arabic_indic')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- platform_admins — Super Admin is platform-level and stored separately (decision C2)
-- -----------------------------------------------------------------------------
create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.platform_role not null default 'super_admin',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- workspaces (tenants)
-- -----------------------------------------------------------------------------
create table public.workspaces (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(name) between 1 and 120),
  slug                  text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$'),
  default_locale        text not null default 'ar' check (default_locale in ('ar', 'en')),
  timezone              text not null default 'Asia/Riyadh',
  -- ISO 3166-1 alpha-2 (kept instead of §6 `country`, E0: unambiguous code).
  country_code          char(2),
  -- §6 workspaces.category (restaurant, cafe, retail, clinic, ...). Free text, set in onboarding.
  category              text check (char_length(category) between 1 and 64),
  logo_path             text,
  status                public.workspace_status not null default 'active',
  status_reason         text,
  -- Retention is resolved from the plan entitlement `data_retention_days`; this column is a
  -- per-workspace override set by Super Admin only (null = use plan).
  retention_days_override integer check (retention_days_override > 0),
  deletion_requested_at timestamptz,
  deleted_at            timestamptz,
  created_by            uuid references auth.users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- workspace_members
-- -----------------------------------------------------------------------------
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.workspace_role not null,
  status       public.member_status not null default 'active',
  invited_by   uuid references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);
-- Exactly one owner per workspace.
create unique index workspace_members_one_owner on public.workspace_members (workspace_id)
  where role = 'owner';
create trigger workspace_members_updated_at before update on public.workspace_members
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- workspace_invitations — token stored hashed only
-- -----------------------------------------------------------------------------
create table public.workspace_invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        text not null check (email = lower(email)),
  role         public.workspace_role not null check (role <> 'owner'),
  token_hash   text not null unique,
  invited_by   uuid not null references auth.users (id),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create unique index workspace_invitations_open_unique
  on public.workspace_invitations (workspace_id, email)
  where accepted_at is null and revoked_at is null;

-- -----------------------------------------------------------------------------
-- branches — optional, Enterprise only (gated by entitlement `multi_branch`)
-- -----------------------------------------------------------------------------
create table public.branches (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         jsonb not null check (private.is_i18n_text(name)),
  address      jsonb check (private.is_i18n_text(address)),
  phone        text,
  timezone     text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, id)
);
create index branches_workspace_idx on public.branches (workspace_id);
create trigger branches_updated_at before update on public.branches
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER, empty search_path, STABLE)
-- -----------------------------------------------------------------------------
create or replace function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function private.has_workspace_role(
  p_workspace_id uuid,
  p_roles public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

-- Writes are blocked when the workspace is read-only/suspended (trial ended, unpaid, etc.).
create or replace function private.workspace_is_writable(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.status = 'active' and w.deleted_at is null
  );
$$;

create or replace function private.can_write(
  p_workspace_id uuid,
  p_roles public.workspace_role[] default array['owner', 'admin']::public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_workspace_role(p_workspace_id, p_roles)
     and private.workspace_is_writable(p_workspace_id);
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()));
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- Super Admin access goes through the `api` function's `admin/*` routes (service role +
-- audit log, E7), not through client-side RLS bypass policies (proposal P7).
-- -----------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.platform_admins       enable row level security;
alter table public.workspaces            enable row level security;
alter table public.workspace_members     enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.branches              enable row level security;

-- profiles: see yourself and teammates; edit only yourself.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members mine
      join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
      where mine.user_id = (select auth.uid()) and mine.status = 'active'
        and theirs.user_id = profiles.id
    )
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- platform_admins: a user may only see whether they themselves are an admin.
create policy platform_admins_select_self on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- workspaces: members read; owner/admin update safe columns only (column grants below).
-- Creation happens in the `api` edge function (creates workspace + owner + trial atomically).
create policy workspaces_select on public.workspaces for select to authenticated
  using (private.is_workspace_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (private.can_write(id)) with check (private.can_write(id));
revoke update on public.workspaces from authenticated;
grant update (name, default_locale, timezone, country_code, category, logo_path) on public.workspaces
  to authenticated;
-- Plan and trial dates are NOT copied onto workspaces (§6 lists plan_id / trial_ends_at): they
-- are resolved from the live subscription, the single source of truth (E0, tested suite 02).

-- members: members read; role changes / removal go through the `api` function
-- (enforces owner rules and the `max_users` entitlement).
create policy workspace_members_select on public.workspace_members for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy workspace_invitations_select on public.workspace_invitations for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy branches_select on public.branches for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy branches_write on public.branches for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));
