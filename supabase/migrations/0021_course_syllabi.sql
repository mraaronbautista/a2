-- Course syllabi keep the original upload immutable while extracted text,
-- corrections, and personal/shared notes remain separately editable.

create table course_syllabi (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid not null references auth.users(id) on delete cascade,
  original_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'ready', 'needs_review', 'failed')),
  extraction_method text,
  extracted_text text not null default '',
  edited_text text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index course_syllabi_course_id_idx on course_syllabi(course_id);
create index course_syllabi_household_id_idx on course_syllabi(household_id);

alter table course_syllabi enable row level security;

create policy "select household course syllabi" on course_syllabi
  for select using (is_household_member(household_id));

create policy "insert manageable course syllabi" on course_syllabi
  for insert with check (
    created_by = auth.uid()
    and updated_by = auth.uid()
    and is_household_member(household_id)
    and exists (
      select 1 from courses c where c.id = course_syllabi.course_id
        and c.household_id = course_syllabi.household_id
        and (c.owner_id = auth.uid() or (c.is_shared and is_household_member(c.household_id)))
    )
  );

create policy "update manageable course syllabi" on course_syllabi
  for update using (
    exists (
      select 1 from courses c where c.id = course_syllabi.course_id
        and (c.owner_id = auth.uid() or (c.is_shared and is_household_member(c.household_id)))
    )
  ) with check (updated_by = auth.uid());

create policy "delete manageable course syllabi" on course_syllabi
  for delete using (created_by = auth.uid());

insert into storage.buckets (id, name, public)
values ('syllabi', 'syllabi', false)
on conflict (id) do nothing;

create policy "household members read syllabus files"
  on storage.objects for select
  using (
    bucket_id = 'syllabi'
    and exists (
      select 1 from course_syllabi s
      where s.storage_path = storage.objects.name
        and is_household_member(s.household_id)
    )
  );

create policy "users upload syllabus files to their own folder"
  on storage.objects for insert
  with check (bucket_id = 'syllabi' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "syllabus creators delete original files"
  on storage.objects for delete
  using (bucket_id = 'syllabi' and (storage.foldername(name))[1] = auth.uid()::text);
