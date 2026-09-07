alter table attempt_feedback drop constraint if exists attempt_feedback_grader_type_check;
alter table attempt_feedback add constraint attempt_feedback_grader_type_check check (grader_type in ('self','partner','deterministic','ai'));
alter table attempt_feedback add column metadata jsonb not null default '{}'::jsonb;
alter table attempt_feedback drop constraint if exists attempt_feedback_attempt_id_grader_type_grader_user_id_key;
create unique index attempt_feedback_non_ai_unique_idx on attempt_feedback(attempt_id,grader_type,grader_user_id) where grader_type<>'ai';
create unique index attempt_feedback_ai_unique_idx on attempt_feedback(attempt_id,(metadata->>'promptVersion'),(metadata->>'rubricVersion')) where grader_type='ai';

alter table practice_attempts add column is_benchmark boolean not null default false;

create table practice_settings(
  household_id uuid primary key references households(id) on delete cascade,
  monthly_ai_cost_limit_usd numeric(10,2),
  ai_grading_calibrated boolean not null default false,
  updated_at timestamptz not null default now(),
  check(monthly_ai_cost_limit_usd is null or monthly_ai_cost_limit_usd>=0)
);
alter table practice_settings enable row level security;
create policy "select household practice settings" on practice_settings for select using(is_household_member(household_id));
create policy "insert household practice settings" on practice_settings for insert with check(is_household_member(household_id));
create policy "update household practice settings" on practice_settings for update using(is_household_member(household_id)) with check(is_household_member(household_id));

create policy "AI grades own submitted attempt" on attempt_feedback for insert with check(
  grader_type='ai' and grader_user_id is null and exists(
    select 1 from practice_attempts a where a.id=attempt_id and a.user_id=auth.uid() and a.submitted_at is not null
  )
);

create or replace function practice_ai_monthly_spend(p_household_id uuid) returns numeric
language plpgsql stable security definer set search_path=public as $$
begin
  if not is_household_member(p_household_id) then raise exception 'household not accessible'; end if;
  return coalesce((select sum(coalesce((f.metadata->>'estimatedCostUsd')::numeric,0))
    from attempt_feedback f join practice_attempts a on a.id=f.attempt_id
    where f.grader_type='ai' and a.household_id=p_household_id and f.created_at>=date_trunc('month',now())),0);
end $$;
