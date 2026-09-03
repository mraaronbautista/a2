-- Recurring income templates — salary/allowance/scholarship is the most
-- predictable transaction in the whole app (same day, roughly the same
-- amount, every month), yet had to be re-typed from scratch every payday.
--
-- Deliberately NOT auto-posted, same reasoning as calendar_events'
-- recurrence_rule being expanded client-side rather than materialized: an
-- actual income transaction should always be a deliberate confirmation
-- (the real amount can vary — overtime, a late payment, a bonus), not a
-- silent background insert. BudgetView shows "expected this month, not
-- yet logged" and one tap opens BudgetEntryModal pre-filled from the
-- template.
--
-- Monthly-only for now — a semi-monthly payday (e.g. 15th and 30th) is
-- just two separate templates, rather than a second frequency unit to
-- support.

create table recurring_income (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  label text not null,
  category text not null,
  amount numeric(10,2) not null check (amount > 0),
  account_id uuid not null references accounts(id) on delete cascade,
  day_of_month smallint not null check (day_of_month between 1 and 31),
  paid_by uuid not null references auth.users(id) on delete cascade,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index recurring_income_household_id_idx on recurring_income(household_id);

alter table recurring_income enable row level security;

create policy "select household recurring income" on recurring_income
  for select using (is_household_member(household_id));
create policy "insert household recurring income" on recurring_income
  for insert with check (created_by = auth.uid() and is_household_member(household_id));
create policy "update household recurring income" on recurring_income
  for update using (is_household_member(household_id));
create policy "delete household recurring income" on recurring_income
  for delete using (is_household_member(household_id));

alter publication supabase_realtime add table recurring_income;
