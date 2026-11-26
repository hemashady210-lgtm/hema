-- =============================================================================
-- 0016 · P3 review fixes (code-reviewer + security-reviewer, 2026-11-26)
-- Forward migration: 0015 is applied to the dev project and frozen.
--   1. Security H1 (pre-registration account takeover): Supabase Auth keeps the password of
--      an UNCONFIRMED account when someone else later signs up with the same email and
--      confirms it. Any password set before email ownership was proven is now cleared at the
--      moment the email is confirmed; the dashboard asks for a password after confirmation.
--   2. accept_invitation: requires a writable workspace (no new access after the trial ends)
--      and an inviter who is still an active owner/admin (security M1).
--   3. Open invitations sent by a member are revoked when that member is removed or demoted
--      below admin (security M1, keeps the pending list truthful).
--   4. release_assignments only touches open work: open conversations; requested/assigned
--      handoffs go back to `requested` (code review: no stranded handoffs, history kept).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Clear pre-confirmation passwords (auth.users, BEFORE UPDATE)
-- -----------------------------------------------------------------------------
create or replace function private.clear_unverified_password()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- A password chosen before the email was proven may belong to someone else (an attacker
  -- who pre-registered the address). Users choose their password after confirming.
  -- Accounts confirmed while being created (admin `email_confirm`, same request) keep their
  -- password: nobody else can have set it, and nobody can click an emailed link that fast.
  if coalesce(new.encrypted_password, '') <> ''
     and new.email_confirmed_at - coalesce(old.created_at, new.email_confirmed_at) > interval '5 seconds' then
    new.encrypted_password := '';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed before update on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.clear_unverified_password();

-- -----------------------------------------------------------------------------
-- 2–4. Helpers and redefined RPCs
-- -----------------------------------------------------------------------------
create or replace function private.release_assignments(p_workspace_id uuid, p_user_id uuid)
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.conversations set assigned_to = null
  where workspace_id = p_workspace_id and assigned_to = p_user_id and status <> 'closed';
  update public.handoffs set assigned_to = null, status = 'requested'
  where workspace_id = p_workspace_id and assigned_to = p_user_id
    and status in ('requested', 'assigned');
$$;

create or replace function private.revoke_invitations_by(
  p_workspace_id uuid, p_inviter_id uuid, p_actor_id uuid
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.workspace_invitations
  set revoked_at = now()
  where workspace_id = p_workspace_id and invited_by = p_inviter_id
    and accepted_at is null and revoked_at is null;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    perform private.audit(p_workspace_id, p_actor_id, 'invitation.revoked_with_inviter', 'workspace_member',
      p_inviter_id::text, jsonb_build_object('count', v_count));
  end if;
end;
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
  -- Review fix: no new access on a read-only workspace (trial ended / suspended).
  perform private.require_writable(v_ws.id);
  -- Review fix (security M1): an invitation dies with its inviter's rights.
  if not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = v_ws.id and m.user_id = v_inv.invited_by and m.status = 'active'
      and m.role in ('owner', 'admin')
  ) then
    raise exception 'app:invitation_revoked' using errcode = 'P0001';
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
  if p_role in ('agent', 'viewer') then
    perform private.revoke_invitations_by(p_workspace_id, p_user_id, p_actor_id);
  end if;
  perform private.audit(p_workspace_id, p_actor_id, 'member.role_changed', 'workspace_member',
    p_user_id::text, jsonb_build_object('from', v_target.role, 'to', p_role));
end;
$$;

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
  perform private.revoke_invitations_by(p_workspace_id, p_user_id, p_actor_id);
  delete from public.workspace_members where workspace_id = p_workspace_id and user_id = p_user_id;
  perform private.audit(p_workspace_id, p_actor_id,
    case when p_user_id = p_actor_id then 'member.left' else 'member.removed' end,
    'workspace_member', p_user_id::text, jsonb_build_object('role', v_target.role));
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'private.clear_unverified_password()',
    'private.release_assignments(uuid, uuid)',
    'private.revoke_invitations_by(uuid, uuid, uuid)',
    'public.accept_invitation(uuid, text)',
    'public.change_member_role(uuid, uuid, uuid, public.workspace_role)',
    'public.remove_member(uuid, uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
