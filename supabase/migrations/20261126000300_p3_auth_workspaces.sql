-- =============================================================================
-- 0015 · P3 auth, workspaces, members & invitations
--
-- 1. Profiles: auto-created on sign-up (full_name + locale from user metadata, which is
--    display data only and never used for authorization), email copied from auth.users and
--    kept in sync (read-only for clients), column-level update grants.
-- 2. Invitations: email delivery status (real stored state shown in the UI; CLAUDE.md
--    "never fake a status"), invite locale, accepted_by; token_hash not client-readable.
-- 3. Platform settings: max_trial_workspaces_per_user (owner decision #2, P3 plan: 1),
--    invitation_expiry_days (7).
-- 4. Service-role RPCs called by the `api` Edge Function after it verified the caller (P3
--    function routes, docs/API.md §3). Each is atomic, locks what it changes, writes
--    audit_logs and raises `app:<code>` (mapped to HTTP by the API) or `plan_limit:…`.
--    Owner decisions (P3 plan): owner cannot be invited (ownership only by transfer);
--    admins manage admins/agents/viewers but never the owner; nobody changes their own
--    role; on transfer the old owner becomes admin; at invite time active members + open
--    invitations count against `max_users` (the member trigger stays the final check).
-- 5. Rate limiter for Edge Functions (fixed window, Postgres-backed, service role only).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Profiles
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column email text check (email = lower(email)),
  add constraint profiles_full_name_length
    check (full_name is null or char_length(full_name) between 1 and 120);

-- Clients may edit only their own display preferences (RLS limits rows to themselves).
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_path, locale, theme, numeral_style) on public.profiles to authenticated;

create or replace function private.profile_name_from_meta(p_meta jsonb)
returns text
language sql immutable set search_path = ''
as $$
  select left(nullif(btrim(coalesce(p_meta ->> 'full_name', p_meta ->> 'name', '')), ''), 120);
$$;

create or replace function private.profile_locale_from_meta(p_meta jsonb)
returns text
language sql immutable set search_path = ''
as $$
  select case when p_meta ->> 'locale' in ('ar', 'en') then p_meta ->> 'locale' else 'ar' end;
$$;

-- AFTER INSERT on auth.users (Supabase "managing user data" pattern; function lives in the
-- unexposed private schema).
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, locale)
  values (
    new.id,
    lower(new.email),
    private.profile_name_from_meta(coalesce(new.raw_user_meta_data, '{}'::jsonb)),
    private.profile_locale_from_meta(coalesce(new.raw_user_meta_data, '{}'::jsonb))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.sync_profile_email()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.sync_profile_email();

-- Backfill users created before this migration.
insert into public.profiles (id, email, full_name, locale)
select u.id, lower(u.email),
       private.profile_name_from_meta(coalesce(u.raw_user_meta_data, '{}'::jsonb)),
       private.profile_locale_from_meta(coalesce(u.raw_user_meta_data, '{}'::jsonb))
from auth.users u
on conflict (id) do update set email = excluded.email;

-- -----------------------------------------------------------------------------
-- 2. Invitations
-- -----------------------------------------------------------------------------
alter table public.workspace_invitations
  add column locale        text not null default 'ar' check (locale in ('ar', 'en')),
  -- pending: not attempted yet · sent: accepted by Resend · failed: Resend error ·
  -- not_configured: no RESEND_API_KEY, the inviter shares the link manually.
  add column email_status  text not null default 'pending'
    check (email_status in ('pending', 'sent', 'failed', 'not_configured')),
  add column email_sent_at timestamptz,
  add column email_error   text check (char_length(email_error) <= 500),
  add column accepted_by   uuid references auth.users (id) on delete set null,
  add column updated_at    timestamptz not null default now(),
  add constraint workspace_invitations_email_format
    check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
create trigger workspace_invitations_updated_at before update on public.workspace_invitations
  for each row execute function private.set_updated_at();

-- token_hash is never returned to clients (the raw token exists only in the invite link).
revoke select on public.workspace_invitations from authenticated;
grant select (id, workspace_id, email, role, invited_by, expires_at, accepted_at, accepted_by,
              revoked_at, created_at, updated_at, locale, email_status, email_sent_at, email_error)
  on public.workspace_invitations to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Platform settings (data, edited by Super Admin)
-- -----------------------------------------------------------------------------
insert into public.platform_settings (key, value, description) values
  ('max_trial_workspaces_per_user', '1',
   'Workspaces with a free trial a user may create (null = unlimited). Counted from audit_logs, so deleting a workspace does not grant a new trial'),
  ('invitation_expiry_days', '7', 'Days before a workspace invitation link expires')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Helpers for the service-role RPCs
-- -----------------------------------------------------------------------------
create or replace function private.setting_int(p_key text, p_default integer)
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select case when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::integer end
     from public.platform_settings s where s.key = p_key),
    p_default);
