alter table practice_questions add column kind text not null default 'official' check(kind in ('official','variation'));
alter table practice_questions add column parent_question_ids uuid[];
alter table practice_questions add column variation_type text check(variation_type in ('change_material_fact','change_immaterial_fact','reverse_result','add_exception','remove_necessary_fact','combine_doctrines','convert_format'));
alter table practice_questions add column fact_changes jsonb not null default '[]'::jsonb;
alter table practice_questions add column generation_metadata jsonb not null default '{}'::jsonb;
alter table practice_questions add constraint practice_questions_variation_shape check(
  (kind='official' and parent_question_ids is null and variation_type is null)
  or (kind='variation' and variation_type is not null and cardinality(parent_question_ids) between 1 and 2
    and ((variation_type='combine_doctrines' and cardinality(parent_question_ids)=2) or (variation_type<>'combine_doctrines' and cardinality(parent_question_ids)=1)))
);

comment on column practice_questions.parent_question_ids is 'One verified parent, or two distinct verified parents for combine_doctrines. PostgreSQL cannot apply a native foreign key to uuid[]; validate_practice_variation_parents enforces references.';

create or replace function validate_practice_variation_parents() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.kind='variation' and cardinality(new.parent_question_ids)<>cardinality(array(select distinct unnest(new.parent_question_ids)))
  then raise exception 'Variation parent questions must be distinct'; end if;
  if new.kind='variation' and exists(
    select 1 from unnest(new.parent_question_ids) parent_id left join practice_questions parent on parent.id=parent_id
    where parent.id is null or parent.household_id<>new.household_id or parent.review_status<>'reviewed' or not parent.locked or parent.kind<>'official'
  ) then raise exception 'Every parent must be a reviewed, locked official question in the same household'; end if;
  return new;
end $$;
create trigger practice_variation_parents before insert or update of parent_question_ids,kind on practice_questions for each row execute function validate_practice_variation_parents();

create or replace function practice_ai_monthly_spend(p_household_id uuid) returns numeric
language plpgsql stable security definer set search_path=public as $$
begin
  if not is_household_member(p_household_id) then raise exception 'household not accessible'; end if;
  return coalesce((select sum(coalesce((f.metadata->>'estimatedCostUsd')::numeric,0)) from attempt_feedback f join practice_attempts a on a.id=f.attempt_id where f.grader_type='ai' and a.household_id=p_household_id and f.created_at>=date_trunc('month',now())),0)
    +coalesce((select sum(coalesce((q.generation_metadata->>'estimatedCostUsd')::numeric,0)) from practice_questions q where q.household_id=p_household_id and q.kind='variation' and q.created_at>=date_trunc('month',now())),0);
end $$;
