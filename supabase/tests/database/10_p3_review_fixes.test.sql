-- pgTAP: P3 review fixes (migration 0016) + coverage gaps found by the security review.
-- Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(32);

create function pg_temp.tok(p text) returns text language sql as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;

-- ---------------------------------------------------------------------------
-- 1. Pre-confirmation passwords are cleared when the email is confirmed (security H1)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at) values
  ('00000000-0000-0000-0000-000000000a01', 'victim10@test.local', 'attacker-hash', null, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000a02', 'admin10@test.local', 'admin-hash', now(), now()),
  ('00000000-0000-0000-0000-000000000a03', 'admin-confirm10@test.local', 'admin2-hash', null, now());
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000a01';
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000a03';
select is((select encrypted_password from auth.users where id = '00000000-0000-0000-0000-000000000a03'), 'admin2-hash',
  'an account confirmed right after creation (admin email_confirm) keeps its password');
select is((select encrypted_password from auth.users where id = '00000000-0000-0000-0000-000000000a01'), '',
  'password chosen before confirmation is cleared at confirmation');
select is((select encrypted_password from auth.users where id = '00000000-0000-0000-0000-000000000a02'), 'admin-hash',
  'an account confirmed at creation keeps its password');
update auth.users set encrypted_password = 'new-hash' where id = '00000000-0000-0000-0000-000000000a01';
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000a01';
select is((select encrypted_password from auth.users where id = '00000000-0000-0000-0000-000000000a01'), 'new-hash',
  'a password set after confirmation survives later updates');

-- ---------------------------------------------------------------------------
-- Fixtures: workspace A (owner, admin, agent) and workspace B (owner), confirmed users
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000a11', 'owner-a10@test.local', now()),
  ('00000000-0000-0000-0000-000000000a12', 'admin-a10@test.local', now()),
  ('00000000-0000-0000-0000-000000000a13', 'agent-a10@test.local', now()),
  ('00000000-0000-0000-0000-000000000a14', 'guest1-10@test.local', now()),
  ('00000000-0000-0000-0000-000000000a15', 'guest2-10@test.local', now()),
  ('00000000-0000-0000-0000-000000000b11', 'owner-b10@test.local', now());
update public.platform_settings set value = 'null' where key = 'max_trial_workspaces_per_user';
create temp table wa as select * from public.create_workspace('00000000-0000-0000-0000-000000000a11', 'A10', 'ws10-a', null, null, 'Asia/Riyadh', 'en');
create temp table wb as select * from public.create_workspace('00000000-0000-0000-0000-000000000b11', 'B10', 'ws10-b', null, null, 'Asia/Riyadh', 'en');
insert into public.workspace_entitlement_overrides (workspace_id, key, value, reason)
  select id, k, v::jsonb, 'pgTAP' from wa, (values ('max_users', '10'), ('human_handoff', 'true')) o(k, v);
insert into public.workspace_entitlement_overrides (workspace_id, key, value, reason)
  select id, 'max_users', '10', 'pgTAP' from wb;
insert into public.workspace_members (workspace_id, user_id, role) values
  ((select id from wa), '00000000-0000-0000-0000-000000000a12', 'admin'),
  ((select id from wa), '00000000-0000-0000-0000-000000000a13', 'agent');

-- ---------------------------------------------------------------------------
-- 2. Invitations die with their inviter's rights (security M1)
-- ---------------------------------------------------------------------------
select lives_ok(format($$ select public.create_invitation('00000000-0000-0000-0000-000000000a12', %L, 'guest1-10@test.local', 'admin', pg_temp.tok('g1')) $$, (select id from wa)),
  'admin invites guest1 as admin');
select lives_ok(format($$ select public.change_member_role('00000000-0000-0000-0000-000000000a11', %L, '00000000-0000-0000-0000-000000000a12', 'agent') $$, (select id from wa)),
  'owner demotes the admin to agent');
select isnt((select revoked_at from public.workspace_invitations where token_hash = pg_temp.tok('g1')), null,
  'the demoted admin''s open invitations are revoked');
select throws_ok($$ select * from public.accept_invitation('00000000-0000-0000-0000-000000000a14', pg_temp.tok('g1')) $$,
  'P0001', 'app:invitation_revoked', 'their invitation can no longer be accepted');

-- Inviter loses rights without going through the RPCs: accept still refuses.
select lives_ok(format($$ select public.create_invitation('00000000-0000-0000-0000-000000000a11', %L, 'guest2-10@test.local', 'viewer', pg_temp.tok('g2')) $$, (select id from wa)),
  'owner invites guest2');
update public.workspace_invitations set invited_by = '00000000-0000-0000-0000-000000000a13' where token_hash = pg_temp.tok('g2');
select throws_ok($$ select * from public.accept_invitation('00000000-0000-0000-0000-000000000a15', pg_temp.tok('g2')) $$,
  'P0001', 'app:invitation_revoked', 'an inviter who is no longer owner/admin invalidates the invitation');
update public.workspace_invitations set invited_by = '00000000-0000-0000-0000-000000000a11' where token_hash = pg_temp.tok('g2');

-- Removal revokes too.
update public.workspace_members set role = 'admin' where workspace_id = (select id from wa) and user_id = '00000000-0000-0000-0000-000000000a12';
select lives_ok(format($$ select public.create_invitation('00000000-0000-0000-0000-000000000a12', %L, 'other10@test.local', 'viewer', pg_temp.tok('o1')) $$, (select id from wa)),
  'admin invites again');
select lives_ok(format($$ select public.remove_member('00000000-0000-0000-0000-000000000a11', %L, '00000000-0000-0000-0000-000000000a12') $$, (select id from wa)),
  'owner removes the admin');
select isnt((select revoked_at from public.workspace_invitations where token_hash = pg_temp.tok('o1')), null,
  'the removed admin''s open invitations are revoked');
select is((select count(*)::int from public.audit_logs where workspace_id = (select id from wa) and action = 'invitation.revoked_with_inviter'),
  2, 'automatic revocations are audited');

-- ---------------------------------------------------------------------------
-- 3. No new access on a read-only workspace (code review #1)
-- ---------------------------------------------------------------------------
update public.workspaces set status = 'read_only' where id = (select id from wa);
select throws_ok($$ select * from public.accept_invitation('00000000-0000-0000-0000-000000000a15', pg_temp.tok('g2')) $$,
  'P0001', 'app:workspace_read_only', 'invitations cannot be accepted while the workspace is read-only');
select lives_ok(format($$ select public.revoke_invitation('00000000-0000-0000-0000-000000000a11', (select id from public.workspace_invitations where token_hash = %L)) $$, pg_temp.tok('g2')),
  'the owner can still revoke on a read-only workspace');
update public.workspaces set status = 'active' where id = (select id from wa);

-- ---------------------------------------------------------------------------
-- 4. release_assignments only touches open work (code review #3)
-- ---------------------------------------------------------------------------
insert into public.customers (id, workspace_id, display_name) select '90000000-0000-0000-0000-000000000c10', id, 'C' from wa;
insert into public.bots (id, workspace_id, name) select '90000000-0000-0000-0000-000000000b10', id, 'B' from wa;
insert into public.channels (id, workspace_id, bot_id, channel_type, connection_mode)
  select '90000000-0000-0000-0000-000000000d10', id, '90000000-0000-0000-0000-000000000b10', 'widget', 'automatic' from wa;
insert into public.conversations (id, workspace_id, bot_id, channel_id, customer_id, assigned_to, status)
  select v.id, wa.id, '90000000-0000-0000-0000-000000000b10', '90000000-0000-0000-0000-000000000d10',
         '90000000-0000-0000-0000-000000000c10', '00000000-0000-0000-0000-000000000a13', v.status::public.conversation_status
  from wa, (values ('90000000-0000-0000-0000-000000000e11'::uuid, 'open'), ('90000000-0000-0000-0000-000000000e12'::uuid, 'closed')) v(id, status);
insert into public.handoffs (id, workspace_id, conversation_id, requested_by, status, assigned_to)
  select v.id, wa.id, '90000000-0000-0000-0000-000000000e11', 'ai', v.status::public.handoff_status, '00000000-0000-0000-0000-000000000a13'
  from wa, (values ('90000000-0000-0000-0000-000000000f11'::uuid, 'assigned'), ('90000000-0000-0000-0000-000000000f12'::uuid, 'resolved')) v(id, status);
select lives_ok(format($$ select public.change_member_role('00000000-0000-0000-0000-000000000a11', %L, '00000000-0000-0000-0000-000000000a13', 'viewer') $$, (select id from wa)),
  'agent demoted to viewer');
select is((select assigned_to from public.conversations where id = '90000000-0000-0000-0000-000000000e11'), null,
  'open conversation unassigned');
select is((select assigned_to from public.conversations where id = '90000000-0000-0000-0000-000000000e12'), '00000000-0000-0000-0000-000000000a13'::uuid,
  'closed conversation keeps its history');
select results_eq($$ select status::text, assigned_to from public.handoffs where id = '90000000-0000-0000-0000-000000000f11' $$,
  $$ values ('requested'::text, null::uuid) $$, 'assigned handoff goes back to the queue');
select is((select assigned_to from public.handoffs where id = '90000000-0000-0000-0000-000000000f12'), '00000000-0000-0000-0000-000000000a13'::uuid,
  'resolved handoff keeps its history');

-- ---------------------------------------------------------------------------
-- 5. Cross-workspace actors get not_found (owner of B on A's ids)
-- ---------------------------------------------------------------------------
select lives_ok(format($$ select public.create_invitation('00000000-0000-0000-0000-000000000a11', %L, 'x10@test.local', 'viewer', pg_temp.tok('x1')) $$, (select id from wa)),
  'fixture invitation in A');
select throws_ok(format($$ select public.renew_invitation('00000000-0000-0000-0000-000000000b11', (select id from public.workspace_invitations where token_hash = %L), pg_temp.tok('x2')) $$, pg_temp.tok('x1')),
  'P0001', 'app:not_found', 'owner of B cannot renew A''s invitation');
select throws_ok(format($$ select public.revoke_invitation('00000000-0000-0000-0000-000000000b11', (select id from public.workspace_invitations where token_hash = %L)) $$, pg_temp.tok('x1')),
  'P0001', 'app:not_found', 'owner of B cannot revoke A''s invitation');
select throws_ok(format($$ select public.remove_member('00000000-0000-0000-0000-000000000b11', %L, '00000000-0000-0000-0000-000000000a13') $$, (select id from wa)),
  'P0001', 'app:not_found', 'owner of B cannot remove A''s member');
select throws_ok(format($$ select public.transfer_ownership('00000000-0000-0000-0000-000000000b11', %L, '00000000-0000-0000-0000-000000000b11') $$, (select id from wa)),
  'P0001', 'app:not_found', 'owner of B cannot take ownership of A');

-- ---------------------------------------------------------------------------
-- 6. Replay after removal, deleted workspaces, private helpers
-- ---------------------------------------------------------------------------
update auth.users set email = 'x10@test.local' where id = '00000000-0000-0000-0000-000000000a15';
select lives_ok($$ select * from public.accept_invitation('00000000-0000-0000-0000-000000000a15', pg_temp.tok('x1')) $$,
  'guest accepts');
select lives_ok(format($$ select public.remove_member('00000000-0000-0000-0000-000000000a11', %L, '00000000-0000-0000-0000-000000000a15') $$, (select id from wa)),
  'owner removes the guest');
select throws_ok($$ select * from public.accept_invitation('00000000-0000-0000-0000-000000000a15', pg_temp.tok('x1')) $$,
  'P0001', 'app:invitation_used', 'a removed member cannot rejoin by replaying the old link');
select lives_ok(format($$ select public.create_invitation('00000000-0000-0000-0000-000000000b11', %L, 'y10@test.local', 'viewer', pg_temp.tok('y1')) $$, (select id from wb)),
  'invitation in B');
update public.workspaces set deleted_at = now() where id = (select id from wb);
select is_empty($$ select * from public.get_invitation_preview(pg_temp.tok('y1')) $$, 'no preview for a deleted workspace');
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname in ('profile_name_from_meta', 'profile_locale_from_meta', 'handle_new_user', 'sync_profile_email',
                         'setting_int', 'require_member_role', 'require_writable', 'audit', 'release_assignments',
                         'slug_is_reserved', 'assert_invite_capacity', 'clear_unverified_password', 'revoke_invitations_by')
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) $$,
  'P3 private helpers are not executable by client roles');

select * from finish();
rollback;
