-- =============================================================================
-- 0011 · Storage buckets + policies
-- Object paths always start with the workspace id: `<workspace_id>/<...>`.
-- Uploads use signed upload URLs issued by the `api` function after validating plan,
-- size and MIME type; clients get read access only. (Whether signed upload URLs bypass
-- storage RLS entirely = needs verification against current Supabase Storage docs.)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('knowledge-files', 'knowledge-files', false, 20971520,   -- 20 MB
    array['application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain']),
  ('attachments', 'attachments', false, 16777216, null),     -- 16 MB, inbound/outbound media
  ('exports', 'exports', false, null, array['application/zip', 'application/json']),
  ('public-assets', 'public-assets', true, 2097152,          -- logos / bot avatars / widget icons
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create or replace function private.try_uuid(p_value text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;
grant execute on function private.try_uuid(text) to authenticated;

create or replace function private.object_workspace(p_name text)
returns uuid
language sql immutable set search_path = ''
as $$
  select private.try_uuid((storage.foldername(p_name))[1]);
$$;
grant execute on function private.object_workspace(text) to authenticated;

create policy "members read knowledge files" on storage.objects for select to authenticated
  using (bucket_id = 'knowledge-files' and private.is_workspace_member(private.object_workspace(name)));

create policy "members read attachments" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and private.is_workspace_member(private.object_workspace(name)));

create policy "owners read exports" on storage.objects for select to authenticated
  using (bucket_id = 'exports'
         and private.has_workspace_role(private.object_workspace(name), array['owner']::public.workspace_role[]));

-- public-assets bucket is public-read by design (no PII). Writes via `api` function only.
