-- Keep helper functions out of the exposed API schema and merge overlapping
-- permissive SELECT policies (Supabase advisor 0028/0029/0006).

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create schema if not exists private;
grant usage on schema private to authenticated;

create function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'manager'
  );
$$;

revoke execute on function private.is_manager() from public, anon;
grant execute on function private.is_manager() to authenticated;

-- public.documents
drop policy "Managers manage documents" on public.documents;
drop policy "Employees read assigned documents" on public.documents;

create policy "Managers and assignees read documents"
  on public.documents for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.assignments a
      where a.document_id = documents.id
        and a.employee_id = (select auth.uid())
    )
  );

create policy "Managers insert documents"
  on public.documents for insert to authenticated
  with check ((select private.is_manager()));

create policy "Managers update documents"
  on public.documents for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy "Managers delete documents"
  on public.documents for delete to authenticated
  using ((select private.is_manager()));

-- public.assignments
drop policy "Managers manage assignments" on public.assignments;
drop policy "Employees read own assignments" on public.assignments;

create policy "Managers and owners read assignments"
  on public.assignments for select to authenticated
  using (employee_id = (select auth.uid()) or (select private.is_manager()));

create policy "Managers insert assignments"
  on public.assignments for insert to authenticated
  with check ((select private.is_manager()));

create policy "Managers update assignments"
  on public.assignments for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy "Managers delete assignments"
  on public.assignments for delete to authenticated
  using ((select private.is_manager()));

-- public.profiles
drop policy "Users read own profile, managers read all" on public.profiles;

create policy "Users read own profile, managers read all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_manager()));

-- storage.objects
drop policy "Managers upload documents" on storage.objects;
drop policy "Managers delete documents" on storage.objects;
drop policy "Managers and assignees read documents" on storage.objects;
drop policy "Owners and managers read signed copies" on storage.objects;

create policy "Managers upload documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (select private.is_manager()));

create policy "Managers delete documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (select private.is_manager()));

create policy "Managers and assignees read documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (select private.is_manager())
      or exists (
        select 1 from public.documents d
        join public.assignments a on a.document_id = d.id
        where d.file_path = storage.objects.name
          and a.employee_id = (select auth.uid())
      )
    )
  );

create policy "Owners and managers read signed copies"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'signed'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_manager())
    )
  );

drop function public.is_manager();
