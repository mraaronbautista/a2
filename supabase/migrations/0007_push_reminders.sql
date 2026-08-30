-- Server-side half of Web Push: dedup bookkeeping so the cron sweep and the
-- nudge trigger don't re-notify on every pass, plus the trigger/cron
-- plumbing that calls the send-reminders Edge Function.

alter table tasks add column reminder_sent_at timestamptz;
alter table nudges add column push_sent_at timestamptz;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Instant push the moment a nudge is created — SECURITY DEFINER so it can
-- fire regardless of which household member's insert triggered it. The
-- Edge Function itself is deployed with --no-verify-jwt (its only callers
-- are this trigger and the cron job below, not end users), so the anon key
-- here is just a well-formed Authorization header, not a real permission
-- check — nothing sensitive about committing it, it's already public in the
-- client bundle.
create or replace function notify_nudge_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://oxyhiszbshlnaqdmstzj.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_7HplbZz5QchmzOb00svw9g_8aPI2x7G'
    ),
    body := jsonb_build_object('trigger', 'nudge', 'nudge_id', new.id)
  );
  return new;
end;
$$;

create trigger on_nudge_created
  after insert on nudges
  for each row execute function notify_nudge_push();

-- Periodic sweep for tasks due within the hour. Re-running this migration
-- (e.g. via `db push --include-all`) would otherwise error on a duplicate
-- job name, hence the unschedule-if-exists guard.
do $$
begin
  perform cron.unschedule('send-task-reminders');
exception when others then
  null;
end $$;

select cron.schedule(
  'send-task-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://oxyhiszbshlnaqdmstzj.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_7HplbZz5QchmzOb00svw9g_8aPI2x7G'
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);
