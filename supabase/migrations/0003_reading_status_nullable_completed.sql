-- completed_at now doubles as "have I read this" alongside prep_status on the
-- same row, so unmarking a reading as read must not delete tracked prep
-- status. Make it nullable (null = not read) instead of deleting the row.

alter table reading_status
  alter column completed_at drop not null,
  alter column completed_at set default null;
