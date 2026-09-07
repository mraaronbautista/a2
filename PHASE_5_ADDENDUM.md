# Phase 5 Addendum: Verified Against Real Code, Ready-to-Paste Artifacts

This addendum sits on top of `PHASE_5_IMPLEMENTATION_PLAN.md`. It verifies the plan's reuse
decisions against the actual committed schema and app shell (not assumption), and hands over final
migration SQL, type patches, and the exact nav/icon integration points.

## 0. Precondition status

**Update: Phase 5 can start.** Phase 4 (canvas pages + PDF ink) has since landed —
`8d69261 feat(notes): add canvas pages and PDF ink` is committed and `npm run build` passes. Per
household decision, Phase 5 (and 6, and 7 behind it) are implemented back-to-back without pausing
between phases for review/testing gates; legal review and locking of the actual pilot question content
is a separate follow-up pass, not a build blocker — see the updated Preconditions section in
`PHASE_5_IMPLEMENTATION_PLAN.md`.

**Migration number**: confirmed migrations on disk go up to `0025_library_organization.sql`
(committed) and `0026_canvas_pages.sql` (uncommitted, in progress). Phase 5 is therefore
**`0027_practice_mode.sql`**, contingent on Phase 4 actually landing as `0026`.

## 1. Reuse patterns verified against real code

### `thoughts.comments` / `add_thought_comment` — the pattern `attempt_feedback.comments` is modeled on

Read directly from `supabase/migrations/0005_thoughts.sql`. The real shape is simpler than a generic
comment system: a `jsonb not null default '[]'` column, appended to by one `security definer`
function that builds each entry with `jsonb_build_object('id', gen_random_uuid(), 'authorId',
auth.uid(), 'body', p_body, 'createdAt', now())`, bumps `updated_at`, and raises an exception if the
target row isn't visible to the caller. `attempt_feedback.comments` should use the exact same four
base keys (`id`, `authorId`, `body`, `createdAt`) plus one addition Phase 5 actually needs —
`disposition` — rather than inventing a differently-shaped comment object. The literal function is in
Section 3 below, modeled line-for-line on `add_thought_comment`.

### `is_household_member(household_id uuid)` — reuse directly, no new access helper needed

`practice_questions` and `practice_attempts` both carry `household_id` directly (per the base plan),
so their RLS can call this existing function with no new helper — confirmed there is nothing
Practice-specific needed here, unlike Phase 2/3 which needed `can_access_reading`/`can_access_note`
because those tables don't carry `household_id` directly.

### App shell navigation — exact integration point

Read directly from `src/components/layout/AppShell.tsx`:

```ts
const NAV_ITEMS = [
  { to: '/', label: 'Timeline', Icon: TimelineIcon },
  { to: '/notes', label: 'Law', Icon: NotesIcon },
  { to: '/budget', label: 'Budget', Icon: BudgetIcon },
  { to: '/us', label: 'Us', Icon: UsIcon },
]
```

Add one entry, positioned right after `Law` since Practice is a law-study feature:

```ts
const NAV_ITEMS = [
  { to: '/', label: 'Timeline', Icon: TimelineIcon },
  { to: '/notes', label: 'Law', Icon: NotesIcon },
  { to: '/practice', label: 'Practice', Icon: PracticeIcon },
  { to: '/budget', label: 'Budget', Icon: BudgetIcon },
  { to: '/us', label: 'Us', Icon: UsIcon },
]
```

`src/components/layout/icons.tsx` exports one function per icon (`TimelineIcon`, `NotesIcon`,
`BudgetIcon`, `UsIcon`, etc.), each `({ className }: IconProps) => <svg ...>`. Add `PracticeIcon`
following that exact same signature and inline-SVG style — do not add a new icon library or change
how icons are exported.

## 2. Final `src/types/database.ts` patch

