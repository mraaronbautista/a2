-- Free-form tags on a transaction, separate from its (single, required)
-- category — lets you mark what kind of expense/income something is
-- beyond the budgeting bucket it rolls up into (e.g. "reimbursable",
-- "trip:tokyo", "recurring"). Same shape as notes.tags in 0001_init.sql.
alter table budget_transactions add column tags text[] not null default '{}';
