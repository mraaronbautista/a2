-- Shared notes: let either partner edit (and delete) them, not just the
-- original owner — same "shared means co-managed" pattern as courses
-- (0006). Track who last touched a note so the UI can show it, since with
-- two editors "who wrote this" is no longer implied by ownership alone.
alter table notes add column last_edited_by uuid references auth.users(id);
update notes set last_edited_by = owner_id where last_edited_by is null;

drop policy "update own notes" on notes;
create policy "update own or shared notes" on notes
  for update using (owner_id = auth.uid() or (visibility = 'shared' and is_household_member(household_id)));

drop policy "delete own notes" on notes;
create policy "delete own or shared notes" on notes
  for delete using (owner_id = auth.uid() or (visibility = 'shared' and is_household_member(household_id)));