```ts
      practice_questions: {
        Row: {
          answer_key: Json
          bar_year: number
          course_id: string | null
          created_at: string
          created_by: string
          edit_history: Json
          exam_date: string | null
          household_id: string
          id: string
          legal_cutoff_date: string | null
          locked: boolean
          question_number: string
          question_text: string
          reading_item_id: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_fingerprint: string | null
          source_page: number | null
          source_tier: string
          source_url: string
          subject: string
          updated_at: string
        }
        Insert: {
          answer_key?: Json
          bar_year: number
          course_id?: string | null
          created_at?: string
          created_by: string
          edit_history?: Json
          exam_date?: string | null
          household_id: string
          id?: string
          legal_cutoff_date?: string | null
          locked?: boolean
          question_number: string
          question_text: string
          reading_item_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_fingerprint?: string | null
          source_page?: number | null
          source_tier: string
          source_url: string
          subject: string
          updated_at?: string
        }
        Update: {
          answer_key?: Json
          bar_year?: number
          course_id?: string | null
          created_at?: string
          created_by?: string
          edit_history?: Json
          exam_date?: string | null
          household_id?: string
          id?: string
          legal_cutoff_date?: string | null
          locked?: boolean
          question_number?: string
          question_text?: string
          reading_item_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_fingerprint?: string | null
          source_page?: number | null
          source_tier?: string
          source_url?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_questions_reading_item_id_fkey"
            columns: ["reading_item_id"]
            isOneToOne: false
            referencedRelation: "reading_items"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_attempts: {
        Row: {
          alac_findings: Json
          answer_application: string | null
          answer_conclusion: string | null
          answer_direct: string | null
          answer_freeform: string | null
          answer_legal_basis: string | null
          created_at: string
          household_id: string
          id: string
          mode: string
          question_id: string
          revealed_early: boolean
          started_at: string
          submitted_at: string | null
          updated_at: string
          user_id: string
          writing_findings: Json
        }
        Insert: {
          alac_findings?: Json
          answer_application?: string | null
          answer_conclusion?: string | null
          answer_direct?: string | null
          answer_freeform?: string | null
          answer_legal_basis?: string | null
          created_at?: string
          household_id: string
          id?: string
          mode: string
          question_id: string
          revealed_early?: boolean
          started_at?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          writing_findings?: Json
        }
        Update: {
          alac_findings?: Json
          answer_application?: string | null
          answer_conclusion?: string | null
          answer_direct?: string | null
          answer_freeform?: string | null
          answer_legal_basis?: string | null
          created_at?: string
          household_id?: string
          id?: string
          mode?: string
          question_id?: string
          revealed_early?: boolean
          started_at?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          writing_findings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "practice_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "practice_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_feedback: {
        Row: {
          attempt_id: string
          comments: Json
          created_at: string
          grader_type: string
          grader_user_id: string | null
          id: string
          rubric_version: string
          scores: Json
          total_score: number
          updated_at: string
        }
        Insert: {
          attempt_id: string
          comments?: Json
          created_at?: string
          grader_type: string
          grader_user_id?: string | null
          id?: string
          rubric_version: string
          scores: Json
          total_score: number
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          comments?: Json
          created_at?: string
          grader_type?: string
          grader_user_id?: string | null
          id?: string
          rubric_version?: string
          scores?: Json
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_feedback_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "practice_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
```

Add to `Functions`:

```ts
      add_attempt_feedback_comment: {
        Args: { p_disposition: string; p_feedback_id: string; p_body: string }
        Returns: {
          attempt_id: string
          comments: Json
          created_at: string
          grader_type: string
          grader_user_id: string | null
          id: string
          rubric_version: string
          scores: Json
          total_score: number
          updated_at: string
        }
      }
      correct_locked_question: {
        Args: { p_field: string; p_new_value: string; p_question_id: string; p_reason: string }
        Returns: string
      }
```

## 3. Final migration — `supabase/migrations/0027_practice_mode.sql`

