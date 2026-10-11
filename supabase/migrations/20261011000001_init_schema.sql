-- Roles, documents and per-employee signing assignments.

create type public.user_role as enum ('employee', 'manager');
create type public.assignment_status as enum ('pending', 'signed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'employee',
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_path text not null unique,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  status public.assignment_status not null default 'pending',
  signed_file_path text,
  signer_name text,
  signed_at timestamptz,
  assigned_at timestamptz not null default now(),
  unique (document_id, employee_id)
);

create index assignments_employee_id_idx on public.assignments (employee_id);
create index documents_uploaded_by_idx on public.documents (uploaded_by);

-- Create a profile for every new auth user. Everyone starts as an employee;
-- managers are promoted directly in the database.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_manager()
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

revoke execute on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated;

-- Employees mark their own pending assignment as signed. Timestamp and signer
-- name come from the server, and the signed file must live in the caller's folder.
create function public.sign_assignment(p_assignment_id uuid)
returns public.assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.assignments;
begin
  update public.assignments a
  set status = 'signed',
      signed_at = now(),
      signed_file_path = v_uid::text || '/' || a.id::text || '.pdf',
      signer_name = (select p.full_name from public.profiles p where p.id = v_uid)
  where a.id = p_assignment_id
    and a.employee_id = v_uid
    and a.status = 'pending'
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'signed'
        and o.name = v_uid::text || '/' || a.id::text || '.pdf'
    )
  returning a.* into v_row;

  if v_row.id is null then
    raise exception 'Assignment not found, already signed, or signed file missing';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.sign_assignment(uuid) from public, anon;
grant execute on function public.sign_assignment(uuid) to authenticated;

-- Row level security
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.assignments enable row level security;

create policy "Users read own profile, managers read all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_manager()));

create policy "Managers manage documents"
  on public.documents for all to authenticated
  using ((select public.is_manager()))
  with check ((select public.is_manager()));

create policy "Employees read assigned documents"
  on public.documents for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.document_id = documents.id
        and a.employee_id = (select auth.uid())
    )
  );

create policy "Managers manage assignments"
  on public.assignments for all to authenticated
  using ((select public.is_manager()))
  with check ((select public.is_manager()));

create policy "Employees read own assignments"
  on public.assignments for select to authenticated
  using (employee_id = (select auth.uid()));

-- Storage: originals in `documents`, signed copies in `signed/{employee_id}/{assignment_id}.pdf`
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 10485760, array['application/pdf']),
  ('signed', 'signed', false, 10485760, array['application/pdf']);

create policy "Managers upload documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (select public.is_manager()));

create policy "Managers delete documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (select public.is_manager()));

create policy "Managers and assignees read documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (select public.is_manager())
      or exists (
        select 1 from public.documents d
        join public.assignments a on a.document_id = d.id
        where d.file_path = storage.objects.name
          and a.employee_id = (select auth.uid())
      )
    )
  );

create policy "Employees upload signed copy of pending assignment"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'signed'
    and exists (
      select 1 from public.assignments a
      where a.employee_id = (select auth.uid())
        and a.status = 'pending'
        and storage.objects.name = a.employee_id::text || '/' || a.id::text || '.pdf'
    )
  );

create policy "Employees replace signed copy of pending assignment"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'signed'
    and exists (
      select 1 from public.assignments a
      where a.employee_id = (select auth.uid())
        and a.status = 'pending'
        and storage.objects.name = a.employee_id::text || '/' || a.id::text || '.pdf'
    )
  );

create policy "Owners and managers read signed copies"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'signed'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_manager())
    )
  );
