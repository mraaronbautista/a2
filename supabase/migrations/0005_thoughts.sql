-- Quick unstructured pins for "Us" — private by default, explicit share
-- toggle, and a lightweight append-only comment thread. Adapted from
-- tandem-webapp's cork_notes, using this schema's visibility convention
-- (private|shared) instead of a plain boolean.

create table thoughts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  -- Flat, append-only thread — { id, authorId, body, createdAt } — same
  -- "doesn't need a child table" reasoning as reading_status/checklist-style
  -- jsonb arrays elsewhere in this schema.
  comments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index thoughts_household_id_idx on thoughts(household_id);

alter table thoughts enable row level security;

create policy "select visible thoughts" on thoughts
  for select using (is_household_member(household_id) and (visibility = 'shared' or owner_id = auth.uid()));
create policy "insert own thoughts" on thoughts
  for insert with check (owner_id = auth.uid() and is_household_member(household_id));
create policy "update own thoughts" on thoughts
  for update using (owner_id = auth.uid());
create policy "delete own thoughts" on thoughts
  for delete using (owner_id = auth.uid());

-- Appends one comment to a thought's thread. SECURITY DEFINER so it can
-- write to a row the caller may not own (the plain UPDATE policy above is
-- owner-only, deliberately, so a comment from the non-owner on a shared
-- thought has to go through a function scoped to just the comments column).
create or replace function add_thought_comment(p_thought_id uuid, p_body text)
returns thoughts
language plpgsql
security definer
set search_path = public
as $$
declare
  result thoughts;
begin
  update thoughts
  set comments = comments || jsonb_build_object(
        'id', gen_random_uuid(),
        'authorId', auth.uid(),
        'body', p_body,
        'createdAt', now()
      ),
      updated_at = now()
  where id = p_thought_id
    and is_household_member(household_id)
    and (visibility = 'shared' or owner_id = auth.uid())
  returning * into result;

  if result.id is null then
    raise exception 'thought not found or not visible';
  end if;

  return result;
end;
$$;

grant execute on function add_thought_comment(uuid, text) to authenticated;
