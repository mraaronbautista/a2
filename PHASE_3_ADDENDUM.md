# Phase 3 Addendum: Resolved Decisions and Ready-to-Paste Artifacts

This addendum sits on top of `PHASE_3_IMPLEMENTATION_PLAN.md`, which remains authoritative for all
UX/behavior detail not overridden below (notebook screen layout, responsive rules, loading/error
copy, accessibility, the exact required-files list, batch commit messages). This file resolves every
place where the plan's assumptions don't match what's actually in the repo, and hands over final SQL,
type patches, and locked interfaces so no implementer has to re-derive them.

## 0. Precondition status — read this first

**Phase 3 cannot start yet.** The plan's own preconditions require "Phase 2 is committed and `npm run
build` passes." As of this writing, Phase 2 exists only as a plan
(`PHASE_2_IMPLEMENTATION_PLAN.md` + `PHASE_2_ADDENDUM.md`) — no Phase 2 code has been committed. Do
not begin Phase 3 batches until Phase 2's 9 commits land. This addendum is written now so it's ready
the moment that happens; it assumes Phase 2 ships exactly as `PHASE_2_ADDENDUM.md` specifies
(migration `0024_pdf_reading_workspace.sql`, `reading_progress` with `zoom_mode`/`zoom_value`/
`view_mode`, `reading_annotations`, `can_access_reading`/`can_manage_course`/`can_access_note` helper
functions). If Phase 2 ships differently, the SQL in Section 2 below needs re-checking against
whatever actually landed before use.

**Migration number**: Phase 1 is `0023_paginated_notes.sql` (already committed — confirmed). Phase 2
is `0024_pdf_reading_workspace.sql` (per its addendum). Phase 3 is therefore
**`0025_library_organization.sql`**, contingent on Phase 2 actually landing as `0024`.

## 1. Resolved decisions summary

- **Paper backgrounds already exist from Phase 1** under a different name than this plan assumes.
  Extend the existing mechanism; do not add a second, competing one. See Section 4.
- **Phase 1's pagination has no exposed page-navigation API** — page count and break positions are
  internal state in `PaginatedEditor.tsx`, and there is no page-image rendering capability (no
  PDF.js-style discrete page objects, no screenshot library in the stack). Resolved: extend
  `PaginatedEditor` additively with a small new prop surface, and make thumbnails **text previews**,
  not visual renders. See Section 5.
- **Realtime and self-echo**: reuse the existing `useRealtimeRefresh` hook and the existing
  timestamp-window self-echo pattern from `NoteDetail.tsx` verbatim — do not invent a new mechanism.
  See Section 7.
- **Search**: no new Postgres extension. `pg_trgm` is not enabled anywhere in this schema and adding
  it for Phase 3 search would be exactly the kind of adjacent infrastructure change the plan tells you
  not to make. Use plain `ilike` queries; at two-person-household scale this is fine.
- **Section rename/recolor and notebook archive/reorder** go through plain RLS-gated `UPDATE`
  policies, not new security-definer functions — see the reasoning in Section 2's RLS notes. Only the
  operations the plan explicitly calls out (file/move/remove/delete/reorder, i.e. anything that
  touches `library_entries` or deletes a notebook/section) are function-only.
- Phase 3 reuses Phase 2's `can_access_reading` and `can_access_note` helper functions directly rather
  than redefining equivalents.

## 2. Final migration — `supabase/migrations/0025_library_organization.sql`

```sql
-- Phase 3 of the Notes & Reading workspace: notebooks, sections, and filing.
-- Filing stores a reference (library_entries) to an existing note or
-- reading; it never copies or moves the underlying content. Visibility of
-- the filed item never changes as a side effect of filing or moving it.

-- ---------------------------------------------------------------------------
-- Existing-table additions
-- ---------------------------------------------------------------------------

alter table notes
  add column archived_at timestamptz,
  add column search_text text not null default '';

alter table reading_items
  add column archived_at timestamptz;

alter table reading_progress
  add column is_favorite boolean not null default false,
  add column last_opened_at timestamptz;

-- ---------------------------------------------------------------------------
-- notebooks
-- ---------------------------------------------------------------------------