```sql
-- Phase 5: Practice Mode free MVP. Official Bar essay questions, ALAC
-- coaching, deterministic writing checks, and evidence-based self/partner
-- grading. No AI, no variations, no timed simulation -- those are later
-- phases layered onto this same schema.

create table practice_questions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  source_tier text not null check (source_tier in ('supreme_court', 'professor_supplied', 'institutional_suggested')),
  bar_year integer not null,
  exam_date date,
  subject text not null,
  question_number text not null,
  question_text text not null,
  source_url text not null,
  source_page integer,
  source_fingerprint text,
  course_id uuid references courses(id) on delete set null,
  reading_item_id uuid references reading_items(id) on delete set null,
  legal_cutoff_date date,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'reviewed')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  locked boolean not null default false,
  answer_key jsonb not null default '{}'::jsonb,
  edit_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practice_questions_household_idx on practice_questions(household_id);
create index practice_questions_course_idx on practice_questions(course_id);

alter table practice_questions enable row level security;
create policy "select household practice questions" on practice_questions
  for select using (is_household_member(household_id));
create policy "insert own practice questions" on practice_questions
  for insert with check (created_by = auth.uid() and is_household_member(household_id));
-- No plain update policy once locked: unlocked rows may be freely edited by
-- any household member (same co-management trust as courses/notes); locked
-- rows only change through correct_locked_question() below.
create policy "update unlocked practice questions" on practice_questions
  for update using (is_household_member(household_id) and locked = false)
  with check (is_household_member(household_id));
create policy "delete own practice questions" on practice_questions
  for delete using (is_household_member(household_id) and locked = false);

create table practice_attempts (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references practice_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  mode text not null check (mode in ('learn_alac', 'practice')),
  answer_direct text,
  answer_legal_basis text,
  answer_application text,
  answer_conclusion text,
  answer_freeform text,
  alac_findings jsonb not null default '[]'::jsonb,
  writing_findings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  revealed_early boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practice_attempts_question_idx on practice_attempts(question_id);
create index practice_attempts_user_idx on practice_attempts(user_id);

alter table practice_attempts enable row level security;
create policy "manage own practice attempts" on practice_attempts
  for all using (user_id = auth.uid() and is_household_member(household_id))
  with check (user_id = auth.uid() and is_household_member(household_id));
create policy "select partner practice attempts once visible" on practice_attempts
  for select using (
    is_household_member(household_id)
    and submitted_at is not null
    and (
      revealed_early
      or exists (
        select 1 from practice_attempts mine
        where mine.question_id = practice_attempts.question_id
          and mine.user_id = auth.uid()
          and mine.submitted_at is not null
      )
    )
  );

create table attempt_feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references practice_attempts(id) on delete cascade,
  grader_type text not null check (grader_type in ('self', 'partner', 'deterministic')),
  grader_user_id uuid references auth.users(id),
  rubric_version text not null,
  scores jsonb not null,
  total_score numeric(3,1) not null,
  comments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, grader_type, grader_user_id)
);
create index attempt_feedback_attempt_idx on attempt_feedback(attempt_id);

alter table attempt_feedback enable row level security;
-- Mirrors practice_attempts' own two select rules exactly (owner always;
-- partner only once mutually revealed) -- feedback must never be visible
-- earlier than the attempt it grades, or a total_score/evidence span would
-- leak the answer's substance before reveal.
create policy "select feedback on visible attempts" on attempt_feedback
  for select using (
    exists (
      select 1 from practice_attempts a
      where a.id = attempt_feedback.attempt_id
        and (
          a.user_id = auth.uid()
          or (
            is_household_member(a.household_id)
            and a.submitted_at is not null
            and (
              a.revealed_early
              or exists (
                select 1 from practice_attempts mine
                where mine.question_id = a.question_id
                  and mine.user_id = auth.uid()
                  and mine.submitted_at is not null
              )
            )
          )
        )
    )
  );
create policy "self grades own attempt" on attempt_feedback
  for all using (
    grader_type = 'self' and grader_user_id = auth.uid()
    and exists (select 1 from practice_attempts a where a.id = attempt_feedback.attempt_id and a.user_id = auth.uid())
  )
  with check (
    grader_type = 'self' and grader_user_id = auth.uid()
    and exists (select 1 from practice_attempts a where a.id = attempt_feedback.attempt_id and a.user_id = auth.uid())
  );
create policy "partner grades visible attempt" on attempt_feedback
  for all using (
    grader_type = 'partner' and grader_user_id = auth.uid()
    and exists (
      select 1 from practice_attempts a
      where a.id = attempt_feedback.attempt_id
        and a.user_id <> auth.uid()
        and is_household_member(a.household_id)
        and a.submitted_at is not null
    )
  )
  with check (
    grader_type = 'partner' and grader_user_id = auth.uid()
    and exists (
      select 1 from practice_attempts a
      where a.id = attempt_feedback.attempt_id
        and a.user_id <> auth.uid()
        and is_household_member(a.household_id)
        and a.submitted_at is not null
    )
  );
create policy "deterministic feedback on own attempt" on attempt_feedback
  for all using (
    grader_type = 'deterministic' and grader_user_id is null
    and exists (select 1 from practice_attempts a where a.id = attempt_feedback.attempt_id and a.user_id = auth.uid())
  )
  with check (
    grader_type = 'deterministic' and grader_user_id is null
    and exists (select 1 from practice_attempts a where a.id = attempt_feedback.attempt_id and a.user_id = auth.uid())
  );

-- Modeled line-for-line on add_thought_comment (0005_thoughts.sql): same
-- security-definer shape, same base comment keys, one addition
-- (disposition) this feature actually needs.
create or replace function public.add_attempt_feedback_comment(
  p_feedback_id uuid, p_body text, p_disposition text
)
returns attempt_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  result attempt_feedback;
begin
  if p_disposition not in ('comment', 'approve', 'dispute') then
    raise exception 'invalid disposition';
  end if;

  -- This function is security definer, so it bypasses attempt_feedback's
  -- own RLS entirely -- it must reimplement that same visibility rule
  -- itself rather than relying on the (bypassed) select policy.
  update attempt_feedback
  set comments = comments || jsonb_build_object(
        'id', gen_random_uuid(),
        'authorId', auth.uid(),
        'body', p_body,
        'disposition', p_disposition,
        'createdAt', now()
      ),
      updated_at = now()
  where id = p_feedback_id
    and exists (
      select 1 from practice_attempts a
      where a.id = attempt_feedback.attempt_id
        and (
          a.user_id = auth.uid()
          or (
            is_household_member(a.household_id)
            and a.submitted_at is not null
            and (
              a.revealed_early
              or exists (
                select 1 from practice_attempts mine
                where mine.question_id = a.question_id
                  and mine.user_id = auth.uid()
                  and mine.submitted_at is not null
              )
            )
          )
        )
    )
  returning * into result;

  if result.id is null then
    raise exception 'feedback not found or not visible';
  end if;

  return result;
end;
$$;

-- Appends an audit entry, then applies the change -- the only path that
-- may modify question_text/source_url/source_page/answer_key once locked.
create or replace function public.correct_locked_question(
  p_question_id uuid, p_field text, p_new_value text, p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_previous text;
begin
  select household_id into v_household_id from practice_questions where id = p_question_id;
  if v_household_id is null or not is_household_member(v_household_id) then
    raise exception 'question not found or not accessible';
  end if;
  if p_field not in ('question_text', 'source_url', 'source_page', 'answer_key') then
    raise exception 'field not correctable through this function';
  end if;

  execute format('select %I::text from practice_questions where id = $1', p_field)
    into v_previous using p_question_id;

  update practice_questions
  set edit_history = edit_history || jsonb_build_object(
        'editedBy', auth.uid(), 'editedAt', now(), 'field', p_field,
        'previousValue', v_previous, 'reason', p_reason
      ),
      updated_at = now()
  where id = p_question_id;

  execute format('update practice_questions set %I = $1 where id = $2', p_field)
    using p_new_value, p_question_id;

  return p_question_id;
end;
$$;
```

Note the `correct_locked_question` function uses dynamic `execute format(...)` because it accepts a
column name parameter — this is safe here specifically because `p_field` is validated against a fixed
allowlist immediately before use, and `format(%I, ...)` identifier-quotes it; never widen that
allowlist to accept an arbitrary client-supplied column name.

## 4. Everything else

`PHASE_5_IMPLEMENTATION_PLAN.md`'s answer-mode behavior, writing-check scope, self/partner grading
UI, routes, and required-files list all stand unchanged — nothing else needed reconciling against
real code. Proceed with it as written, using the migration above in place of the base plan's column
tables, once Phase 4 is committed and building.
