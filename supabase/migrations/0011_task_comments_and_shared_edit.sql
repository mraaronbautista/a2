-- Tasks: same "shared means co-managed" carve-out already applied to
-- courses (0006) and notes (0008). Without this, a shared task's
-- completion checkbox silently failed to persist for the non-owner (RLS
-- blocked the UPDATE — no error, the row just didn't match), and a
-- comment/question thread needs either partner to be able to append to
-- it regardless of who owns the task.
drop policy "update own tasks" on tasks;
create policy "update own or shared tasks" on tasks
  for update using (owner_id = auth.uid() or (visibility = 'shared' and is_household_member(household_id)));

drop policy "delete own tasks" on tasks;
create policy "delete own or shared tasks" on tasks
  for delete using (owner_id = auth.uid() or (visibility = 'shared' and is_household_member(household_id)));

-- Lightweight comment/question thread per task — ask, reply, or mark
-- resolved (a plain FYI comment with nothing to answer). Same
-- jsonb-array-on-the-row pattern as checklist/attachments already use.
alter table tasks add column comments jsonb not null default '[]'::jsonb;