create table notebooks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  space text not null check (space in ('law', 'personal')),
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text not null default '',
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  cover jsonb not null default '{"color":"#5b6478","pattern":"plain","icon":null}'::jsonb,
  order_index bigint not null default 1024,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notebooks_personal_no_course check (space = 'law' or course_id is null)
);

create index notebooks_household_idx on notebooks(household_id);
create index notebooks_household_space_archived_idx on notebooks(household_id, space, archived_at);
create index notebooks_course_idx on notebooks(course_id);

-- ---------------------------------------------------------------------------
-- notebook_sections
-- ---------------------------------------------------------------------------

create table notebook_sections (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  color text,
  order_index bigint not null default 1024,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notebook_sections_order_idx on notebook_sections(notebook_id, order_index);

-- ---------------------------------------------------------------------------
-- library_entries
-- ---------------------------------------------------------------------------

create table library_entries (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references notebook_sections(id) on delete cascade,
  note_id uuid references notes(id) on delete cascade,
  reading_item_id uuid references reading_items(id) on delete cascade,
  order_index bigint not null default 1024,
  created_at timestamptz not null default now(),
  constraint library_entries_one_target check (num_nonnulls(note_id, reading_item_id) = 1)
);

create unique index library_entries_note_unique_idx on library_entries(note_id) where note_id is not null;
create unique index library_entries_reading_unique_idx on library_entries(reading_item_id) where reading_item_id is not null;
create index library_entries_section_order_idx on library_entries(section_id, order_index);

-- ---------------------------------------------------------------------------
-- Per-user state
-- ---------------------------------------------------------------------------

create table notebook_user_state (
  notebook_id uuid not null references notebooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_favorite boolean not null default false,
  last_opened_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (notebook_id, user_id)
);

create table note_user_state (
  note_id uuid not null references notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_favorite boolean not null default false,
  last_opened_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER, same pattern as is_household_member /
-- Phase 2's can_access_reading / can_access_note, which this migration reuses
-- directly rather than redefining).
-- ---------------------------------------------------------------------------

create or replace function public.can_access_notebook(p_notebook_id uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from notebooks n
    where n.id = p_notebook_id
      and is_household_member(n.household_id)
      and (n.visibility = 'shared' or n.owner_id = auth.uid())
  );
$$;

create or replace function public.can_manage_notebook(p_notebook_id uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from notebooks n
    where n.id = p_notebook_id
      and (n.owner_id = auth.uid() or (n.visibility = 'shared' and is_household_member(n.household_id)))
  );
$$;

create or replace function public.can_access_section(p_section_id uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from notebook_sections s
    where s.id = p_section_id and can_access_notebook(s.notebook_id)
  );
$$;

create or replace function public.can_manage_section(p_section_id uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from notebook_sections s
    where s.id = p_section_id and can_manage_notebook(s.notebook_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: notebooks
-- ---------------------------------------------------------------------------

alter table notebooks enable row level security;

create policy "select accessible notebooks" on notebooks
  for select using (is_household_member(household_id) and (visibility = 'shared' or owner_id = auth.uid()));

create policy "insert own notebooks" on notebooks
  for insert with check (
    owner_id = auth.uid()
    and is_household_member(household_id)
    and (course_id is null or exists (
      select 1 from courses c where c.id = notebooks.course_id and c.household_id = notebooks.household_id
    ))
  );

-- Rename/describe/recolor/reorder/archive/restore/visibility all go through
-- this one plain policy rather than dedicated functions: unlike filing
-- (which decides whether a *different* item may cross into this notebook,
-- the real security-relevant check), these fields only ever affect a
-- notebook's own row, so there is no cross-tenant boundary for a function
-- to enforce beyond what can_manage_notebook already gates.
create policy "manage own or shared notebooks" on notebooks
  for update using (can_manage_notebook(id)) with check (can_manage_notebook(id));

create policy "delete manageable notebooks" on notebooks
  for delete using (can_manage_notebook(id));

-- ---------------------------------------------------------------------------
-- RLS: notebook_sections
-- ---------------------------------------------------------------------------

alter table notebook_sections enable row level security;

create policy "select accessible sections" on notebook_sections
  for select using (can_access_notebook(notebook_id));

create policy "insert sections into manageable notebooks" on notebook_sections
  for insert with check (can_manage_notebook(notebook_id));

create policy "manage sections of manageable notebooks" on notebook_sections
  for update using (can_manage_notebook(notebook_id)) with check (can_manage_notebook(notebook_id));

-- No delete policy: notebook_sections may only be removed via
-- delete_section_unfile(), which also unfiles its entries and rejects
-- deleting a notebook's only section.

-- ---------------------------------------------------------------------------
-- RLS: library_entries (function-only mutation — this is where the real
-- visibility/space/household validation lives, so it is never trusted to
-- the client or to a plain RLS predicate)
-- ---------------------------------------------------------------------------

alter table library_entries enable row level security;

create policy "select accessible library entries" on library_entries
  for select using (can_access_section(section_id));

-- No insert/update/delete policy: all mutations go through file_note,
-- file_reading, move_library_entry, remove_library_entry, and
-- reorder_library_entry below.

-- ---------------------------------------------------------------------------
-- RLS: per-user state
-- ---------------------------------------------------------------------------

alter table notebook_user_state enable row level security;
create policy "manage own notebook state" on notebook_user_state
  for all using (user_id = auth.uid() and can_access_notebook(notebook_id))
  with check (user_id = auth.uid() and can_access_notebook(notebook_id));

alter table note_user_state enable row level security;
create policy "manage own note state" on note_user_state
  for all using (user_id = auth.uid() and can_access_note(note_id))
  with check (user_id = auth.uid() and can_access_note(note_id));

-- ---------------------------------------------------------------------------
-- Ordering helper: bigint midpoint, null when siblings need rebalancing
-- ---------------------------------------------------------------------------

create or replace function public.midpoint_order_index(p_before bigint, p_after bigint)
returns bigint
language sql immutable as $$
  select case
    when p_before is null and p_after is null then 1024
    when p_before is null then p_after / 2
    when p_after is null then p_before + 1024
    when p_after - p_before > 1 then p_before + (p_after - p_before) / 2
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- create_notebook_with_section
-- ---------------------------------------------------------------------------

create or replace function public.create_notebook_with_section(
  p_household_id uuid,
  p_course_id uuid,
  p_space text,
  p_name text,
  p_description text,
  p_visibility text,
  p_cover jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_notebook_id uuid;
begin
  if not is_household_member(p_household_id) then
    raise exception 'not a member of this household';
  end if;
  if p_course_id is not null and (
    p_space <> 'law' or not exists (select 1 from courses c where c.id = p_course_id and c.household_id = p_household_id)
  ) then
    raise exception 'course must belong to the same household and space must be law';
  end if;

  insert into notebooks (household_id, owner_id, course_id, space, name, description, visibility, cover)
  values (p_household_id, auth.uid(), p_course_id, p_space, trim(p_name), coalesce(p_description, ''), p_visibility, p_cover)
  returning id into v_notebook_id;

  insert into notebook_sections (notebook_id, name, order_index)
  values (v_notebook_id, 'General', 1024);

  return v_notebook_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- file_note / file_reading — validated upsert of a single library entry
-- ---------------------------------------------------------------------------

create or replace function public.file_note(target_note_id uuid, target_section_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_notebook notebooks%rowtype;
  v_note notes%rowtype;
  v_entry_id uuid;
  v_next_order bigint;
begin
  if not can_manage_section(target_section_id) then
    raise exception 'section not found or not manageable';
  end if;
  if not can_access_note(target_note_id) then
    raise exception 'note not found or not accessible';
  end if;

  select n.* into v_notebook from notebook_sections s join notebooks n on n.id = s.notebook_id where s.id = target_section_id;
  select * into v_note from notes where id = target_note_id;

  if v_note.space <> v_notebook.space then
    raise exception 'note space does not match notebook space';
  end if;
  if v_notebook.visibility = 'private' and (v_note.visibility <> 'private' or v_note.owner_id <> v_notebook.owner_id) then
    raise exception 'private notebooks only accept private notes owned by the notebook owner';
  end if;
  if v_notebook.visibility = 'shared' and v_note.visibility <> 'shared' then
    raise exception 'shared notebooks only accept shared notes';
  end if;

  select coalesce(max(order_index), 0) + 1024 into v_next_order from library_entries where section_id = target_section_id;

  insert into library_entries (section_id, note_id, order_index)
  values (target_section_id, target_note_id, v_next_order)
  on conflict (note_id) where note_id is not null
    do update set section_id = excluded.section_id, order_index = excluded.order_index
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

create or replace function public.file_reading(target_reading_id uuid, target_section_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_notebook notebooks%rowtype;
  v_course courses%rowtype;
  v_entry_id uuid;
  v_next_order bigint;
begin
  if not can_manage_section(target_section_id) then
    raise exception 'section not found or not manageable';
  end if;
  if not can_access_reading(target_reading_id) then
    raise exception 'reading not found or not accessible';
  end if;

  select n.* into v_notebook from notebook_sections s join notebooks n on n.id = s.notebook_id where s.id = target_section_id;
  select c.* into v_course from reading_items r join courses c on c.id = r.course_id where r.id = target_reading_id;

  if v_notebook.space <> 'law' then
    raise exception 'readings may only be filed into law notebooks';
  end if;
  if v_notebook.visibility = 'private' then
    raise exception 'private notebooks do not accept readings';
  end if;
  if not v_course.is_shared then
    raise exception 'shared notebooks only accept readings from shared courses';
  end if;

  select coalesce(max(order_index), 0) + 1024 into v_next_order from library_entries where section_id = target_section_id;

  insert into library_entries (section_id, reading_item_id, order_index)
  values (target_section_id, target_reading_id, v_next_order)
  on conflict (reading_item_id) where reading_item_id is not null
    do update set section_id = excluded.section_id, order_index = excluded.order_index
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- move_library_entry / remove_library_entry / reorder_library_entry
-- ---------------------------------------------------------------------------

create or replace function public.move_library_entry(target_entry_id uuid, target_section_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_entry library_entries%rowtype;
begin
  select * into v_entry from library_entries where id = target_entry_id;
  if v_entry.id is null or not can_manage_section(v_entry.section_id) then
    raise exception 'entry not found or not manageable';
  end if;

  if v_entry.note_id is not null then
    perform file_note(v_entry.note_id, target_section_id);
  else
    perform file_reading(v_entry.reading_item_id, target_section_id);
  end if;
end;
$$;

create or replace function public.remove_library_entry(target_entry_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_section_id uuid;
begin
  select section_id into v_section_id from library_entries where id = target_entry_id;
  if v_section_id is null or not can_manage_section(v_section_id) then
    raise exception 'entry not found or not manageable';
  end if;
  delete from library_entries where id = target_entry_id;
end;
$$;

create or replace function public.reorder_library_entry(target_entry_id uuid, before_id uuid, after_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_section_id uuid;
  v_before bigint;
  v_after bigint;
  v_new bigint;
begin
  select section_id into v_section_id from library_entries where id = target_entry_id;
  if v_section_id is null or not can_manage_section(v_section_id) then
    raise exception 'entry not found or not manageable';
  end if;

  select order_index into v_before from library_entries where id = before_id and section_id = v_section_id;
  select order_index into v_after from library_entries where id = after_id and section_id = v_section_id;
  v_new := midpoint_order_index(v_before, v_after);

  if v_new is null then
    with ranked as (
      select id, row_number() over (order by order_index) as rn from library_entries where section_id = v_section_id
    )
    update library_entries e set order_index = ranked.rn * 1024 from ranked where ranked.id = e.id;

    select order_index into v_before from library_entries where id = before_id and section_id = v_section_id;
    select order_index into v_after from library_entries where id = after_id and section_id = v_section_id;
    v_new := midpoint_order_index(v_before, v_after);
  end if;

  update library_entries set order_index = v_new where id = target_entry_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_section_unfile / delete_notebook_unfile
-- ---------------------------------------------------------------------------

create or replace function public.delete_section_unfile(target_section_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_notebook_id uuid;
  v_section_count integer;
begin
  select notebook_id into v_notebook_id from notebook_sections where id = target_section_id;
  if v_notebook_id is null or not can_manage_notebook(v_notebook_id) then
    raise exception 'section not found or not manageable';
  end if;

  select count(*) into v_section_count from notebook_sections where notebook_id = v_notebook_id;
  if v_section_count <= 1 then
    raise exception 'cannot delete a notebook''s only section';
  end if;

  delete from library_entries where section_id = target_section_id;
  delete from notebook_sections where id = target_section_id;
end;
$$;

create or replace function public.delete_notebook_unfile(target_notebook_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_manage_notebook(target_notebook_id) then
    raise exception 'notebook not found or not manageable';
  end if;
  -- library_entries and notebook_sections cascade from notebooks via FK;
  -- notes/reading_items referenced by those entries are untouched.
  delete from notebooks where id = target_notebook_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- reorder_notebook / reorder_section
-- ---------------------------------------------------------------------------

create or replace function public.reorder_notebook(target_notebook_id uuid, before_id uuid, after_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_household_id uuid;
  v_space text;
  v_before bigint;
  v_after bigint;
  v_new bigint;
begin
  select household_id, space into v_household_id, v_space from notebooks where id = target_notebook_id;
  if v_household_id is null or not can_manage_notebook(target_notebook_id) then
    raise exception 'notebook not found or not manageable';
  end if;

  select order_index into v_before from notebooks where id = before_id and household_id = v_household_id and space = v_space;
  select order_index into v_after from notebooks where id = after_id and household_id = v_household_id and space = v_space;
  v_new := midpoint_order_index(v_before, v_after);

  if v_new is null then
    with ranked as (
      select id, row_number() over (order by order_index) as rn
      from notebooks where household_id = v_household_id and space = v_space
    )
    update notebooks n set order_index = ranked.rn * 1024 from ranked where ranked.id = n.id;

    select order_index into v_before from notebooks where id = before_id and household_id = v_household_id and space = v_space;
    select order_index into v_after from notebooks where id = after_id and household_id = v_household_id and space = v_space;
    v_new := midpoint_order_index(v_before, v_after);
  end if;

  update notebooks set order_index = v_new, updated_at = now() where id = target_notebook_id;
end;
$$;

create or replace function public.reorder_section(target_section_id uuid, before_id uuid, after_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_notebook_id uuid;
  v_before bigint;
  v_after bigint;
  v_new bigint;
begin
  select notebook_id into v_notebook_id from notebook_sections where id = target_section_id;
  if v_notebook_id is null or not can_manage_notebook(v_notebook_id) then
    raise exception 'section not found or not manageable';
  end if;

  select order_index into v_before from notebook_sections where id = before_id and notebook_id = v_notebook_id;
  select order_index into v_after from notebook_sections where id = after_id and notebook_id = v_notebook_id;
  v_new := midpoint_order_index(v_before, v_after);

  if v_new is null then
    with ranked as (
      select id, row_number() over (order by order_index) as rn from notebook_sections where notebook_id = v_notebook_id
    )
    update notebook_sections s set order_index = ranked.rn * 1024 from ranked where ranked.id = s.id;

    select order_index into v_before from notebook_sections where id = before_id and notebook_id = v_notebook_id;
    select order_index into v_after from notebook_sections where id = after_id and notebook_id = v_notebook_id;
    v_new := midpoint_order_index(v_before, v_after);
  end if;

  update notebook_sections set order_index = v_new, updated_at = now() where id = target_section_id;
end;
$$;
```

`before_id`/`after_id` are nullable — pass `null` for "move to the very start" / "move to the very
end" respectively; both `null` means "the only item" (used implicitly by `create_notebook_with_section`
for the first section, and by `file_note`/`file_reading` which append rather than call these
reorder functions at all).

Manually verify every access path in the plan's "Required verification" list #3–#10 before committing
this batch.

## 3. Final `src/types/database.ts` patch

Insert these new table blocks (alphabetical order: `library_entries`, `note_user_state`,
`notebook_sections`, `notebook_user_state`, `notebooks` — matches this file's existing convention),
and add `archived_at`/`search_text` to the existing `notes` block and `archived_at` to `reading_items`,
and `is_favorite`/`last_opened_at` to `reading_progress` (all alongside the Phase 2 columns from that
addendum).

```ts
      notebooks: {
        Row: {
          archived_at: string | null
          cover: Json
          course_id: string | null
          created_at: string
          description: string
          household_id: string
          id: string
          name: string
          order_index: number
          owner_id: string
          space: string
          updated_at: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          cover?: Json
          course_id?: string | null
          created_at?: string
          description?: string
          household_id: string
          id?: string
          name: string
          order_index?: number
          owner_id: string
          space: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          cover?: Json
          course_id?: string | null
          created_at?: string
          description?: string
          household_id?: string
          id?: string
          name?: string
          order_index?: number
          owner_id?: string
          space?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebooks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebooks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_sections: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          notebook_id: string
          order_index: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          notebook_id: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          notebook_id?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_sections_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      library_entries: {
        Row: {
          created_at: string
          id: string
          note_id: string | null
          order_index: number
          reading_item_id: string | null
          section_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id?: string | null
          order_index?: number
          reading_item_id?: string | null
          section_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string | null
          order_index?: number
          reading_item_id?: string | null
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_entries_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_entries_reading_item_id_fkey"
            columns: ["reading_item_id"]
            isOneToOne: false
            referencedRelation: "reading_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_entries_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "notebook_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_user_state: {
        Row: {
          is_favorite: boolean
          last_opened_at: string | null
          notebook_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          is_favorite?: boolean
          last_opened_at?: string | null
          notebook_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          is_favorite?: boolean
          last_opened_at?: string | null
          notebook_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_user_state_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      note_user_state: {
        Row: {
          is_favorite: boolean
          last_opened_at: string | null
          note_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          is_favorite?: boolean
          last_opened_at?: string | null
          note_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          is_favorite?: boolean
          last_opened_at?: string | null
          note_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_user_state_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
```

Add to the existing `notes` block: `archived_at: string | null` and `search_text: string` (Row),
`archived_at?: string | null` / `search_text?: string` (Insert/Update). Add `archived_at: string |
null` to `reading_items`. Add `is_favorite: boolean` and `last_opened_at: string | null` to
`reading_progress` (alongside `zoom_mode`/`zoom_value`/`view_mode` from the Phase 2 addendum).

Add to `Functions` (alphabetical, alongside Phase 2's entries):

```ts
      can_access_notebook: { Args: { p_notebook_id: string }; Returns: boolean }
      can_access_section: { Args: { p_section_id: string }; Returns: boolean }
      can_manage_notebook: { Args: { p_notebook_id: string }; Returns: boolean }
      can_manage_section: { Args: { p_section_id: string }; Returns: boolean }
      create_notebook_with_section: {
        Args: {
          p_course_id: string | null
          p_cover: Json
          p_description: string
          p_household_id: string
          p_name: string
          p_space: string
          p_visibility: string
        }
        Returns: string
      }
      delete_notebook_unfile: { Args: { target_notebook_id: string }; Returns: undefined }
      delete_section_unfile: { Args: { target_section_id: string }; Returns: undefined }
      file_note: { Args: { target_note_id: string; target_section_id: string }; Returns: string }
      file_reading: { Args: { target_reading_id: string; target_section_id: string }; Returns: string }
      midpoint_order_index: { Args: { p_after: number | null; p_before: number | null }; Returns: number | null }
      move_library_entry: { Args: { target_entry_id: string; target_section_id: string }; Returns: undefined }
      remove_library_entry: { Args: { target_entry_id: string }; Returns: undefined }
      reorder_library_entry: {
        Args: { after_id: string | null; before_id: string | null; target_entry_id: string }
        Returns: undefined
      }
      reorder_notebook: { Args: { after_id: string | null; before_id: string | null; target_notebook_id: string }; Returns: undefined }
      reorder_section: { Args: { after_id: string | null; before_id: string | null; target_section_id: string }; Returns: undefined }
```

## 4. Paper backgrounds — reuse Phase 1's `paperStyle`, don't add `template`

`src/lib/pageSizes.ts` already implements exactly what this plan calls "built-in paper backgrounds,
CSS-generated" — as `PageSettings.paperStyle: 'blank' | 'ruled' | 'grid' | 'dotted'`, with
`PAPER_STYLE_BACKGROUND`/`PAPER_STYLE_BACKGROUND_SIZE` maps already driving `PaginatedEditor.tsx`'s
page-sheet backgrounds. **Do not add a second field called `template`.** Instead:

- Extend the existing union and both maps in `src/lib/pageSizes.ts` to the plan's full built-in list:
  add `'wide-ruled' | 'narrow-ruled' | 'small-grid' | 'legal'` to `PaperStyle`, and add matching CSS
  gradient entries to `PAPER_STYLE_BACKGROUND`/`PAPER_STYLE_BACKGROUND_SIZE` (wide-ruled: wider line
  spacing than `ruled`, e.g. 32px vs 27px; narrow-ruled: tighter, e.g. 20px; small-grid: smaller cell
  than `grid`, e.g. 12px vs 23px; legal: same as `ruled` plus a left margin rule — a second
  `repeating-linear-gradient`/vertical line via a left-offset gradient layer, mirroring how `grid`
  already layers two gradients).
- `src/lib/paperTemplates.ts` (in the Phase 3 required-files list) becomes a thin export of
  `{ value: PaperStyle; label: string }[]` for the picker UI — re-exporting the `PaperStyle` type and
  background maps from `pageSizes.ts`, not a second implementation. Do not duplicate the CSS.
- No data backfill: old notes with no `paperStyle` already default to `'blank'` via the existing
  `pageSettings.paperStyle ?? 'blank'` fallback in `PaginatedEditor.tsx` — this satisfies "treat
  missing values on old notes as blank" with zero extra code.

**New: the print-background toggle** (`Include paper background`, default off) does not exist yet —
today's `handlePrint`/render path always prints the pattern. Add:
- A new prop `includeBackgroundInPrint: boolean` (and its setter) threaded from `NoteDetail.tsx` into
  `PaginatedEditor`, stored in local component state, default `false`, exposed as a checkbox next to
  the existing `Print / Export PDF` button.
- One new rule in `src/index.css`'s existing `@media print` block:
  ```css
  .paginated-page-sheet.print-hide-background {
    background-image: none !important;
  }
  ```
- Conditionally add the `print-hide-background` class to each page-sheet `div` in `PaginatedEditor`
  when `!includeBackgroundInPrint` (it's harmless on screen since the class only takes effect inside
  `@media print`).

## 5. Page navigation contract — extend `PaginatedEditor`, text previews not visual thumbnails

Confirmed by reading `src/components/notes/PaginatedEditor.tsx` and
`src/components/notes/pagination/PaginationExtension.ts`: pagination is a client-side decoration
overlay. `pageCount` and the break positions (`PageBreakSpacer[]`, each `{ pos, height }`) are
**internal state only** — nothing is exposed to `NoteDetail.tsx` today, and there is no mechanism to
render an isolated image of "just page N" (unlike Phase 2's PDF.js pages, this is one continuous
ProseMirror document, and no screenshot library is in the stack or should be added for this).

Resolved: extend `PaginatedEditorProps` additively (this is the "integration step" the top-level plans
explicitly allow modifying Phase 1 files for) and make `PageThumbnailRail` a **text-preview** list
tied to page boundaries, not a rendered image, matching zero new dependencies.

Add to `PaginatedEditorProps`:

```ts
interface PaginatedEditorProps {
  // ...existing props unchanged...
  onPagesChange?: (pages: { pageNumber: number; textPreview: string }[]) => void
  onVisiblePageChange?: (pageNumber: number) => void
}
```

And a ref handle via `forwardRef`:

```ts
export interface PaginatedEditorHandle {
  scrollToPage: (pageNumber: number) => void
}
```

Implementation notes for `remeasure()` (the function that already computes `spacers: PageBreakSpacer[]`
and calls `setPageCount`): after computing `spacers`, derive per-page text using the existing
ProseMirror doc and call `onPagesChange`:

```ts
const boundaries = [0, ...spacers.map((s) => s.pos), editor.state.doc.content.size]
const pages = boundaries.slice(0, -1).map((from, index) => ({
  pageNumber: index + 1,
  textPreview: editor.state.doc.textBetween(from, boundaries[index + 1], ' ', ' ').trim().slice(0, 180),
}))
onPagesChange?.(pages)
```

For `scrollToPage`, expose via `useImperativeHandle` on `scrollAreaRef`, computing the target offset
from the same `fullPageHeightPx` already computed in `remeasure()` (uniform per-page height is
guaranteed by the existing algorithm):

```ts
useImperativeHandle(ref, () => ({
  scrollToPage(pageNumber: number) {
    const el = scrollAreaRef.current
    if (!el) return
    const fullPageHeightPx = mmToPx(pageDimensionsMm(pageSettings.paper, pageSettings.orientation).height)
    el.scrollTo({ top: (pageNumber - 1) * fullPageHeightPx * zoom, behavior: 'smooth' })
  },
}))
```

For "selected page follows scroll position," add a scroll listener on `scrollAreaRef` (debounced or
via `requestAnimationFrame`) computing `Math.floor(scrollTop / (fullPageHeightPx * zoom)) + 1` and
calling `onVisiblePageChange` when it changes.

`src/components/notes/pagination/PageThumbnailRail.tsx` then just renders one card per entry from
`onPagesChange`'s payload — page number + `textPreview` truncated further for the rail's width — with
`aria-current` on the page matching `onVisiblePageChange`'s last value, calling `scrollToPage` on
click via the ref. This satisfies "lazy preview" (only the visible ± 2 range needs to actually render
in the DOM; virtualize with the same `IntersectionObserver` pattern Phase 2 uses for its own
thumbnails) without inventing a rendering pipeline this codebase doesn't have.

The 750 ms "refresh affected previews after editing stops" requirement is already satisfied by the
existing `scheduleRemeasure()` debounce (`REMEASURE_DELAY_MS = 250`ms today) — either reuse that
timer's callback to also fire `onPagesChange`, or bump a second debounce to 750ms specifically for the
text-preview computation if recomputing `textBetween` on every 250ms remeasure turns out to be
wasteful. Either is acceptable; do not add a third competing debounce constant beyond these two.

## 6. Everything else in the required-files list

`useLibrary.ts`, `useNotebook.ts`, `useLibraryUserState.ts`: standard fetch/subscribe/mutate hooks —
no novel technology, build them directly against the schema in Section 2. `libraryOrdering.ts` should
export a **client-side mirror** of `midpoint_order_index` (same logic, not authoritative — the SQL
function in Section 2 is the real boundary) purely so optimistic UI can compute a provisional
`order_index` before the RPC round-trip resolves:

```ts
export function computeMidpointOrderIndex(before: number | null, after: number | null): number | null {
  if (before === null && after === null) return 1024
  if (before === null) return Math.floor(after! / 2)
  if (after === null) return before + 1024
  return after - before > 1 ? before + Math.floor((after - before) / 2) : null
}
```

`libraryPermissions.ts` should export **client-side predictions only** (for hiding/disabling controls
before a round-trip, e.g. "would `file_note` likely reject this combination") mirroring the exact
rules in Section 2's `file_note`/`file_reading` functions — never treat these as the security
boundary, exactly as the plan says. `libraryPreview.ts` and `notePlainText.ts`: implement exactly as
specified in the original plan's "Plain-text extraction" and "Previews" sections — no changes needed
there. Integration point for `notePlainText`: add `search_text: notePlainText(content)` to the same
save-payload object `NoteDetail.tsx` already builds around line 167 (`content: note.type === 'freeform'
|| note.type === 'paginated' ? content : null`), and for `case_brief` notes concatenate the five
`case_brief_*` fields instead, per the plan.

## 7. Realtime — reuse existing patterns verbatim

Add `'notebooks', 'notebook_sections', 'library_entries'` to whatever `REALTIME_TABLES` array feeds
`useRealtimeRefresh` on the Notes screen (same hook signature already used in `Notes.tsx` and
`NoteDetail.tsx` — no changes needed to `useRealtimeRefresh.ts` itself). For move/reorder mutations,
copy `NoteDetail.tsx`'s self-echo guard pattern exactly: record a timestamp immediately before firing
the RPC, and ignore any realtime event on the affected table arriving within a fixed window
(`NoteDetail.tsx` uses `SELF_ECHO_WINDOW_MS = 6000`; reuse the same constant rather than inventing a
new one) before triggering a reload.

## 8. Everything not mentioned above

Notebook/section/item screen layout, favorites/recents rules, archive/delete copy, query limits (50
items, `Load more`), responsive breakpoints, loading/error states, and accessibility requirements:
implement exactly what `PHASE_3_IMPLEMENTATION_PLAN.md` already specifies — this addendum does not
repeat or change any of it. Follow the same 8-batch commit order and messages from that plan's
"Implementation order and commits" section unchanged, running `npm run build`, `npm run lint`, and
`git diff --check` after each batch as it specifies — and do not start batch 1 until the Section 0
precondition (Phase 2 committed and building) is actually true.
