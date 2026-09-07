create table practice_questions (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  source_tier text not null check (source_tier in ('supreme_court','professor_supplied','institutional_suggested')),
  bar_year integer not null, exam_date date, subject text not null, question_number text not null,
  question_text text not null, source_url text not null, source_page integer, source_fingerprint text,
  course_id uuid references courses(id) on delete set null, reading_item_id uuid references reading_items(id) on delete set null,
  legal_cutoff_date date, review_status text not null default 'unreviewed' check (review_status in ('unreviewed','reviewed')),
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz, locked boolean not null default false,
  answer_key jsonb not null default '{}'::jsonb, edit_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((review_status='reviewed')=locked),
  check (review_status='unreviewed' or (reviewed_by is not null and reviewed_at is not null
    and length(trim(question_text))>0 and length(trim(source_url))>0
    and length(trim(answer_key->>'directAnswer'))>0 and length(trim(answer_key->'legalBasis'->>'explanation'))>0
    and length(trim(answer_key->>'application'))>0 and length(trim(answer_key->>'conclusion'))>0))
);
create index practice_questions_household_idx on practice_questions(household_id);
alter table practice_questions enable row level security;
create policy "select household practice questions" on practice_questions for select using (is_household_member(household_id));
create policy "insert own practice questions" on practice_questions for insert with check (created_by=auth.uid() and is_household_member(household_id) and review_status='unreviewed' and not locked);
create policy "update unlocked practice questions" on practice_questions for update using (is_household_member(household_id) and not locked) with check (is_household_member(household_id));
create policy "delete unlocked practice questions" on practice_questions for delete using (is_household_member(household_id) and not locked);

create table practice_attempts (
  id uuid primary key default gen_random_uuid(), question_id uuid not null references practice_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, household_id uuid not null references households(id) on delete cascade,
  mode text not null check (mode in ('learn_alac','practice')), answer_direct text, answer_legal_basis text,
  answer_application text, answer_conclusion text, answer_freeform text,
  alac_findings jsonb not null default '[]'::jsonb, writing_findings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(), submitted_at timestamptz, revealed_early boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index practice_attempts_question_idx on practice_attempts(question_id);
alter table practice_attempts enable row level security;
create or replace function can_view_practice_attempt(p_attempt_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from practice_attempts a where a.id=p_attempt_id and is_household_member(a.household_id) and
    (a.user_id=auth.uid() or (a.submitted_at is not null and (a.revealed_early or exists(
      select 1 from practice_attempts mine where mine.question_id=a.question_id and mine.user_id=auth.uid() and mine.submitted_at is not null
    )))))
$$;
create policy "manage own practice attempts" on practice_attempts for all
  using (user_id=auth.uid() and is_household_member(household_id)) with check (user_id=auth.uid() and is_household_member(household_id));
create policy "select visible partner practice attempts" on practice_attempts for select using (
  user_id<>auth.uid() and can_view_practice_attempt(id)
);

create table attempt_feedback (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references practice_attempts(id) on delete cascade,
  grader_type text not null check (grader_type in ('self','partner','deterministic')), grader_user_id uuid references auth.users(id),
  rubric_version text not null, scores jsonb not null, total_score numeric(3,1) not null,
  comments jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(attempt_id,grader_type,grader_user_id)
);
alter table attempt_feedback enable row level security;
create policy "select feedback on visible attempts" on attempt_feedback for select using (can_view_practice_attempt(attempt_id));
create policy "self grade own attempt" on attempt_feedback for all using (
  grader_type='self' and grader_user_id=auth.uid() and exists(select 1 from practice_attempts a where a.id=attempt_id and a.user_id=auth.uid())
) with check (grader_type='self' and grader_user_id=auth.uid() and exists(select 1 from practice_attempts a where a.id=attempt_id and a.user_id=auth.uid()));
create policy "partner grade visible attempt" on attempt_feedback for all using (
  grader_type='partner' and grader_user_id=auth.uid() and can_view_practice_attempt(attempt_id) and exists(select 1 from practice_attempts a where a.id=attempt_id and a.user_id<>auth.uid())
) with check (grader_type='partner' and grader_user_id=auth.uid() and can_view_practice_attempt(attempt_id) and exists(select 1 from practice_attempts a where a.id=attempt_id and a.user_id<>auth.uid()));

create or replace function add_attempt_feedback_comment(p_feedback_id uuid,p_body text,p_disposition text) returns attempt_feedback
language plpgsql security definer set search_path=public as $$ declare result attempt_feedback; begin
  if p_disposition not in ('comment','approve','dispute') then raise exception 'invalid disposition'; end if;
  if trim(p_body)='' then raise exception 'comment cannot be empty'; end if;
  if not exists(select 1 from attempt_feedback f where f.id=p_feedback_id and can_view_practice_attempt(f.attempt_id)) then raise exception 'feedback not accessible'; end if;
  update attempt_feedback set comments=comments||jsonb_build_object('id',gen_random_uuid(),'authorId',auth.uid(),'body',trim(p_body),'disposition',p_disposition,'createdAt',now()),updated_at=now() where id=p_feedback_id returning * into result;
  return result;
end $$;

create or replace function correct_locked_question(p_question_id uuid,p_field text,p_new_value text,p_reason text) returns uuid
language plpgsql security definer set search_path=public as $$ declare old_value text; begin
  if not exists(select 1 from practice_questions q where q.id=p_question_id and is_household_member(q.household_id)) then raise exception 'question not accessible'; end if;
  if p_field not in ('question_text','source_url','source_page','answer_key') then raise exception 'field not correctable'; end if;
  execute format('select %I::text from practice_questions where id=$1',p_field) into old_value using p_question_id;
  update practice_questions set edit_history=edit_history||jsonb_build_object('editedBy',auth.uid(),'editedAt',now(),'field',p_field,'previousValue',old_value,'reason',p_reason),updated_at=now() where id=p_question_id;
  if p_field='source_page' then update practice_questions set source_page=p_new_value::integer where id=p_question_id;
  elsif p_field='answer_key' then update practice_questions set answer_key=p_new_value::jsonb where id=p_question_id;
  else execute format('update practice_questions set %I=$1 where id=$2',p_field) using p_new_value,p_question_id;
  end if;
  return p_question_id;
end $$;
