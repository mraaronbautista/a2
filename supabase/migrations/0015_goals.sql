-- Goals for "Us" — short/long-term aspirations, now that Budget has moved
-- to its own nav tab and Us is meant to be the growth-focused space for
-- both partners. Same shape/visibility convention as tasks: a title, an
-- optional target date, and completed_at instead of a plain boolean (so
-- "when" is preserved, not just "whether"). No milestones/checklist for
-- now — this is deliberately the simple version.

create table goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_date date,
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index goals_household_id_idx on goals(household_id);

alter table goals enable row level security;

create policy "select visible goals" on goals
  for select using (is_household_member(household_id) and (visibility = 'shared' or owner_id = auth.uid()));
create policy "insert own goals" on goals
  for insert with check (owner_id = auth.uid() and is_household_member(household_id));
-- Co-managed when shared, same as tasks/notes elsewhere in this schema —
-- either partner can edit or complete a shared goal, not just whoever
-- added it.
create policy "update visible goals" on goals
  for update using (is_household_member(household_id) and (visibility = 'shared' or owner_id = auth.uid()));
create policy "delete visible goals" on goals
  for delete using (is_household_member(household_id) and (visibility = 'shared' or owner_id = auth.uid()));

alter publication supabase_realtime add table goals;
