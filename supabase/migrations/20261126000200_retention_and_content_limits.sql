-- =============================================================================
-- 0014 · Owner decisions after the P2 review (DECISIONS §F, 2026-11-26)
--   F1. Workspace deletion = soft delete. The workspace row becomes an anonymized tombstone,
--       every tenant table is purged EXCEPT billing_events, payment_transactions and
--       invoices_records, which are kept detached from tenant content for
--       platform_settings.billing_record_retention_days (default 1825 = 5 years). After that the
--       tombstone and its billing records are hard-deleted (purge_deleted_workspaces).
--   F3. Content row limits are entitlements (data): max_faqs, max_catalog_items and
--       knowledge_files_max per plan; Enterprise = unlimited by default, custom via overrides.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- F1 · Schema
-- ---------------------------------------------------------------------------
alter table public.workspaces
  add column purge_after timestamptz,                -- tombstone + retained billing removed after this
  -- Business identity kept for the retained billing records (no personal data). Legal
  -- retention rules per jurisdiction = needs verification.
  add column retained_billing_identity jsonb
    check (retained_billing_identity is null or jsonb_typeof(retained_billing_identity) = 'object'),
  add constraint workspaces_purge_after_requires_deleted check (purge_after is null or deleted_at is not null);
create index workspaces_purge_idx on public.workspaces (purge_after) where deleted_at is not null;

-- Invoices keep their billing period as a snapshot so they stay meaningful once the usage
-- period (tenant content) is purged.
alter table public.invoices_records
  add column period_start timestamptz,
  add column period_end timestamptz;
do $$
declare
  v_name text;
begin
  select conname into v_name from pg_constraint
  where conrelid = 'public.invoices_records'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%usage_period_id IS NOT NULL%';
  execute format('alter table public.invoices_records drop constraint %I', v_name);
end;
$$;
alter table public.invoices_records add constraint invoices_records_overage_period
  check (kind <> 'overage' or usage_period_id is not null or period_start is not null);

insert into public.platform_settings (key, value, description) values
  ('billing_record_retention_days', '1825',
   'Days billing_events / payment_transactions / invoices_records are kept after a workspace is deleted (F1; default 5 years)')
on conflict (key) do nothing;

-- Re-indexing never runs for a deleted (tombstoned) or vanished workspace.
create or replace function private.enqueue_reindex()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ws uuid := coalesce(new.workspace_id, old.workspace_id);
  v_bucket bigint := floor(extract(epoch from now()) / 30);
