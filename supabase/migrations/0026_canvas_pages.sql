-- Phase 4: discrete SVG canvas pages, private reusable signatures, and PDF ink.
alter table notes drop constraint if exists notes_type_check;
alter table notes add constraint notes_type_check check (type in ('case_brief', 'freeform', 'paginated', 'canvas'));

alter table reading_annotations drop constraint if exists reading_annotations_kind_check;
alter table reading_annotations add constraint reading_annotations_kind_check check (kind in ('highlight', 'note', 'ink'));
alter table reading_annotations drop constraint if exists reading_annotations_highlight_requires_anchor;
-- Phase 2 briefly allowed text-note rows to retain a selection anchor. Notes
-- remain valid, but anchors are reserved for highlight and ink shapes now.
update reading_annotations set anchor = null where kind = 'note' and anchor is not null;
alter table reading_annotations add constraint reading_annotations_anchor_shape_check check (
  (kind = 'note' and anchor is null) or
  (kind = 'highlight' and quoted_text is not null and quoted_text <> '' and anchor is not null) or
  (kind = 'ink' and quoted_text is null and anchor is not null)
);

create table canvas_pages (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  order_index bigint not null default 1024,
  page_settings jsonb not null,
  elements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index canvas_pages_note_order_idx on canvas_pages(note_id, order_index);

create table canvas_signatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  strokes jsonb not null,
  created_at timestamptz not null default now()
);
create index canvas_signatures_user_idx on canvas_signatures(user_id);

create or replace function public.can_edit_note(p_note_id uuid) returns boolean
language sql security definer set search_path=public stable as $$
  select exists(select 1 from notes n where n.id=p_note_id and (n.owner_id=auth.uid() or (n.visibility='shared' and is_household_member(n.household_id))));
$$;

alter table canvas_pages enable row level security;
create policy "select accessible canvas pages" on canvas_pages for select using (can_access_note(note_id));
create policy "insert editable canvas pages" on canvas_pages for insert with check (can_edit_note(note_id));
create policy "update editable canvas pages" on canvas_pages for update using (can_edit_note(note_id)) with check (can_edit_note(note_id));

alter table canvas_signatures enable row level security;
create policy "manage own canvas signatures" on canvas_signatures for all using (user_id=auth.uid()) with check (user_id=auth.uid());

create or replace function public.create_canvas_note(p_household_id uuid,p_course_id uuid,p_title text,p_visibility text,p_page_settings jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare v_note uuid; begin
  if not is_household_member(p_household_id) or p_visibility not in ('private','shared') then raise exception 'invalid canvas note'; end if;
  if p_course_id is not null and not exists(select 1 from courses where id=p_course_id and household_id=p_household_id) then raise exception 'invalid course'; end if;
  insert into notes(household_id,owner_id,course_id,type,title,visibility,space,content,page_settings)
  values(p_household_id,auth.uid(),p_course_id,'canvas',trim(p_title),p_visibility,'law',null,null) returning id into v_note;
  insert into canvas_pages(note_id,page_settings) values(v_note,p_page_settings); return v_note;
end; $$;

create or replace function public.duplicate_canvas_page(target_page_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$ declare v canvas_pages%rowtype; v_next bigint; v_order bigint; v_id uuid; v_elements jsonb; begin
  select * into v from canvas_pages where id=target_page_id; if v.id is null or not can_edit_note(v.note_id) then raise exception 'page not editable'; end if;
  select min(order_index) into v_next from canvas_pages where note_id=v.note_id and order_index>v.order_index;
  v_order:=midpoint_order_index(v.order_index,v_next);
  if v_order is null then update canvas_pages p set order_index=x.rn*1024 from (select id,row_number() over(order by order_index) rn from canvas_pages where note_id=v.note_id) x where p.id=x.id;
    select order_index into v.order_index from canvas_pages where id=v.id; select min(order_index) into v_next from canvas_pages where note_id=v.note_id and order_index>v.order_index; v_order:=midpoint_order_index(v.order_index,v_next); end if;
  select coalesce(jsonb_agg(value || jsonb_build_object('id',gen_random_uuid())),'[]'::jsonb) into v_elements from jsonb_array_elements(v.elements);
  insert into canvas_pages(note_id,order_index,page_settings,elements) values(v.note_id,v_order,v.page_settings,v_elements) returning id into v_id; return v_id;
end; $$;

create or replace function public.delete_canvas_page(target_page_id uuid) returns void
language plpgsql security definer set search_path=public as $$ declare v_note uuid; v_count int; begin
  select note_id into v_note from canvas_pages where id=target_page_id; if v_note is null or not can_edit_note(v_note) then raise exception 'page not editable'; end if;
  select count(*) into v_count from canvas_pages where note_id=v_note; if v_count<=1 then raise exception 'cannot delete only page'; end if; delete from canvas_pages where id=target_page_id;
end; $$;

create or replace function public.reorder_canvas_page(target_page_id uuid,before_id uuid,after_id uuid) returns void
language plpgsql security definer set search_path=public as $$ declare v_note uuid; v_before bigint; v_after bigint; v_order bigint; begin
  select note_id into v_note from canvas_pages where id=target_page_id; if v_note is null or not can_edit_note(v_note) then raise exception 'page not editable'; end if;
  select order_index into v_before from canvas_pages where id=before_id and note_id=v_note; select order_index into v_after from canvas_pages where id=after_id and note_id=v_note; v_order:=midpoint_order_index(v_before,v_after);
  if v_order is null then update canvas_pages p set order_index=x.rn*1024 from (select id,row_number() over(order by order_index) rn from canvas_pages where note_id=v_note) x where p.id=x.id;
    select order_index into v_before from canvas_pages where id=before_id; select order_index into v_after from canvas_pages where id=after_id; v_order:=midpoint_order_index(v_before,v_after); end if;
  update canvas_pages set order_index=v_order,updated_at=now() where id=target_page_id;
end; $$;
