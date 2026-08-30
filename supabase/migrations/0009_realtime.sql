-- Enable live sync: both partners share one household's data, and until now
-- seeing the other person's changes required a manual reload. Adding these
-- tables to the realtime publication lets the client subscribe to Postgres
-- changes (RLS still applies — a subscriber only receives events for rows
-- their own policies let them see).
alter publication supabase_realtime add table calendar_events;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table reading_items;
alter publication supabase_realtime add table reading_status;
alter publication supabase_realtime add table nudges;
alter publication supabase_realtime add table thoughts;
alter publication supabase_realtime add table notes;
alter publication supabase_realtime add table courses;
