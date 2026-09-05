-- Phase 2: private PDF course readings with independent per-user state.
alter table reading_items add column storage_path text unique, add column original_name text,
  add column mime_type text, add column size_bytes bigint;
alter table reading_items
  add constraint reading_items_mime_type_check check (mime_type is null or mime_type = 'application/pdf'),
  add constraint reading_items_size_bytes_check check (size_bytes is null or size_bytes between 0 and 52428800),
  add constraint reading_items_file_metadata_all_or_none check (
    (storage_path is null and original_name is null and mime_type is null and size_bytes is null)
    or (storage_path is not null and original_name is not null and mime_type is not null and size_bytes is not null)
  );

create or replace function public.can_access_reading(p_reading_item_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from reading_items r join courses c on c.id = r.course_id
    where r.id = p_reading_item_id and is_household_member(c.household_id));
$$;
create or replace function public.can_manage_course(p_course_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from courses c where c.id = p_course_id
    and (c.owner_id = auth.uid() or (c.is_shared and is_household_member(c.household_id))));
$$;
create or replace function public.can_access_note(p_note_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from notes n where n.id = p_note_id and is_household_member(n.household_id)
    and (n.visibility = 'shared' or n.owner_id = auth.uid()));
$$;

create table reading_progress (
  reading_item_id uuid not null references reading_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_number integer not null default 1 check (page_number >= 1),
  page_count integer check (page_count is null or page_count >= 1),
  zoom_mode text not null default 'fit-width' check (zoom_mode in ('fit-width', 'fit-page', 'custom')),
  zoom_value numeric(4,2) not null default 1.00 check (zoom_value between 0.50 and 3.00),
  view_mode text not null default 'page' check (view_mode in ('page', 'reflow')),
  updated_at timestamptz not null default now(), primary key (reading_item_id, user_id)
);
alter table reading_progress enable row level security;
create policy "manage own reading progress" on reading_progress for all
  using (user_id = auth.uid() and can_access_reading(reading_item_id))
  with check (user_id = auth.uid() and can_access_reading(reading_item_id));

create table reading_bookmarks (
  id uuid primary key default gen_random_uuid(), reading_item_id uuid not null references reading_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, page_number integer not null check (page_number >= 1),
  label text not null default '', created_at timestamptz not null default now(), unique (reading_item_id, user_id, page_number)
);
create index reading_bookmarks_lookup_idx on reading_bookmarks(reading_item_id, user_id, page_number);
alter table reading_bookmarks enable row level security;
create policy "manage own reading bookmarks" on reading_bookmarks for all
  using (user_id = auth.uid() and can_access_reading(reading_item_id))
  with check (user_id = auth.uid() and can_access_reading(reading_item_id));

create table reading_annotations (
  id uuid primary key default gen_random_uuid(), reading_item_id uuid not null references reading_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, page_number integer not null check (page_number >= 1),
  kind text not null check (kind in ('highlight', 'note')), color text not null default 'yellow'
    check (color in ('yellow', 'green', 'blue', 'pink', 'purple')), quoted_text text, body text not null default '', anchor jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint reading_annotations_highlight_requires_anchor check (
    kind = 'note' or (quoted_text is not null and quoted_text <> '' and anchor is not null)
  )
);
create index reading_annotations_lookup_idx on reading_annotations(reading_item_id, user_id, page_number);
create index reading_annotations_recent_idx on reading_annotations(user_id, updated_at desc);
alter table reading_annotations enable row level security;
create policy "manage own reading annotations" on reading_annotations for all
  using (user_id = auth.uid() and can_access_reading(reading_item_id))
  with check (user_id = auth.uid() and can_access_reading(reading_item_id));

create table reading_note_links (
  id uuid primary key default gen_random_uuid(), reading_item_id uuid not null references reading_items(id) on delete cascade,
  note_id uuid not null references notes(id) on delete cascade, page_number integer not null check (page_number >= 1),
  quoted_text text, annotation_id uuid references reading_annotations(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(),
  unique (reading_item_id, note_id)
);
alter table reading_note_links enable row level security;
create policy "select accessible reading note links" on reading_note_links for select
  using (can_access_reading(reading_item_id) and can_access_note(note_id));
create policy "insert accessible reading note links" on reading_note_links for insert
  with check (created_by = auth.uid() and can_access_reading(reading_item_id) and can_access_note(note_id));
create policy "delete manageable reading note links" on reading_note_links for delete using (
  created_by = auth.uid() or exists (select 1 from notes n where n.id = reading_note_links.note_id and n.owner_id = auth.uid())
  or exists (select 1 from reading_items r where r.id = reading_note_links.reading_item_id and can_manage_course(r.course_id))
);

create or replace function public.create_reading_linked_note(
  p_reading_item_id uuid, p_page_number integer, p_quoted_text text, p_annotation_id uuid,
  p_title text, p_visibility text, p_content jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_course_id uuid; v_household_id uuid; v_note_id uuid;
begin
  if not can_access_reading(p_reading_item_id) then raise exception 'reading not found or not accessible'; end if;
  if p_page_number < 1 then raise exception 'invalid page number'; end if;
  if p_visibility not in ('private', 'shared') then raise exception 'invalid visibility'; end if;
  select r.course_id, c.household_id into v_course_id, v_household_id from reading_items r
    join courses c on c.id = r.course_id where r.id = p_reading_item_id;
  if p_annotation_id is not null and not exists (select 1 from reading_annotations a
    where a.id = p_annotation_id and a.reading_item_id = p_reading_item_id and a.user_id = auth.uid())
    then raise exception 'annotation not found or not owned by caller'; end if;
  insert into notes (household_id, owner_id, course_id, type, title, content, visibility, space)
    values (v_household_id, auth.uid(), v_course_id, 'freeform', p_title, p_content, p_visibility, 'law') returning id into v_note_id;
  insert into reading_note_links (reading_item_id, note_id, page_number, quoted_text, annotation_id, created_by)
    values (p_reading_item_id, v_note_id, p_page_number, p_quoted_text, p_annotation_id, auth.uid());
  return v_note_id;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reading-files', 'reading-files', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy "select readable reading files" on storage.objects for select using (
  bucket_id = 'reading-files' and exists (select 1 from reading_items r
    where r.storage_path = storage.objects.name and can_access_reading(r.id))
);
create policy "insert own reading files" on storage.objects for insert with check (
  bucket_id = 'reading-files' and (storage.foldername(name))[1] = auth.uid()::text
  and can_manage_course(((storage.foldername(name))[2])::uuid)
);
create policy "delete manageable reading files" on storage.objects for delete using (
  bucket_id = 'reading-files' and exists (select 1 from reading_items r
    where r.storage_path = storage.objects.name and can_manage_course(r.course_id))
);
