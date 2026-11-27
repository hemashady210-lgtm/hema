-- pgTAP: P3 auth + workspaces + members & invitations (migration 0015). Rolls back.
-- Covers the profile trigger, column grants, create_workspace (trial, limits, slugs),
-- invitations (capacity, reissue, preview, accept rules), member role / removal / leave,
-- ownership transfer, read-only workspaces, the rate limiter and function privileges.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(88);

create function pg_temp.tok(p text) returns text language sql as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;

-- ---------------------------------------------------------------------------
-- 1. Profile trigger
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000009a1', 'Owner9@Test.Local', now(), '{"full_name":"  Sara Owner  ","locale":"en"}'),
  ('00000000-0000-0000-0000-0000000009a2', 'admin9@test.local', now(), '{"name":"Google Name","locale":"fr"}'),
  ('00000000-0000-0000-0000-0000000009a3', 'agent9@test.local', now(), '{}'),
  ('00000000-0000-0000-0000-0000000009a4', 'viewer9@test.local', now(), null),
  ('00000000-0000-0000-0000-0000000009a5', 'unverified9@test.local', null, '{}'),
  ('00000000-0000-0000-0000-0000000009a6', 'other9@test.local', now(), '{}');

select results_eq(
  $$ select email, full_name, locale from public.profiles where id = '00000000-0000-0000-0000-0000000009a1' $$,
  $$ values ('owner9@test.local'::text, 'Sara Owner'::text, 'en'::text) $$,
  'profile created on sign-up: lowercased email, trimmed full_name, locale from metadata');
select results_eq(
  $$ select full_name, locale from public.profiles where id = '00000000-0000-0000-0000-0000000009a2' $$,
  $$ values ('Google Name'::text, 'ar'::text) $$,
  'OAuth "name" is used; unsupported locale falls back to ar');
select results_eq(
  $$ select full_name, locale from public.profiles where id = '00000000-0000-0000-0000-0000000009a4' $$,
  $$ values (null::text, 'ar'::text) $$,
  'null metadata gives an empty profile');
update auth.users set email = 'Viewer9b@test.local' where id = '00000000-0000-0000-0000-0000000009a4';
select is((select email from public.profiles where id = '00000000-0000-0000-0000-0000000009a4'),
  'viewer9b@test.local', 'email change is copied to the profile');
update auth.users set email = 'viewer9@test.local' where id = '00000000-0000-0000-0000-0000000009a4';

-- ---------------------------------------------------------------------------
-- 2. Function privileges: every P3 RPC is service-role only
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select f from unnest(array[
       'public.is_slug_available(text)',
       'public.create_workspace(uuid,text,text,text,text,text,text)',
       'public.transfer_ownership(uuid,uuid,uuid)',
       'public.create_invitation(uuid,uuid,text,workspace_role,text,text)',
       'public.renew_invitation(uuid,uuid,text)',
       'public.revoke_invitation(uuid,uuid)',
       'public.set_invitation_email_status(uuid,text,text)',
       'public.get_invitation_preview(text)',
       'public.accept_invitation(uuid,text)',
       'public.change_member_role(uuid,uuid,uuid,workspace_role)',
       'public.remove_member(uuid,uuid,uuid)',
       'public.hit_rate_limit(text,integer,integer)']) f
     where has_function_privilege('authenticated', f, 'execute')
        or has_function_privilege('anon', f, 'execute')
        or not has_function_privilege('service_role', f, 'execute') $$,
  'P3 RPCs: service_role only (not anon, not authenticated)');
select ok(not has_table_privilege('authenticated', 'private.rate_limit_hits', 'select')
          and not has_table_privilege('anon', 'private.rate_limit_hits', 'select'),
  'rate limit table is not client-readable');
select ok(not has_column_privilege('authenticated', 'public.workspace_invitations', 'token_hash', 'select'),
  'invitation token_hash is not client-readable');
select ok(has_column_privilege('authenticated', 'public.workspace_invitations', 'email_status', 'select'),
  'invitation email_status is client-readable');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'email', 'update'),
  'profiles.email is not client-writable');

-- ---------------------------------------------------------------------------
-- 3. create_workspace
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.create_workspace('00000000-0000-0000-0000-0000000009a5', 'U', 'ws9-unverified', null, null, 'Asia/Riyadh', 'ar') $$,
  'P0001', 'app:email_not_verified', 'unverified email cannot create a workspace');
