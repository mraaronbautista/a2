-- Default visibility to 'shared' everywhere — this is a two-person
-- household app; private-by-default was the wrong default for notes and
-- thoughts (tasks/calendar_events already defaulted to 'shared').
alter table notes alter column visibility set default 'shared';
alter table thoughts alter column visibility set default 'shared';

-- "We're classmates" — lets both partners manage the same course/reading
-- list instead of only the course's original owner. Reading completion and
-- prep_status stay per-user regardless (already scoped by reading_item_id +
-- user_id), so co-enrollment only affects who can edit the shared list.
alter table courses add column is_shared boolean not null default false;

drop policy "update own courses" on courses;
create policy "update own or shared courses" on courses
  for update using (owner_id = auth.uid() or (is_shared and is_household_member(household_id)));

drop policy "delete own courses" on courses;
create policy "delete own or shared courses" on courses
  for delete using (owner_id = auth.uid() or (is_shared and is_household_member(household_id)));

drop policy "insert own course reading_items" on reading_items;
create policy "insert own or shared course reading_items" on reading_items
  for insert with check (
    exists (
      select 1 from courses c where c.id = reading_items.course_id
        and (c.owner_id = auth.uid() or (c.is_shared and is_household_member(c.household_id)))
    )
  );

drop policy "update own course reading_items" on reading_items;
create policy "update own or shared course reading_items" on reading_items
  for update using (
    exists (
      select 1 from courses c where c.id = reading_items.course_id
        and (c.owner_id = auth.uid() or (c.is_shared and is_household_member(c.household_id)))
    )
  );

drop policy "delete own course reading_items" on reading_items;
create policy "delete own or shared course reading_items" on reading_items
  for delete using (
    exists (
      select 1 from courses c where c.id = reading_items.course_id
        and (c.owner_id = auth.uid() or (c.is_shared and is_household_member(c.household_id)))
    )
  );

-- Task editing: due date already carries time (timestamptz), just needs a
-- richer UI. Notes reuse the existing (till-now unused) description column.
-- Subtasks and attachments are small per-task lists — jsonb arrays, same
-- "doesn't need a child table" reasoning as reading_status/thoughts.comments
-- elsewhere in this schema.
alter table tasks add column checklist jsonb not null default '[]'::jsonb;
alter table tasks add column attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', true)
on conflict (id) do nothing;

create policy "task attachments are publicly readable"
  on storage.objects for select
  using (bucket_id = 'task-attachments');

create policy "users upload task attachments to their own folder"
  on storage.objects for insert
  with check (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete their own task attachments"
  on storage.objects for delete
  using (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
