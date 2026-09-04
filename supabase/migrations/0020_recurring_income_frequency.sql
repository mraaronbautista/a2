-- Recurring income needn't be monthly-only — some income (a freelance
-- gig, tutoring, etc.) lands on a weekly or biweekly cadence tied to a
-- weekday rather than a day-of-month ("every second Wednesday"). Adds
-- frequency alongside the existing day_of_month (now only required for
-- 'monthly'), plus day_of_week and an anchor_date so a biweekly cadence
-- can say *which* Wednesdays, not just "every other one, starting
-- whenever." Same as day_of_month elsewhere in this table, these are
-- reference/display fields — nothing auto-posts from them (see 0017's
-- note); "expected this month" matching stays category+account based.
alter table recurring_income add column frequency text not null default 'monthly' check (frequency in ('monthly', 'weekly', 'biweekly'));
alter table recurring_income alter column day_of_month drop not null;
alter table recurring_income add column day_of_week smallint check (day_of_week between 0 and 6);
alter table recurring_income add column anchor_date date;
