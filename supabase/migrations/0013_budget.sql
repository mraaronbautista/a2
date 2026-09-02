-- Joint budget tracking for "Us" — income/expense log with freeform
-- categories, a single household-wide monthly limit (not per-category,
-- since categories are freeform and an ad-hoc tag doesn't have a sensible
-- fixed cap), and a paid_by + split_mode pair so a "who owes whom" balance
-- can be derived from shared-split expenses without a separate ledger.

create table budget_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(10,2) not null check (amount > 0),
  category text not null default 'Uncategorized',
  description text,
  -- Whose money moved — always required, even for a 'personal' expense,
  -- since "who paid" is meaningful either way; 'personal' just excludes it
  -- from the shared balance below.
  paid_by uuid not null references auth.users(id) on delete cascade,
  split_mode text not null default 'shared' check (split_mode in ('shared', 'personal')),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index budget_transactions_household_id_idx on budget_transactions(household_id);
create index budget_transactions_occurred_on_idx on budget_transactions(occurred_on);

alter table budget_transactions enable row level security;

create policy "select household budget transactions" on budget_transactions
  for select using (is_household_member(household_id));
create policy "insert household budget transactions" on budget_transactions
  for insert with check (created_by = auth.uid() and is_household_member(household_id));
-- Co-managed like shared tasks/notes elsewhere in this schema — either
-- partner can edit or delete any entry, since a joint budget has no
-- "owner" the way a private note does.
create policy "update household budget transactions" on budget_transactions
  for update using (is_household_member(household_id));
create policy "delete household budget transactions" on budget_transactions
  for delete using (is_household_member(household_id));

-- One row per household holding the live monthly limit — a single
-- current value (like Priorities' "latest wins" in tandem-webapp), not a
-- history, since it's just a target number either partner can adjust.
create table budget_settings (
  household_id uuid primary key references households(id) on delete cascade,
  monthly_limit numeric(10,2),
  updated_at timestamptz not null default now()
);

alter table budget_settings enable row level security;

create policy "select household budget settings" on budget_settings
  for select using (is_household_member(household_id));
create policy "insert household budget settings" on budget_settings
  for insert with check (is_household_member(household_id));
create policy "update household budget settings" on budget_settings
  for update using (is_household_member(household_id));

alter publication supabase_realtime add table budget_transactions;
alter publication supabase_realtime add table budget_settings;
