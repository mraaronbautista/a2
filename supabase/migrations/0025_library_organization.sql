-- Phase 3: notebooks, sections, filing references, archive, and per-user library state.
alter table notes add column archived_at timestamptz, add column search_text text not null default '';
alter table reading_items add column archived_at timestamptz;
alter table reading_progress add column is_favorite boolean not null default false, add column last_opened_at timestamptz;

create table notebooks (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, course_id uuid references courses(id) on delete set null,
  space text not null check (space in ('law','personal')), name text not null check (char_length(trim(name)) between 1 and 100),
  description text not null default '', visibility text not null default 'shared' check (visibility in ('private','shared')),
  cover jsonb not null default '{"color":"#5b6478","pattern":"plain","icon":null}'::jsonb,
  order_index bigint not null default 1024, archived_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), constraint notebooks_personal_no_course check (space = 'law' or course_id is null)
);
create index notebooks_household_idx on notebooks(household_id);
create index notebooks_household_space_archived_idx on notebooks(household_id,space,archived_at);
create index notebooks_course_idx on notebooks(course_id);

create table notebook_sections (
  id uuid primary key default gen_random_uuid(), notebook_id uuid not null references notebooks(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100), color text, order_index bigint not null default 1024,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index notebook_sections_order_idx on notebook_sections(notebook_id,order_index);

create table library_entries (
  id uuid primary key default gen_random_uuid(), section_id uuid not null references notebook_sections(id) on delete cascade,
  note_id uuid references notes(id) on delete cascade, reading_item_id uuid references reading_items(id) on delete cascade,
  order_index bigint not null default 1024, created_at timestamptz not null default now(),
  constraint library_entries_one_target check (num_nonnulls(note_id,reading_item_id)=1)
);
create unique index library_entries_note_unique_idx on library_entries(note_id) where note_id is not null;
create unique index library_entries_reading_unique_idx on library_entries(reading_item_id) where reading_item_id is not null;
create index library_entries_section_order_idx on library_entries(section_id,order_index);

create table notebook_user_state (
  notebook_id uuid not null references notebooks(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  is_favorite boolean not null default false, last_opened_at timestamptz, updated_at timestamptz not null default now(),
  primary key(notebook_id,user_id)
);
create table note_user_state (
  note_id uuid not null references notes(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  is_favorite boolean not null default false, last_opened_at timestamptz, updated_at timestamptz not null default now(),
  primary key(note_id,user_id)
);

create or replace function public.can_access_notebook(p_notebook_id uuid) returns boolean
language sql security definer set search_path=public stable as $$ select exists(select 1 from notebooks n where n.id=p_notebook_id and is_household_member(n.household_id) and (n.visibility='shared' or n.owner_id=auth.uid())); $$;
create or replace function public.can_manage_notebook(p_notebook_id uuid) returns boolean
language sql security definer set search_path=public stable as $$ select exists(select 1 from notebooks n where n.id=p_notebook_id and (n.owner_id=auth.uid() or (n.visibility='shared' and is_household_member(n.household_id)))); $$;
create or replace function public.can_access_section(p_section_id uuid) returns boolean
language sql security definer set search_path=public stable as $$ select exists(select 1 from notebook_sections s where s.id=p_section_id and can_access_notebook(s.notebook_id)); $$;
create or replace function public.can_manage_section(p_section_id uuid) returns boolean
language sql security definer set search_path=public stable as $$ select exists(select 1 from notebook_sections s where s.id=p_section_id and can_manage_notebook(s.notebook_id)); $$;

alter table notebooks enable row level security;
create policy "select accessible notebooks" on notebooks for select using (is_household_member(household_id) and (visibility='shared' or owner_id=auth.uid()));
create policy "insert own notebooks" on notebooks for insert with check (owner_id=auth.uid() and is_household_member(household_id) and (course_id is null or exists(select 1 from courses c where c.id=notebooks.course_id and c.household_id=notebooks.household_id)));
create policy "manage own or shared notebooks" on notebooks for update using (can_manage_notebook(id)) with check (can_manage_notebook(id));
create policy "delete manageable notebooks" on notebooks for delete using (can_manage_notebook(id));
alter table notebook_sections enable row level security;
create policy "select accessible sections" on notebook_sections for select using (can_access_notebook(notebook_id));
create policy "insert sections into manageable notebooks" on notebook_sections for insert with check (can_manage_notebook(notebook_id));
create policy "manage sections of manageable notebooks" on notebook_sections for update using (can_manage_notebook(notebook_id)) with check (can_manage_notebook(notebook_id));
alter table library_entries enable row level security;
create policy "select accessible library entries" on library_entries for select using (can_access_section(section_id));
alter table notebook_user_state enable row level security;
create policy "manage own notebook state" on notebook_user_state for all using(user_id=auth.uid() and can_access_notebook(notebook_id)) with check(user_id=auth.uid() and can_access_notebook(notebook_id));
alter table note_user_state enable row level security;
create policy "manage own note state" on note_user_state for all using(user_id=auth.uid() and can_access_note(note_id)) with check(user_id=auth.uid() and can_access_note(note_id));

create or replace function public.midpoint_order_index(p_before bigint,p_after bigint) returns bigint language sql immutable as $$
select case when p_before is null and p_after is null then 1024 when p_before is null then p_after/2 when p_after is null then p_before+1024 when p_after-p_before>1 then p_before+(p_after-p_before)/2 else null end; $$;

create or replace function public.create_notebook_with_section(p_household_id uuid,p_course_id uuid,p_space text,p_name text,p_description text,p_visibility text,p_cover jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare v_id uuid; begin
if not is_household_member(p_household_id) then raise exception 'not a member of this household'; end if;
if p_space not in ('law','personal') or p_visibility not in ('private','shared') then raise exception 'invalid notebook settings'; end if;
if p_course_id is not null and (p_space<>'law' or not exists(select 1 from courses c where c.id=p_course_id and c.household_id=p_household_id)) then raise exception 'course must belong to the same household and law space'; end if;
insert into notebooks(household_id,owner_id,course_id,space,name,description,visibility,cover) values(p_household_id,auth.uid(),p_course_id,p_space,trim(p_name),coalesce(p_description,''),p_visibility,p_cover) returning id into v_id;
insert into notebook_sections(notebook_id,name,order_index) values(v_id,'General',1024); return v_id; end; $$;

create or replace function public.file_note(target_note_id uuid,target_section_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$ declare v_book notebooks%rowtype; v_note notes%rowtype; v_id uuid; v_order bigint; begin
if not can_manage_section(target_section_id) or not can_access_note(target_note_id) then raise exception 'item or section is not accessible'; end if;
select n.* into v_book from notebook_sections s join notebooks n on n.id=s.notebook_id where s.id=target_section_id;
select * into v_note from notes where id=target_note_id;
if v_note.space<>v_book.space then raise exception 'note space does not match notebook space'; end if;
if v_book.visibility='private' and (v_note.visibility<>'private' or v_note.owner_id<>v_book.owner_id) then raise exception 'private notebook requires an owner private note'; end if;
if v_book.visibility='shared' and v_note.visibility<>'shared' then raise exception 'shared notebook requires a shared note'; end if;
select coalesce(max(order_index),0)+1024 into v_order from library_entries where section_id=target_section_id;
insert into library_entries(section_id,note_id,order_index) values(target_section_id,target_note_id,v_order)
on conflict(note_id) where note_id is not null do update set section_id=excluded.section_id,order_index=excluded.order_index returning id into v_id; return v_id; end; $$;

create or replace function public.file_reading(target_reading_id uuid,target_section_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$ declare v_book notebooks%rowtype; v_course courses%rowtype; v_id uuid; v_order bigint; begin
if not can_manage_section(target_section_id) or not can_access_reading(target_reading_id) then raise exception 'item or section is not accessible'; end if;
select n.* into v_book from notebook_sections s join notebooks n on n.id=s.notebook_id where s.id=target_section_id;
select c.* into v_course from reading_items r join courses c on c.id=r.course_id where r.id=target_reading_id;
if v_book.space<>'law' or v_book.visibility='private' or not v_course.is_shared then raise exception 'reading is incompatible with notebook'; end if;
select coalesce(max(order_index),0)+1024 into v_order from library_entries where section_id=target_section_id;
insert into library_entries(section_id,reading_item_id,order_index) values(target_section_id,target_reading_id,v_order)
on conflict(reading_item_id) where reading_item_id is not null do update set section_id=excluded.section_id,order_index=excluded.order_index returning id into v_id; return v_id; end; $$;

create or replace function public.move_library_entry(target_entry_id uuid,target_section_id uuid) returns void language plpgsql security definer set search_path=public as $$ declare v library_entries%rowtype; begin select * into v from library_entries where id=target_entry_id; if v.id is null or not can_manage_section(v.section_id) then raise exception 'entry not manageable'; end if; if v.note_id is not null then perform file_note(v.note_id,target_section_id); else perform file_reading(v.reading_item_id,target_section_id); end if; end; $$;
create or replace function public.remove_library_entry(target_entry_id uuid) returns void language plpgsql security definer set search_path=public as $$ declare v_section uuid; begin select section_id into v_section from library_entries where id=target_entry_id; if v_section is null or not can_manage_section(v_section) then raise exception 'entry not manageable'; end if; delete from library_entries where id=target_entry_id; end; $$;
create or replace function public.delete_section_unfile(target_section_id uuid) returns void language plpgsql security definer set search_path=public as $$ declare v_book uuid; v_count int; begin select notebook_id into v_book from notebook_sections where id=target_section_id; if v_book is null or not can_manage_notebook(v_book) then raise exception 'section not manageable'; end if; select count(*) into v_count from notebook_sections where notebook_id=v_book; if v_count<=1 then raise exception 'cannot delete only section'; end if; delete from library_entries where section_id=target_section_id; delete from notebook_sections where id=target_section_id; end; $$;
create or replace function public.delete_notebook_unfile(target_notebook_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not can_manage_notebook(target_notebook_id) then raise exception 'notebook not manageable'; end if; delete from notebooks where id=target_notebook_id; end; $$;

create or replace function public.reorder_library_entry(target_entry_id uuid,before_id uuid,after_id uuid) returns void language plpgsql security definer set search_path=public as $$ declare v_parent uuid; v_before bigint; v_after bigint; v_new bigint; begin select section_id into v_parent from library_entries where id=target_entry_id; if v_parent is null or not can_manage_section(v_parent) then raise exception 'entry not manageable'; end if; select order_index into v_before from library_entries where id=before_id and section_id=v_parent; select order_index into v_after from library_entries where id=after_id and section_id=v_parent; v_new:=midpoint_order_index(v_before,v_after); if v_new is null then with ranked as(select id,row_number() over(order by order_index) rn from library_entries where section_id=v_parent) update library_entries e set order_index=ranked.rn*1024 from ranked where ranked.id=e.id; select order_index into v_before from library_entries where id=before_id; select order_index into v_after from library_entries where id=after_id; v_new:=midpoint_order_index(v_before,v_after); end if; update library_entries set order_index=v_new where id=target_entry_id; end; $$;
create or replace function public.reorder_notebook(target_notebook_id uuid,before_id uuid,after_id uuid) returns void language plpgsql security definer set search_path=public as $$ declare v_house uuid; v_space text; v_before bigint; v_after bigint; v_new bigint; begin select household_id,space into v_house,v_space from notebooks where id=target_notebook_id; if v_house is null or not can_manage_notebook(target_notebook_id) then raise exception 'notebook not manageable'; end if; select order_index into v_before from notebooks where id=before_id and household_id=v_house and space=v_space; select order_index into v_after from notebooks where id=after_id and household_id=v_house and space=v_space; v_new:=midpoint_order_index(v_before,v_after); if v_new is null then with ranked as(select id,row_number() over(order by order_index) rn from notebooks where household_id=v_house and space=v_space) update notebooks n set order_index=ranked.rn*1024 from ranked where ranked.id=n.id; select order_index into v_before from notebooks where id=before_id; select order_index into v_after from notebooks where id=after_id; v_new:=midpoint_order_index(v_before,v_after); end if; update notebooks set order_index=v_new,updated_at=now() where id=target_notebook_id; end; $$;
create or replace function public.reorder_section(target_section_id uuid,before_id uuid,after_id uuid) returns void language plpgsql security definer set search_path=public as $$ declare v_parent uuid; v_before bigint; v_after bigint; v_new bigint; begin select notebook_id into v_parent from notebook_sections where id=target_section_id; if v_parent is null or not can_manage_notebook(v_parent) then raise exception 'section not manageable'; end if; select order_index into v_before from notebook_sections where id=before_id and notebook_id=v_parent; select order_index into v_after from notebook_sections where id=after_id and notebook_id=v_parent; v_new:=midpoint_order_index(v_before,v_after); if v_new is null then with ranked as(select id,row_number() over(order by order_index) rn from notebook_sections where notebook_id=v_parent) update notebook_sections s set order_index=ranked.rn*1024 from ranked where ranked.id=s.id; select order_index into v_before from notebook_sections where id=before_id; select order_index into v_after from notebook_sections where id=after_id; v_new:=midpoint_order_index(v_before,v_after); end if; update notebook_sections set order_index=v_new,updated_at=now() where id=target_section_id; end; $$;
