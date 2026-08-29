-- Per-user class-prep / cold-call tracking, alongside the existing per-user
-- reading completion on reading_status.

alter table reading_status
  add column prep_status text not null default 'unprepped'
    check (prep_status in ('unprepped', 'prepped', 'cold_called'));