begin
  if not exists (select 1 from public.workspaces w where w.id = v_ws and w.deleted_at is null) then
    return null;
  end if;
  perform public.enqueue_job(
    'reindex_structured_knowledge',
    jsonb_build_object('workspace_id', v_ws, 'kind', tg_argv[0]),
    v_ws, 'default', now() + interval '30 seconds',
    'reindex:' || v_ws::text || ':' || tg_argv[0] || ':' || v_bucket::text);
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- F1 · soft_delete_workspace(ws, actor): run by `scheduler` after the deletion grace period
-- (C10) or by a platform admin through `api` (service role). Storage objects must be removed
-- through the Storage API before calling it (SQL deletes leave files behind). Idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete_workspace(p_workspace_id uuid, p_actor_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_ws       public.workspaces;
  v_days     integer;
  v_purged   jsonb := '{}'::jsonb;
  v_retained bigint;
  v_n        bigint;
  r          record;
begin
  select * into v_ws from public.workspaces w where w.id = p_workspace_id for update;
  if v_ws.id is null then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;
  if v_ws.deleted_at is not null then
    return jsonb_build_object('status', 'already_deleted', 'purge_after', v_ws.purge_after);
  end if;
  v_days := coalesce(
    (select (s.value #>> '{}')::integer from public.platform_settings s where s.key = 'billing_record_retention_days'),
    1825);

  -- 1. Tombstone first, so no trigger re-creates tenant rows while purging.
  update public.workspaces w
     set retained_billing_identity = jsonb_build_object(
           'name', v_ws.name, 'slug', v_ws.slug, 'country_code', v_ws.country_code, 'deleted_at', now()),
         name          = 'Deleted workspace',
         slug          = 'deleted-' || left(replace(v_ws.id::text, '-', ''), 12),
         logo_path     = null,
         category      = null,
         status        = 'pending_deletion',
         status_reason = 'deleted',
         deleted_at    = now(),
         purge_after   = now() + make_interval(days => v_days)
   where w.id = p_workspace_id;

  -- 2. Detach the retained billing records from tenant content.
  update public.invoices_records i
     set period_start = coalesce(i.period_start, p.period_start),
         period_end   = coalesce(i.period_end, p.period_end),
         usage_period_id = null
    from public.usage_periods p
   where i.workspace_id = p_workspace_id and p.workspace_id = i.workspace_id and p.id = i.usage_period_id;
  update public.payment_transactions t
     set subscription_id = null
   where t.workspace_id = p_workspace_id and t.subscription_id is not null;
  -- billing_events.subscription_id / webhook_event_id are nulled by their FK actions below.

  -- 3. Purge every other tenant table (children go by cascade; bot_configs with bots).
  for r in
    select c.relname
    from pg_class c
    join pg_namespace s on s.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'workspace_id' and not a.attisdropped
    where s.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
      and c.relname not in ('billing_events', 'payment_transactions', 'invoices_records',
                            'audit_logs', 'bot_configs', 'webhook_events')
    order by c.relname
  loop
    execute format('delete from public.%I where workspace_id = $1', r.relname) using p_workspace_id;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      v_purged := v_purged || jsonb_build_object(r.relname, v_n);
    end if;
  end loop;
  -- Channel payloads are tenant content; PayPal events stay with the billing records.
  delete from public.webhook_events e where e.workspace_id = p_workspace_id and e.provider <> 'paypal';
  get diagnostics v_n = row_count;
  if v_n > 0 then
    v_purged := v_purged || jsonb_build_object('webhook_events', v_n);
  end if;

  v_retained := (select count(*) from public.billing_events b where b.workspace_id = p_workspace_id)
              + (select count(*) from public.payment_transactions t where t.workspace_id = p_workspace_id)
              + (select count(*) from public.invoices_records i where i.workspace_id = p_workspace_id);

  insert into public.audit_logs (workspace_id, actor_type, actor_id, action, entity_type, entity_id, changes)
  values (p_workspace_id,
          case when p_actor_id is null then 'system'::public.actor_type else 'platform_admin'::public.actor_type end,
          p_actor_id, 'workspace.soft_deleted', 'workspace', p_workspace_id::text,
          jsonb_build_object('purged', v_purged, 'retained_billing_rows', v_retained,
                             'purge_after', now() + make_interval(days => v_days)));

  return jsonb_build_object('status', 'deleted', 'purged', v_purged,
                            'retained_billing_rows', v_retained,
                            'purge_after', now() + make_interval(days => v_days));
end;
$$;

-- Final removal after the retention period (scheduler, P10). Cascades the retained billing
-- records; audit rows survive detached (workspace_id = null). Returns workspaces removed.
create or replace function public.purge_deleted_workspaces()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.webhook_events e
   using public.workspaces w
   where e.workspace_id = w.id and w.deleted_at is not null and w.purge_after <= now();
  with d as (
    delete from public.workspaces w
     where w.deleted_at is not null and w.purge_after <= now()
    returning 1
  )
  select count(*)::integer into v_n from d;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- F3 · Content row limits as entitlements
-- ---------------------------------------------------------------------------
insert into public.entitlement_definitions (key, value_type, default_value, description) values
  ('max_faqs',          'integer', '30', 'Maximum FAQ entries (null = unlimited)'),
  ('max_catalog_items', 'integer', '50', 'Maximum catalog / menu items (null = unlimited)')
on conflict (key) do nothing;

insert into public.plan_entitlements (plan_id, key, value)
select p.id, v.key, v.value::jsonb
from (values
  ('trial',      'max_faqs', '30'),   ('trial',      'max_catalog_items', '50'),   ('trial',      'knowledge_files_max', '5'),
  ('starter',    'max_faqs', '200'),  ('starter',    'max_catalog_items', '500'),  ('starter',    'knowledge_files_max', '20'),
  ('growth',     'max_faqs', '1000'), ('growth',     'max_catalog_items', '2000'), ('growth',     'knowledge_files_max', '100'),
  -- Enterprise: unlimited by default; contract limits via workspace_entitlement_overrides.
  ('enterprise', 'max_faqs', 'null'), ('enterprise', 'max_catalog_items', 'null'), ('enterprise', 'knowledge_files_max', 'null')
) as v(code, key, value)
join public.plans p on p.code = v.code
on conflict (plan_id, key) do update set value = excluded.value;

create or replace function private.enforce_faq_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_client_can_write(new.workspace_id);
  perform private.lock_limit(new.workspace_id, 'max_faqs');
  perform private.assert_limit(new.workspace_id, 'max_faqs',
    (select count(*) from public.faqs f where f.workspace_id = new.workspace_id));
  return new;
end;
$$;
create trigger faqs_enforce_limit before insert on public.faqs
  for each row execute function private.enforce_faq_limit();

create or replace function private.enforce_catalog_item_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_client_can_write(new.workspace_id);
  perform private.lock_limit(new.workspace_id, 'max_catalog_items');
  perform private.assert_limit(new.workspace_id, 'max_catalog_items',
    (select count(*) from public.catalog_items c where c.workspace_id = new.workspace_id));
  return new;
end;
$$;
create trigger catalog_items_enforce_limit before insert on public.catalog_items
  for each row execute function private.enforce_catalog_item_limit();

-- Uploaded files (kb_documents with a storage path): count + size per plan.
create or replace function private.enforce_knowledge_file_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_max_mb integer := private.entitlement_int(new.workspace_id, 'knowledge_file_max_mb');
begin
  perform private.assert_client_can_write(new.workspace_id);
  if v_max_mb is not null and coalesce(new.size_bytes, 0) > v_max_mb::bigint * 1048576 then
    raise exception 'plan_limit:knowledge_file_max_mb:%', v_max_mb using errcode = 'P0001';
  end if;
  perform private.lock_limit(new.workspace_id, 'knowledge_files_max');
  perform private.assert_limit(new.workspace_id, 'knowledge_files_max',
    (select count(*) from public.kb_documents d
     where d.workspace_id = new.workspace_id and d.storage_path is not null));
  return new;
end;
$$;
create trigger kb_documents_enforce_file_limits before insert on public.kb_documents
  for each row when (new.storage_path is not null)
  execute function private.enforce_knowledge_file_limits();

-- ---------------------------------------------------------------------------
-- Function privilege sweep (same rule as 0010 / 0013).
-- ---------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_workspace_entitlements(uuid) to authenticated;
grant execute on function
  public.consume_ai_reply(uuid, text, uuid),
  public.release_ai_reply(text),
  public.enqueue_job(text, jsonb, uuid, text, timestamptz, text, smallint),
  public.claim_jobs(text, text, integer, integer),
  public.complete_job(bigint, text),
  public.fail_job(bigint, text, boolean, text),
  public.requeue_stuck_jobs(),
  public.retry_job(bigint, uuid, text),
  public.match_kb_chunks(uuid, uuid, extensions.vector, text, integer, integer),
  public.soft_delete_workspace(uuid, uuid),
  public.purge_deleted_workspaces()
  to service_role;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_workspace_member(uuid),
  private.has_workspace_role(uuid, public.workspace_role[]),
  private.workspace_is_writable(uuid),
  private.can_write(uuid, public.workspace_role[]),
  private.is_platform_admin(),
  private.is_i18n_text(jsonb),
  private.is_i18n_text_full(jsonb),
  private.try_uuid(text),
  private.object_workspace(text)
  to authenticated;
grant execute on all functions in schema private to service_role;
