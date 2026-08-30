-- Tasks get an optional end time alongside due_date (their start), so a
-- task can represent a block of time — "study session 2-4pm" — the same
-- way calendar_events already do, instead of only ever a single instant.
alter table tasks add column end_at timestamptz;