select throws_ok(
  $$ select public.create_workspace('00000000-0000-0000-0000-0000000009a1', 'X', 'ws9-x', null, null, 'Mars/Base', 'ar') $$,
  'P0001', 'app:invalid_timezone', 'unknown time zone rejected');
select throws_ok(
  $$ select public.create_workspace('00000000-0000-0000-0000-0000000009a1', 'X', 'ws9-x', null, 'sa', 'Asia/Riyadh', 'ar') $$,
  'P0001', 'app:invalid_country', 'country must be ISO alpha-2 upper case');
select throws_ok(
  $$ select public.create_workspace('00000000-0000-0000-0000-0000000009a1', 'X', 'admin', null, null, 'Asia/Riyadh', 'ar') $$,
  'P0001', 'app:slug_taken', 'reserved slug rejected');

create temp table ws9 as
  select * from public.create_workspace('00000000-0000-0000-0000-0000000009a1', '  Diwan Cafe ', 'Ws9-Diwan', 'cafe', 'SA',
                                        'Asia/Riyadh', 'en');
select results_eq(
  $$ select name, slug, category, country_code::text, timezone, default_locale, status::text from ws9 $$,
  $$ values ('Diwan Cafe'::text, 'ws9-diwan'::text, 'cafe'::text, 'SA'::text, 'Asia/Riyadh'::text, 'en'::text, 'active'::text) $$,
  'workspace created with trimmed name and lowercased slug');
select results_eq(
  $$ select user_id, role::text, status::text from public.workspace_members where workspace_id = (select id from ws9) $$,
  $$ values ('00000000-0000-0000-0000-0000000009a1'::uuid, 'owner'::text, 'active'::text) $$,
  'creator is the only (owner) member');
select ok(
  (select s.status = 'trialing' and p.is_trial and s.trial_ends_at between now() + interval '7 days' - interval '1 minute'
                                                          and now() + interval '7 days' + interval '1 minute'
   from public.subscriptions s join public.plans p on p.id = s.plan_id where s.workspace_id = (select id from ws9)),
  '7-day trial subscription started');
select is((select count(*)::int from public.billing_events where workspace_id = (select id from ws9)
           and event_type = 'subscription.trial_started'), 1, 'trial start recorded in billing_events');
select is((select current_step from public.workspace_onboarding where workspace_id = (select id from ws9)),
  'business_basics', 'onboarding row created');
select is((select count(*)::int from public.audit_logs where workspace_id = (select id from ws9) and action = 'workspace.created'),
  1, 'workspace creation audited');
select is(private.entitlement_int((select id from ws9), 'max_users'), 1,
  'trial entitlements resolve for the new workspace');

select throws_ok(
  $$ select public.create_workspace('00000000-0000-0000-0000-0000000009a1', 'Second', 'ws9-second', null, null, 'Asia/Riyadh', 'ar') $$,
  'P0001', 'app:trial_limit_reached', 'second trial workspace blocked (max_trial_workspaces_per_user = 1)');
update public.platform_settings set value = 'null' where key = 'max_trial_workspaces_per_user';
select throws_ok(
  $$ select public.create_workspace('00000000-0000-0000-0000-0000000009a6', 'Dup', 'ws9-diwan', null, null, 'Asia/Riyadh', 'ar') $$,
  'P0001', 'app:slug_taken', 'duplicate slug → app:slug_taken');
select lives_ok(
  $$ select public.create_workspace('00000000-0000-0000-0000-0000000009a1', 'Second', 'ws9-second', null, null, 'Asia/Riyadh', 'ar') $$,
  'null setting = unlimited trials');
update public.platform_settings set value = '1' where key = 'max_trial_workspaces_per_user';
select ok(not public.is_slug_available('ws9-diwan') and not public.is_slug_available('support')
          and not public.is_slug_available('-bad') and public.is_slug_available('ws9-free'),
  'is_slug_available: taken, reserved and malformed slugs are unavailable');

-- Workspace W (ws9) gets a Growth-size member limit for the member tests.
insert into public.workspace_entitlement_overrides (workspace_id, key, value, reason)
  values ((select id from ws9), 'max_users', '4', 'pgTAP');

