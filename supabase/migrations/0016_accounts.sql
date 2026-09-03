-- Real accounts and a full ledger, replacing "just log a transaction" with
-- "every transaction posts against a specific account." Balances are
-- derived (starting_balance + everything posted since), never stored/
-- cached, so there's nothing to keep in sync — same philosophy as every
-- other rollup in this schema (category totals, the owes-balance, etc.).
--
-- No owner/visibility split on accounts — net worth is meant to be a
-- fully shared picture for both partners, not something either of you can
-- hide part of from the other.

create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- 'asset': cash/bank/investment — balance is money you have.
  -- 'debt': credit card/loan — balance is money you owe.
  -- 'savings': an asset with an optional target, tracked separately from
  -- general assets so a savings goal's progress is visible on its own.
  kind text not null check (kind in ('asset', 'debt', 'savings')),
  target_amount numeric(12,2),
  starting_balance numeric(12,2) not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index accounts_household_id_idx on accounts(household_id);

alter table accounts enable row level security;

create policy "select household accounts" on accounts
  for select using (is_household_member(household_id));
create policy "insert household accounts" on accounts
  for insert with check (created_by = auth.uid() and is_household_member(household_id));
create policy "update household accounts" on accounts
  for update using (is_household_member(household_id));
create policy "delete household accounts" on accounts
  for delete using (is_household_member(household_id));

alter publication supabase_realtime add table accounts;

-- Every transaction now posts against an account (income/expense) or
-- between two (a transfer — paying down a debt or contributing to a
-- savings goal is just a transfer into that account). account_id is
-- nullable only so existing rows logged before this migration don't
-- break; the app always sets it for new ones.
alter table budget_transactions add column account_id uuid references accounts(id) on delete set null;
alter table budget_transactions add column to_account_id uuid references accounts(id) on delete set null;
alter table budget_transactions drop constraint budget_transactions_type_check;
alter table budget_transactions add constraint budget_transactions_type_check check (type in ('income', 'expense', 'transfer'));
-- A transfer has no category of its own — it's categorized by its
-- destination account instead (see BudgetView).
alter table budget_transactions alter column category drop not null;
