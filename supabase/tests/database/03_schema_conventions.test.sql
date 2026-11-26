-- pgTAP: schema-wide security conventions (CLAUDE.md tenant-isolation rules, SECURITY.md).
-- Catalog checks only, so a new table that forgets RLS, an index, a grant rule or a
-- search_path fails here automatically. Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(21);

-- 1. RLS is enabled on every table in `public` and on every analytics partition.
select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'RLS enabled on every public table');
select is_empty(
  $$ select c.oid::regclass::text from pg_inherits i join pg_class c on c.oid = i.inhrelid
     where i.inhparent = 'public.analytics_events'::regclass and not c.relrowsecurity $$,
  'RLS enabled on every analytics partition');
select is_empty(
  $$ select c.oid::regclass::text from pg_inherits i join pg_class c on c.oid = i.inhrelid
     join pg_namespace n on n.oid = c.relnamespace
     where i.inhparent = 'public.analytics_events'::regclass and n.nspname <> 'private' $$,
  'analytics partitions live in the unexposed private schema');
select is_empty(
  $$ select c.oid::regclass::text || ':' || r.rolname from pg_inherits i
     join pg_class c on c.oid = i.inhrelid
     cross join (values ('anon'), ('authenticated')) as r(rolname)
     where i.inhparent = 'public.analytics_events'::regclass
       and (has_table_privilege(r.rolname, c.oid, 'select') or has_table_privilege(r.rolname, c.oid, 'insert')) $$,
  'client roles have no privileges on analytics partitions');

-- 2. Every tenant table carries a NOT NULL workspace_id (except the documented platform
--    tables where it is optional) and has an index led by workspace_id.
select is_empty(
  $$ select table_name::text from information_schema.columns
     where table_schema = 'public' and column_name = 'workspace_id' and is_nullable = 'YES'
       and table_name not in ('jobs', 'platform_events', 'audit_logs', 'internal_notes',
                              'webhook_events', 'feature_flags') $$,
  'workspace_id is NOT NULL on every tenant table');
select is_empty(
  $$ select c.relname::text from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attname = 'workspace_id' and not a.attisdropped
     where n.nspname = 'public' and c.relkind in ('r', 'p')
       and not exists (select 1 from pg_index i where i.indrelid = c.oid and i.indkey[0] = a.attnum) $$,
  'every tenant table has an index led by workspace_id');

-- 3. Service-role-only tables: RLS on, zero policies, zero client privileges.
create temp table service_only(t text) on commit drop;
insert into service_only values
  ('channel_credentials'), ('webhook_events'), ('analytics_events'), ('jobs'), ('usage_events'),
  ('kb_chunks'), ('provider_price_refs'), ('ai_model_profiles'), ('ai_model_prices'),
  ('platform_events'), ('internal_notes'), ('platform_settings');
select is_empty(
  $$ select s.t from service_only s where to_regclass('public.' || s.t) is null $$,
  'every listed service-only table exists');
select is_empty(
  $$ select p.tablename::text from pg_policies p join service_only s on s.t = p.tablename
     where p.schemaname = 'public' $$,
  'service-only tables have no RLS policies');
select is_empty(
  $$ select s.t || ':' || r.rolname || ':' || pr.p from service_only s
     cross join (values ('anon'), ('authenticated')) as r(rolname)
     cross join (values ('select'), ('insert'), ('update'), ('delete')) as pr(p)
     where has_table_privilege(r.rolname, 'public.' || s.t, pr.p) $$,
  'client roles have no privileges on service-only tables');

-- 4. anon: SELECT only, and only on the public pricing catalogue.
select is_empty(
  $$ select c.relname::text || ':' || pr.p from pg_class c join pg_namespace n on n.oid = c.relnamespace
     cross join (values ('select'), ('insert'), ('update'), ('delete')) as pr(p)
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
       and has_table_privilege('anon', c.oid, pr.p)
       and not (pr.p = 'select' and c.relname in
                ('entitlement_definitions', 'plans', 'plan_prices', 'plan_entitlements', 'one_time_products')) $$,
  'anon can only read the public pricing catalogue');