-- ---------------------------------------------------------------------------
-- 4. Invitations
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$ select public.create_invitation('00000000-0000-0000-0000-0000000009a6', %L, 'x9@test.local', 'agent', pg_temp.tok('t0')) $$, (select id from ws9)),
  'P0001', 'app:not_found', 'non-member cannot invite (no existence leak)');
select throws_ok(
  format($$ select public.create_invitation('00000000-0000-0000-0000-0000000009a1', %L, 'x9@test.local', 'owner', pg_temp.tok('t0')) $$, (select id from ws9)),
  'P0001', 'app:invalid_role', 'owner cannot be invited');
select throws_ok(
  format($$ select public.create_invitation('00000000-0000-0000-0000-0000000009a1', %L, 'x9@test.local', 'agent', 'short') $$, (select id from ws9)),
  'P0001', 'app:invalid_token', 'token hash must be 64 hex chars');
select throws_ok(
  format($$ select public.create_invitation('00000000-0000-0000-0000-0000000009a1', %L, 'OWNER9@test.local', 'agent', pg_temp.tok('t0')) $$, (select id from ws9)),
  'P0001', 'app:already_member', 'cannot invite an active member');

create temp table inv_admin as select * from public.create_invitation('00000000-0000-0000-0000-0000000009a1',
  (select id from ws9), ' Admin9@Test.Local ', 'admin', pg_temp.tok('admin'), 'en');
select results_eq($$ select email, role::text, email_status, locale from inv_admin $$,
  $$ values ('admin9@test.local'::text, 'admin'::text, 'pending'::text, 'en'::text) $$,
  'invitation stored with normalized email, pending email status');