$$;

-- Caller's active role in a workspace, or `app:not_found` (no existence leak for non-members),
-- or `app:forbidden` when the role is not allowed.
create or replace function private.require_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_roles public.workspace_role[]
)
returns public.workspace_role
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role public.workspace_role;
begin
  select m.role into v_role
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id and w.deleted_at is null
  where m.workspace_id = p_workspace_id and m.user_id = p_user_id and m.status = 'active';
  if v_role is null then
    raise exception 'app:not_found' using errcode = 'P0001';
  end if;
  if not (v_role = any (p_roles)) then
    raise exception 'app:forbidden' using errcode = 'P0001';
  end if;
  return v_role;
end;
$$;

create or replace function private.require_writable(p_workspace_id uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.workspace_is_writable(p_workspace_id) then
    raise exception 'app:workspace_read_only' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.audit(
  p_workspace_id uuid, p_actor_id uuid, p_action text, p_entity_type text, p_entity_id text,
  p_changes jsonb default '{}'::jsonb
)
returns void
language sql volatile security definer set search_path = ''
as $$
  insert into public.audit_logs (workspace_id, actor_type, actor_id, action, entity_type, entity_id, changes)
  values (p_workspace_id, 'user', p_actor_id, p_action, p_entity_type, p_entity_id, coalesce(p_changes, '{}'::jsonb));
$$;

-- Assignments held by a member are released when they lose agent rights or leave.
create or replace function private.release_assignments(p_workspace_id uuid, p_user_id uuid)
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.conversations set assigned_to = null
  where workspace_id = p_workspace_id and assigned_to = p_user_id;
  update public.handoffs set assigned_to = null
  where workspace_id = p_workspace_id and assigned_to = p_user_id;
$$;

-- Slugs that would read as product URLs. Kept short on purpose.
create or replace function private.slug_is_reserved(p_slug text)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_slug = any (array['admin', 'api', 'app', 'auth', 'billing', 'dashboard', 'help',
                             'invite', 'login', 'new', 'onboarding', 'root', 'settings',
                             'signup', 'support', 'system', 'www']);
$$;

-- -----------------------------------------------------------------------------
-- 4a. Workspaces
-- -----------------------------------------------------------------------------
create or replace function public.is_slug_available(p_slug text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$'
     and not private.slug_is_reserved(p_slug)
     and not exists (select 1 from public.workspaces w where w.slug = p_slug);
$$;

create or replace function public.create_workspace(
  p_user_id        uuid,
  p_name           text,
  p_slug           text,
  p_category       text,
  p_country_code   text,
  p_timezone       text,
  p_default_locale text
)
returns public.workspaces
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_confirmed timestamptz;
  v_plan      public.plans;
  v_max       integer;
  v_used      integer;
  v_ws        public.workspaces;
  v_sub_id    uuid;
  v_trial_end timestamptz;
begin
  select u.email_confirmed_at into v_confirmed from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'app:not_found' using errcode = 'P0001';
  end if;
  if v_confirmed is null then
    raise exception 'app:email_not_verified' using errcode = 'P0001';
  end if;
  if p_timezone is null
     or not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = p_timezone) then
    raise exception 'app:invalid_timezone' using errcode = 'P0001';
  end if;
  if p_country_code is not null and p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'app:invalid_country' using errcode = 'P0001';
  end if;
  if private.slug_is_reserved(lower(p_slug)) then
    raise exception 'app:slug_taken' using errcode = 'P0001';
  end if;

  -- One creation at a time per user, so the trial count below cannot race.
  perform pg_advisory_xact_lock(hashtextextended('workspace_create:' || p_user_id::text, 0));

  select * into v_plan from public.plans p
  where p.is_trial and p.is_active order by p.sort_order limit 1;
  if not found then
    raise exception 'app:trial_unavailable' using errcode = 'P0001';
  end if;

  v_max := private.setting_int('max_trial_workspaces_per_user', null);
  if v_max is not null then
    select count(*) into v_used from public.audit_logs a
    where a.actor_id = p_user_id and a.action = 'workspace.created'
      and coalesce((a.changes ->> 'trial')::boolean, false);
    if v_used >= v_max then
      raise exception 'app:trial_limit_reached' using errcode = 'P0001';
    end if;
  end if;

  begin
    insert into public.workspaces (name, slug, category, country_code, timezone, default_locale, created_by)
    values (btrim(p_name), lower(p_slug), nullif(btrim(p_category), ''), p_country_code, p_timezone,
            p_default_locale, p_user_id)
    returning * into v_ws;
  exception when unique_violation then
    raise exception 'app:slug_taken' using errcode = 'P0001';
  end;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (v_ws.id, p_user_id, 'owner', 'active');

  v_trial_end := now() + make_interval(days => v_plan.trial_days);
  insert into public.subscriptions (workspace_id, plan_id, status, provider, current_period_start,
                                    current_period_end, trial_ends_at)
  values (v_ws.id, v_plan.id, 'trialing', 'manual', now(), v_trial_end, v_trial_end)
  returning id into v_sub_id;

  insert into public.billing_events (workspace_id, subscription_id, event_type, to_status, source,
                                     actor_type, actor_id, data)
  values (v_ws.id, v_sub_id, 'subscription.trial_started', 'trialing', 'user', 'user', p_user_id,
          jsonb_build_object('plan_id', v_plan.id, 'trial_ends_at', v_trial_end));

  insert into public.workspace_onboarding (workspace_id, updated_by) values (v_ws.id, p_user_id);

  perform private.audit(v_ws.id, p_user_id, 'workspace.created', 'workspace', v_ws.id::text,
    jsonb_build_object('trial', true, 'plan_id', v_plan.id, 'slug', v_ws.slug));
  return v_ws;
end;
$$;

create or replace function public.transfer_ownership(
  p_actor_id uuid, p_workspace_id uuid, p_new_owner_id uuid
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_target public.workspace_members;
begin
  perform private.require_member_role(p_workspace_id, p_actor_id, array['owner']::public.workspace_role[]);
  if p_new_owner_id = p_actor_id then
    raise exception 'app:invalid_target' using errcode = 'P0001';
  end if;
  select * into v_target from public.workspace_members m
  where m.workspace_id = p_workspace_id and m.user_id = p_new_owner_id and m.status = 'active'
  for update;
  if not found then
    raise exception 'app:member_not_found' using errcode = 'P0001';
  end if;
  -- Demote first: the one-owner unique index is checked per statement.
  update public.workspace_members set role = 'admin'
  where workspace_id = p_workspace_id and user_id = p_actor_id;
  update public.workspace_members set role = 'owner'
  where workspace_id = p_workspace_id and user_id = p_new_owner_id;
  perform private.audit(p_workspace_id, p_actor_id, 'workspace.ownership_transferred', 'workspace',
    p_workspace_id::text,
    jsonb_build_object('from', p_actor_id, 'to', p_new_owner_id, 'previous_role', v_target.role));
end;
$$;

-- -----------------------------------------------------------------------------
-- 4b. Invitations
-- -----------------------------------------------------------------------------
create or replace function private.assert_invite_capacity(p_workspace_id uuid, p_exclude_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_active integer;
  v_open   integer;
begin
  perform private.lock_limit(p_workspace_id, 'max_users');
  select count(*) into v_active from public.workspace_members m
  where m.workspace_id = p_workspace_id and m.status = 'active';
  select count(*) into v_open from public.workspace_invitations i
  where i.workspace_id = p_workspace_id and i.accepted_at is null and i.revoked_at is null
    and i.expires_at > now() and i.id is distinct from p_exclude_id;
  perform private.assert_limit(p_workspace_id, 'max_users', v_active + v_open);
end;
$$;

create or replace function public.create_invitation(
  p_actor_id     uuid,
  p_workspace_id uuid,
  p_email        text,
  p_role         public.workspace_role,
  p_token_hash   text,
  p_locale       text default 'ar'
)
returns public.workspace_invitations
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_email    text := lower(btrim(p_email));
  v_existing public.workspace_invitations;
  v_inv      public.workspace_invitations;
begin
  perform private.require_member_role(p_workspace_id, p_actor_id,
    array['owner', 'admin']::public.workspace_role[]);
  perform private.require_writable(p_workspace_id);
  if p_role is null or p_role = 'owner' then
    raise exception 'app:invalid_role' using errcode = 'P0001';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'app:invalid_token' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id and m.status = 'active' and lower(u.email) = v_email
  ) then
    raise exception 'app:already_member' using errcode = 'P0001';
  end if;

  -- Re-inviting the same email reissues the open invitation (new token, role, expiry).
  select * into v_existing from public.workspace_invitations i
  where i.workspace_id = p_workspace_id and i.email = v_email
    and i.accepted_at is null and i.revoked_at is null
  for update;
  perform private.assert_invite_capacity(p_workspace_id, v_existing.id);

  if v_existing.id is not null then
    update public.workspace_invitations
    set role = p_role, token_hash = p_token_hash, invited_by = p_actor_id,
        expires_at = now() + make_interval(days => private.setting_int('invitation_expiry_days', 7)),
        locale = coalesce(p_locale, 'ar'), email_status = 'pending', email_error = null,
        email_sent_at = null
    where id = v_existing.id
    returning * into v_inv;
  else
    insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by,
                                              expires_at, locale)
    values (p_workspace_id, v_email, p_role, p_token_hash, p_actor_id,
            now() + make_interval(days => private.setting_int('invitation_expiry_days', 7)),
            coalesce(p_locale, 'ar'))
    returning * into v_inv;
  end if;

  perform private.audit(p_workspace_id, p_actor_id, 'invitation.created', 'workspace_invitation',
    v_inv.id::text,
    jsonb_build_object('email', v_email, 'role', p_role, 'reissued', v_existing.id is not null));
  return v_inv;
end;
$$;

-- New link for an open invitation (the old token stops working).
create or replace function public.renew_invitation(
  p_actor_id uuid, p_invitation_id uuid, p_token_hash text
)
returns public.workspace_invitations
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_inv public.workspace_invitations;
begin
  select * into v_inv from public.workspace_invitations i where i.id = p_invitation_id for update;
  if not found then
    raise exception 'app:not_found' using errcode = 'P0001';
  end if;
  perform private.require_member_role(v_inv.workspace_id, p_actor_id,
    array['owner', 'admin']::public.workspace_role[]);
  perform private.require_writable(v_inv.workspace_id);
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null then
    raise exception 'app:invitation_closed' using errcode = 'P0001';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'app:invalid_token' using errcode = 'P0001';
  end if;
  perform private.assert_invite_capacity(v_inv.workspace_id, v_inv.id);
  update public.workspace_invitations
  set token_hash = p_token_hash, invited_by = p_actor_id,
      expires_at = now() + make_interval(days => private.setting_int('invitation_expiry_days', 7)),
      email_status = 'pending', email_error = null, email_sent_at = null
  where id = v_inv.id
  returning * into v_inv;
  perform private.audit(v_inv.workspace_id, p_actor_id, 'invitation.renewed', 'workspace_invitation',
    v_inv.id::text, jsonb_build_object('email', v_inv.email));
  return v_inv;
end;
$$;

create or replace function public.revoke_invitation(p_actor_id uuid, p_invitation_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_inv public.workspace_invitations;
begin
  select * into v_inv from public.workspace_invitations i where i.id = p_invitation_id for update;
  if not found then
    raise exception 'app:not_found' using errcode = 'P0001';
  end if;
  perform private.require_member_role(v_inv.workspace_id, p_actor_id,
    array['owner', 'admin']::public.workspace_role[]);
  if v_inv.accepted_at is not null then
    raise exception 'app:invitation_closed' using errcode = 'P0001';
  end if;
  if v_inv.revoked_at is null then
    update public.workspace_invitations set revoked_at = now() where id = v_inv.id;
    perform private.audit(v_inv.workspace_id, p_actor_id, 'invitation.revoked',
      'workspace_invitation', v_inv.id::text, jsonb_build_object('email', v_inv.email));
  end if;
end;
$$;

-- Records what actually happened when the API tried to email the invitation.
create or replace function public.set_invitation_email_status(
  p_invitation_id uuid, p_status text, p_error text default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update public.workspace_invitations
  set email_status  = p_status,
      email_error   = left(p_error, 500),
      email_sent_at = case when p_status = 'sent' then now() else email_sent_at end
  where id = p_invitation_id;
  if not found then
    raise exception 'app:not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- What the accept page shows before the visitor signs in. Zero rows = unknown token.
create or replace function public.get_invitation_preview(p_token_hash text)
returns table (
  invitation_id  uuid,
  workspace_name text,
  role           public.workspace_role,
  email          text,
  inviter_name   text,
  expires_at     timestamptz,
  state          text
)
language sql stable security definer set search_path = ''
as $$
  select i.id, w.name, i.role, i.email, p.full_name, i.expires_at,
         case when i.accepted_at is not null then 'accepted'
              when i.revoked_at is not null then 'revoked'
              when i.expires_at <= now() then 'expired'
              else 'valid' end
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id and w.deleted_at is null
  left join public.profiles p on p.id = i.invited_by
  where i.token_hash = p_token_hash;
$$;

create or replace function public.accept_invitation(p_user_id uuid, p_token_hash text)
returns table (workspace_id uuid, workspace_slug text, member_role public.workspace_role)
language plpgsql volatile security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_inv       public.workspace_invitations;
  v_email     text;
  v_confirmed timestamptz;
  v_ws        public.workspaces;
  v_member    public.workspace_members;
  v_role      public.workspace_role;
begin
  select * into v_inv from public.workspace_invitations i where i.token_hash = p_token_hash for update;
  if not found then
    raise exception 'app:invitation_not_found' using errcode = 'P0001';
  end if;
  select * into v_ws from public.workspaces w where w.id = v_inv.workspace_id and w.deleted_at is null;
  if not found then
    raise exception 'app:invitation_not_found' using errcode = 'P0001';
  end if;

  if v_inv.accepted_at is not null then
    if v_inv.accepted_by = p_user_id then
      -- Idempotent replay (double click, retry).
      select m.role into v_role from public.workspace_members m
      where m.workspace_id = v_ws.id and m.user_id = p_user_id and m.status = 'active';
      if v_role is not null then
        return query select v_ws.id, v_ws.slug, v_role;
        return;
      end if;
    end if;
    raise exception 'app:invitation_used' using errcode = 'P0001';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'app:invitation_revoked' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'app:invitation_expired' using errcode = 'P0001';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'app:not_found' using errcode = 'P0001';
  end if;
  if v_confirmed is null then
    raise exception 'app:email_not_verified' using errcode = 'P0001';
  end if;
  if v_email is distinct from v_inv.email then
    raise exception 'app:invitation_email_mismatch' using errcode = 'P0001';
  end if;

  select * into v_member from public.workspace_members m
  where m.workspace_id = v_ws.id and m.user_id = p_user_id
  for update;
  if found and v_member.status = 'active' then
    v_role := v_member.role;                          -- already a member: keep the current role
  elsif found then
    update public.workspace_members set status = 'active', role = v_inv.role, invited_by = v_inv.invited_by
    where workspace_id = v_ws.id and user_id = p_user_id;   -- member limit trigger applies
    v_role := v_inv.role;
  else
    insert into public.workspace_members (workspace_id, user_id, role, status, invited_by)
    values (v_ws.id, p_user_id, v_inv.role, 'active', v_inv.invited_by);   -- member limit trigger
    v_role := v_inv.role;
  end if;

  update public.workspace_invitations set accepted_at = now(), accepted_by = p_user_id
  where id = v_inv.id;
  perform private.audit(v_ws.id, p_user_id, 'invitation.accepted', 'workspace_invitation',
    v_inv.id::text, jsonb_build_object('role', v_role));
  return query select v_ws.id, v_ws.slug, v_role;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4c. Members
-- -----------------------------------------------------------------------------
create or replace function public.change_member_role(
  p_actor_id uuid, p_workspace_id uuid, p_user_id uuid, p_role public.workspace_role
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_target public.workspace_members;
begin
  perform private.require_member_role(p_workspace_id, p_actor_id,
    array['owner', 'admin']::public.workspace_role[]);
  perform private.require_writable(p_workspace_id);
  if p_user_id = p_actor_id then
    raise exception 'app:cannot_change_own_role' using errcode = 'P0001';
  end if;
  if p_role is null or p_role = 'owner' then
    raise exception 'app:invalid_role' using errcode = 'P0001';
  end if;
  select * into v_target from public.workspace_members m
  where m.workspace_id = p_workspace_id and m.user_id = p_user_id and m.status = 'active'
  for update;
  if not found then
    raise exception 'app:member_not_found' using errcode = 'P0001';
  end if;
  if v_target.role = 'owner' then
    raise exception 'app:cannot_change_owner' using errcode = 'P0001';
  end if;
  if v_target.role = p_role then
    return;
  end if;
  update public.workspace_members set role = p_role
  where workspace_id = p_workspace_id and user_id = p_user_id;
  if p_role = 'viewer' then
    perform private.release_assignments(p_workspace_id, p_user_id);
  end if;
  perform private.audit(p_workspace_id, p_actor_id, 'member.role_changed', 'workspace_member',
    p_user_id::text, jsonb_build_object('from', v_target.role, 'to', p_role));
end;
$$;

-- Removes a member, or lets a member leave (p_user_id = p_actor_id). Allowed on read-only
-- workspaces too: it only reduces access.
create or replace function public.remove_member(
  p_actor_id uuid, p_workspace_id uuid, p_user_id uuid
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_actor_role public.workspace_role;
  v_target     public.workspace_members;
begin
  if p_user_id = p_actor_id then
    v_actor_role := private.require_member_role(p_workspace_id, p_actor_id,
      array['owner', 'admin', 'agent', 'viewer']::public.workspace_role[]);
    if v_actor_role = 'owner' then
      raise exception 'app:owner_cannot_leave' using errcode = 'P0001';
    end if;
  else
    perform private.require_member_role(p_workspace_id, p_actor_id,
      array['owner', 'admin']::public.workspace_role[]);
  end if;
  select * into v_target from public.workspace_members m
  where m.workspace_id = p_workspace_id and m.user_id = p_user_id
  for update;
  if not found then
    raise exception 'app:member_not_found' using errcode = 'P0001';
  end if;
  if v_target.role = 'owner' then
    raise exception 'app:cannot_remove_owner' using errcode = 'P0001';
  end if;
  perform private.release_assignments(p_workspace_id, p_user_id);
  delete from public.workspace_members where workspace_id = p_workspace_id and user_id = p_user_id;
  perform private.audit(p_workspace_id, p_actor_id,
    case when p_user_id = p_actor_id then 'member.left' else 'member.removed' end,
    'workspace_member', p_user_id::text, jsonb_build_object('role', v_target.role));
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Rate limiter (fixed window). Private table: never exposed through PostgREST.
-- -----------------------------------------------------------------------------
create table private.rate_limit_hits (
  bucket       text not null check (char_length(bucket) between 1 and 200),
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);
alter table private.rate_limit_hits enable row level security;
revoke all on private.rate_limit_hits from public, anon, authenticated;

create or replace function public.hit_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits   integer;
begin
  if p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'app:invalid_rate_limit' using errcode = 'P0001';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.rate_limit_hits as r (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  delete from private.rate_limit_hits h where h.bucket = p_bucket and h.window_start < v_window;
  -- Occasional sweep of other stale buckets (the scheduler takes this over in P7).
  if random() < 0.01 then
    delete from private.rate_limit_hits h where h.window_start < now() - interval '1 day';
  end if;
  return query select
    v_hits <= p_limit,
    greatest(p_limit - v_hits, 0),
    case when v_hits <= p_limit then 0
         else greatest(1, ceil(extract(epoch from
           (v_window + make_interval(secs => p_window_seconds) - now())))::integer) end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: every new function is service-role only (called by Edge Functions).
-- -----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'private.profile_name_from_meta(jsonb)',
    'private.profile_locale_from_meta(jsonb)',
    'private.handle_new_user()',
    'private.sync_profile_email()',
    'private.setting_int(text, integer)',
    'private.require_member_role(uuid, uuid, public.workspace_role[])',
    'private.require_writable(uuid)',
    'private.audit(uuid, uuid, text, text, text, jsonb)',
    'private.release_assignments(uuid, uuid)',
    'private.slug_is_reserved(text)',
    'private.assert_invite_capacity(uuid, uuid)',
    'public.is_slug_available(text)',
    'public.create_workspace(uuid, text, text, text, text, text, text)',
    'public.transfer_ownership(uuid, uuid, uuid)',
    'public.create_invitation(uuid, uuid, text, public.workspace_role, text, text)',
    'public.renew_invitation(uuid, uuid, text)',
    'public.revoke_invitation(uuid, uuid)',
    'public.set_invitation_email_status(uuid, text, text)',
    'public.get_invitation_preview(text)',
    'public.accept_invitation(uuid, text)',
    'public.change_member_role(uuid, uuid, uuid, public.workspace_role)',
    'public.remove_member(uuid, uuid, uuid)',
    'public.hit_rate_limit(text, integer, integer)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