-- 5. Policies: never `to public`; anon only on the catalogue; every write policy has WITH CHECK.
select is_empty(
  $$ select tablename || '.' || policyname from pg_policies
     where schemaname = 'public' and 'public' = any (roles) $$,
  'no policy targets the PUBLIC role');
select is_empty(
  $$ select tablename || '.' || policyname from pg_policies
     where schemaname = 'public' and 'anon' = any (roles)
       and tablename not in ('entitlement_definitions', 'plans', 'plan_prices', 'plan_entitlements', 'one_time_products') $$,
  'anon policies exist only on the pricing catalogue');
select is_empty(
  $$ select c.relname || '.' || p.polname from pg_policy p join pg_class c on c.oid = p.polrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and p.polcmd in ('a', 'w', '*') and p.polwithcheck is null $$,
  'every INSERT/UPDATE/ALL policy has a WITH CHECK clause');

-- 6. Functions: search_path pinned; nothing callable by anon; authenticated only gets the
--    documented helpers.
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and p.prorettype <> 'event_trigger'::regtype   -- platform-managed (e.g. Supabase rls_auto_enable)
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c = 'search_path=""') $$,
  'every public/private function pins an empty search_path');
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon cannot execute any public/private function');
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and p.prorettype <> 'trigger'::regtype
       and has_function_privilege('authenticated', p.oid, 'execute')
       and p.oid::regprocedure::text not in (
         'get_workspace_entitlements(uuid)',
         'private.is_workspace_member(uuid)',
         'private.has_workspace_role(uuid,workspace_role[])',
         'private.workspace_is_writable(uuid)',
         'private.can_write(uuid,workspace_role[])',
         'private.is_platform_admin()',
         'private.is_i18n_text(jsonb)',
         'private.is_i18n_text_full(jsonb)',
         'private.try_uuid(text)',
         'private.object_workspace(text)') $$,
  'authenticated can execute only the documented RPC + RLS helpers');

-- 7. workspace_id is immutable on every tenant table (0013).
select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attname = 'workspace_id' and a.attnotnull and not a.attisdropped
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
       and not exists (select 1 from pg_trigger t join pg_proc f on f.oid = t.tgfoid
                       where t.tgrelid = c.oid and f.proname = 'prevent_workspace_change') $$,
  'every tenant table rejects workspace_id changes');

-- 8. Clients hold no TRUNCATE / REFERENCES / TRIGGER on any table.
select is_empty(
  $$ select c.relname::text || ':' || r.rolname || ':' || pr.p from pg_class c join pg_namespace n on n.oid = c.relnamespace
     cross join (values ('anon'), ('authenticated')) as r(rolname)
     cross join (values ('truncate'), ('references'), ('trigger')) as pr(p)
     where n.nspname = 'public' and c.relkind in ('r', 'p') and has_table_privilege(r.rolname, c.oid, pr.p) $$,
  'client roles have no TRUNCATE / REFERENCES / TRIGGER privileges');

-- 9. Storage: private buckets have no client read policies; public bucket takes no SVG.
select is_empty(
  $$ select policyname::text from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and (coalesce(qual, '') ~ '(knowledge-files|attachments|exports)'
            or coalesce(with_check, '') ~ '(knowledge-files|attachments|exports)') $$,
  'no client policies on private buckets (downloads via short-lived service-role URLs)');
select ok(
  (select not ('image/svg+xml' = any (coalesce(allowed_mime_types, '{}'))) from storage.buckets where id = 'public-assets'),
  'public-assets does not accept SVG');
select is(
  (select count(*)::int from storage.buckets where id in ('knowledge-files', 'attachments', 'exports') and public),
  0, 'private buckets are not public');

select * from finish();
rollback;