select ok((select expires_at between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days' + interval '1 minute' from inv_admin),
  'invitation expires after invitation_expiry_days');
select is((select r.id from public.create_invitation('00000000-0000-0000-0000-0000000009a1', (select id from ws9),
  'admin9@test.local', 'viewer', pg_temp.tok('admin-2')) r), (select id from inv_admin),
  're-inviting the same email reissues the open invitation');
select results_eq(
  format($$ select role::text, token_hash from public.workspace_invitations where id = %L $$, (select id from inv_admin)),
  format($$ values ('viewer'::text, %L::text) $$, pg_temp.tok('admin-2')),
  'reissue replaced role and token');
select lives_ok(
  format($$ select public.create_invitation('00000000-0000-0000-0000-0000000009a1', %L, 'agent9@test.local', 'agent', pg_temp.tok('agent')) $$, (select id from ws9)),
  'second invitation fits (1 member + 2 open of 4)');
select lives_ok(
  format($$ select public.create_invitation('00000000-0000-0000-0000-0000000009a1', %L, 'viewer9@test.local', 'viewer', pg_temp.tok('viewer')) $$, (select id from ws9)),
  'third invitation fits (1 member + 3 open of 4)');
select throws_ok(
  format($$ select public.create_invitation('00000000-0000-0000-0000-0000000009a1', %L, 'extra9@test.local', 'viewer', pg_temp.tok('extra')) $$, (select id from ws9)),
  'P0001', 'plan_limit:max_users:4', 'open invitations count against max_users');

select lives_ok(format($$ select public.set_invitation_email_status(%L, 'not_configured') $$, (select id from inv_admin)),
  'email status can be recorded');
select is((select email_status from public.workspace_invitations where id = (select id from inv_admin)),
  'not_configured', 'email status stored');
select throws_ok(format($$ select public.set_invitation_email_status(%L, 'delivered') $$, (select id from inv_admin)),
  '23514', null, 'unknown email status rejected');

select results_eq(
  format($$ select workspace_name, role::text, email, inviter_name, state from public.get_invitation_preview(%L) $$, pg_temp.tok('admin-2')),
  $$ values ('Diwan Cafe'::text, 'viewer'::text, 'admin9@test.local'::text, 'Sara Owner'::text, 'valid'::text) $$,
  'preview shows workspace, role, email, inviter and state');
select is_empty(format($$ select * from public.get_invitation_preview(%L) $$, pg_temp.tok('admin')),
  'the replaced token no longer resolves');

-- Accept rules
select throws_ok(format($$ select * from public.accept_invitation('00000000-0000-0000-0000-0000000009a6', %L) $$, pg_temp.tok('nope')),
  'P0001', 'app:invitation_not_found', 'unknown token');
select throws_ok(format($$ select * from public.accept_invitation('00000000-0000-0000-0000-0000000009a6', %L) $$, pg_temp.tok('admin-2')),
  'P0001', 'app:invitation_email_mismatch', 'a different account cannot accept');
update auth.users set email = 'unverified9b@test.local' where id = '00000000-0000-0000-0000-0000000009a5';
select throws_ok(
  format($$ select public.create_invitation('00000000-0000-0000-0000-0000000009a1', %L, 'unverified9b@test.local', 'viewer', pg_temp.tok('unv')) $$, (select id from ws9)),
  'P0001', 'plan_limit:max_users:4', 'capacity still full');
select results_eq(
  format($$ select workspace_slug, member_role::text from public.accept_invitation('00000000-0000-0000-0000-0000000009a2', %L) $$, pg_temp.tok('admin-2')),
  $$ values ('ws9-diwan'::text, 'viewer'::text) $$,
  'invitee accepts and joins with the invited role');
select results_eq(
  format($$ select workspace_slug, member_role::text from public.accept_invitation('00000000-0000-0000-0000-0000000009a2', %L) $$, pg_temp.tok('admin-2')),
  $$ values ('ws9-diwan'::text, 'viewer'::text) $$,
  'accepting twice is idempotent');
select is((select state from public.get_invitation_preview(pg_temp.tok('admin-2'))), 'accepted', 'preview state accepted');
select ok((select accepted_by = '00000000-0000-0000-0000-0000000009a2' from public.workspace_invitations where id = (select id from inv_admin)),
  'accepted_by recorded');
select lives_ok($$ select * from public.accept_invitation('00000000-0000-0000-0000-0000000009a3', pg_temp.tok('agent')) $$,
  'agent accepts');
select throws_ok($$ select * from public.accept_invitation('00000000-0000-0000-0000-0000000009a3', pg_temp.tok('admin-2')) $$,
  'P0001', 'app:invitation_used', 'someone else cannot reuse an accepted invitation');

-- Viewer invite: expire it, then revoke/renew.
update public.workspace_invitations set expires_at = now() - interval '1 minute' where token_hash = pg_temp.tok('viewer');
select throws_ok($$ select * from public.accept_invitation('00000000-0000-0000-0000-0000000009a4', pg_temp.tok('viewer')) $$,
  'P0001', 'app:invitation_expired', 'expired invitation rejected');
select is((select state from public.get_invitation_preview(pg_temp.tok('viewer'))), 'expired', 'preview state expired');
select throws_ok(
  format($$ select public.renew_invitation('00000000-0000-0000-0000-0000000009a3', %L, pg_temp.tok('viewer-2')) $$,
         (select id from public.workspace_invitations where token_hash = pg_temp.tok('viewer'))),
  'P0001', 'app:forbidden', 'an agent cannot renew invitations');
select lives_ok(
  format($$ select public.renew_invitation('00000000-0000-0000-0000-0000000009a1', %L, pg_temp.tok('viewer-2')) $$,
         (select id from public.workspace_invitations where token_hash = pg_temp.tok('viewer'))),
  'owner renews an expired invitation (new token + expiry)');
select is((select state from public.get_invitation_preview(pg_temp.tok('viewer-2'))), 'valid', 'renewed link is valid');
select lives_ok(
  format($$ select public.revoke_invitation('00000000-0000-0000-0000-0000000009a1', %L) $$,
         (select id from public.workspace_invitations where token_hash = pg_temp.tok('viewer-2'))),
  'owner revokes an invitation');
select throws_ok($$ select * from public.accept_invitation('00000000-0000-0000-0000-0000000009a4', pg_temp.tok('viewer-2')) $$,
  'P0001', 'app:invitation_revoked', 'revoked invitation rejected');
select throws_ok(
  format($$ select public.renew_invitation('00000000-0000-0000-0000-0000000009a1', %L, pg_temp.tok('viewer-3')) $$,
         (select id from public.workspace_invitations where token_hash = pg_temp.tok('viewer-2'))),
  'P0001', 'app:invitation_closed', 'revoked invitation cannot be renewed');

-- Unverified account (capacity is free again after the revoke).
select lives_ok(
  format($$ select public.create_invitation('00000000-0000-0000-0000-0000000009a1', %L, 'unverified9b@test.local', 'viewer', pg_temp.tok('unv')) $$, (select id from ws9)),
  'invite an unverified account');
select throws_ok($$ select * from public.accept_invitation('00000000-0000-0000-0000-0000000009a5', pg_temp.tok('unv')) $$,
  'P0001', 'app:email_not_verified', 'unverified account cannot accept');

-- Member limit trigger is the final check at acceptance.
update public.workspace_entitlement_overrides set value = '3' where workspace_id = (select id from ws9) and key = 'max_users';
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000009a5';
select throws_ok($$ select * from public.accept_invitation('00000000-0000-0000-0000-0000000009a5', pg_temp.tok('unv')) $$,
  'P0001', 'plan_limit:max_users:3', 'acceptance beyond max_users is rejected by the member trigger');
update public.workspace_entitlement_overrides set value = '4' where workspace_id = (select id from ws9) and key = 'max_users';

-- ---------------------------------------------------------------------------
-- 5. Members: roles, removal, leave, ownership transfer
-- Members now: 9a1 owner, 9a2 viewer, 9a3 agent.
-- ---------------------------------------------------------------------------
select lives_ok(format($$ select public.change_member_role('00000000-0000-0000-0000-0000000009a1', %L, '00000000-0000-0000-0000-0000000009a2', 'admin') $$, (select id from ws9)),
  'owner promotes viewer to admin');
select throws_ok(format($$ select public.change_member_role('00000000-0000-0000-0000-0000000009a2', %L, '00000000-0000-0000-0000-0000000009a1', 'agent') $$, (select id from ws9)),
  'P0001', 'app:cannot_change_owner', 'admin cannot change the owner');
select throws_ok(format($$ select public.change_member_role('00000000-0000-0000-0000-0000000009a2', %L, '00000000-0000-0000-0000-0000000009a2', 'agent') $$, (select id from ws9)),
  'P0001', 'app:cannot_change_own_role', 'nobody changes their own role');
select throws_ok(format($$ select public.change_member_role('00000000-0000-0000-0000-0000000009a1', %L, '00000000-0000-0000-0000-0000000009a3', 'owner') $$, (select id from ws9)),
  'P0001', 'app:invalid_role', 'role change cannot create an owner (use transfer)');
select throws_ok(format($$ select public.change_member_role('00000000-0000-0000-0000-0000000009a3', %L, '00000000-0000-0000-0000-0000000009a2', 'viewer') $$, (select id from ws9)),
  'P0001', 'app:forbidden', 'agent cannot change roles');
select throws_ok(format($$ select public.change_member_role('00000000-0000-0000-0000-0000000009a6', %L, '00000000-0000-0000-0000-0000000009a3', 'viewer') $$, (select id from ws9)),
  'P0001', 'app:not_found', 'non-member gets not_found');

-- Assignment released when an agent becomes a viewer.
insert into public.customers (id, workspace_id, display_name) values ('90000000-0000-0000-0000-0000000009c1', (select id from ws9), 'C');
insert into public.bots (id, workspace_id, name) values ('90000000-0000-0000-0000-0000000009b1', (select id from ws9), 'B9');
insert into public.channels (id, workspace_id, bot_id, channel_type, connection_mode) values
  ('90000000-0000-0000-0000-0000000009d1', (select id from ws9), '90000000-0000-0000-0000-0000000009b1', 'widget', 'automatic');
insert into public.conversations (id, workspace_id, bot_id, channel_id, customer_id, assigned_to) values
  ('90000000-0000-0000-0000-0000000009e1', (select id from ws9), '90000000-0000-0000-0000-0000000009b1',
   '90000000-0000-0000-0000-0000000009d1', '90000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009a3');
select lives_ok(format($$ select public.change_member_role('00000000-0000-0000-0000-0000000009a2', %L, '00000000-0000-0000-0000-0000000009a3', 'viewer') $$, (select id from ws9)),
  'admin demotes agent to viewer');
select is((select assigned_to from public.conversations where id = '90000000-0000-0000-0000-0000000009e1'), null,
  'demoted member loses conversation assignments');
select is((select count(*)::int from public.audit_logs where workspace_id = (select id from ws9) and action = 'member.role_changed'),
  2, 'role changes audited');

select throws_ok(format($$ select public.remove_member('00000000-0000-0000-0000-0000000009a3', %L, '00000000-0000-0000-0000-0000000009a2') $$, (select id from ws9)),
  'P0001', 'app:forbidden', 'viewer cannot remove others');
select throws_ok(format($$ select public.remove_member('00000000-0000-0000-0000-0000000009a2', %L, '00000000-0000-0000-0000-0000000009a1') $$, (select id from ws9)),
  'P0001', 'app:cannot_remove_owner', 'owner cannot be removed');
select throws_ok(format($$ select public.remove_member('00000000-0000-0000-0000-0000000009a1', %L, '00000000-0000-0000-0000-0000000009a1') $$, (select id from ws9)),
  'P0001', 'app:owner_cannot_leave', 'owner cannot leave');

-- Ownership transfer
select throws_ok(format($$ select public.transfer_ownership('00000000-0000-0000-0000-0000000009a2', %L, '00000000-0000-0000-0000-0000000009a2') $$, (select id from ws9)),
  'P0001', 'app:forbidden', 'only the owner can transfer ownership');
select throws_ok(format($$ select public.transfer_ownership('00000000-0000-0000-0000-0000000009a1', %L, '00000000-0000-0000-0000-0000000009a6') $$, (select id from ws9)),
  'P0001', 'app:member_not_found', 'transfer target must be a member');
select lives_ok(format($$ select public.transfer_ownership('00000000-0000-0000-0000-0000000009a1', %L, '00000000-0000-0000-0000-0000000009a2') $$, (select id from ws9)),
  'owner transfers ownership to the admin');
select results_eq(
  format($$ select m.user_id, m.role::text from public.workspace_members m where m.workspace_id = %L and m.role in ('owner', 'admin') order by m.role $$, (select id from ws9)),
  $$ values ('00000000-0000-0000-0000-0000000009a2'::uuid, 'owner'::text), ('00000000-0000-0000-0000-0000000009a1'::uuid, 'admin'::text) $$,
  'new owner set; previous owner became admin');

-- Read-only workspace: changes that grant access are blocked; removing access still works.
update public.workspaces set status = 'read_only' where id = (select id from ws9);
select throws_ok(format($$ select public.create_invitation('00000000-0000-0000-0000-0000000009a2', %L, 'late9@test.local', 'viewer', pg_temp.tok('late')) $$, (select id from ws9)),
  'P0001', 'app:workspace_read_only', 'no invitations on a read-only workspace');
select lives_ok(format($$ select public.remove_member('00000000-0000-0000-0000-0000000009a3', %L, '00000000-0000-0000-0000-0000000009a3') $$, (select id from ws9)),
  'a member can leave a read-only workspace');
select is((select count(*)::int from public.workspace_members where workspace_id = (select id from ws9)), 2,
  'member left');
select is((select count(*)::int from public.audit_logs where workspace_id = (select id from ws9) and action = 'member.left'),
  1, 'leaving audited');

-- ---------------------------------------------------------------------------
-- 6. Clients: profile edits through RLS + column grants
-- ---------------------------------------------------------------------------
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000009a1', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000009a1","role":"authenticated"}', true);
end $$;
select lives_ok($$ update public.profiles set locale = 'ar', theme = 'light' where id = '00000000-0000-0000-0000-0000000009a1' $$,
  'user updates own locale and theme');
select throws_ok($$ update public.profiles set email = 'x@x.io' where id = '00000000-0000-0000-0000-0000000009a1' $$,
  '42501', null, 'user cannot change the synced email');
select throws_ok($$ select token_hash from public.workspace_invitations $$, '42501', null,
  'token_hash cannot be selected by clients');
select throws_ok($$ select public.create_workspace('00000000-0000-0000-0000-0000000009a1', 'Z', 'ws9-z', null, null, 'Asia/Riyadh', 'ar') $$,
  '42501', null, 'clients cannot call create_workspace directly');
reset role;

-- ---------------------------------------------------------------------------
-- 7. Rate limiter
-- ---------------------------------------------------------------------------
select results_eq($$ select allowed, remaining from public.hit_rate_limit('t9:ip', 2, 60) $$,
  $$ values (true, 1) $$, 'first hit allowed');
select results_eq($$ select allowed, remaining from public.hit_rate_limit('t9:ip', 2, 60) $$,
  $$ values (true, 0) $$, 'second hit allowed');
select ok((select not allowed and retry_after_seconds between 1 and 60 from public.hit_rate_limit('t9:ip', 2, 60)),
  'third hit refused with Retry-After');
select ok((select allowed from public.hit_rate_limit('t9:other', 2, 60)), 'buckets are independent');

select * from finish();
rollback;
