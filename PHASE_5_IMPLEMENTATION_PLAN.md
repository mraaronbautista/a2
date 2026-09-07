# Phase 5 Execution Plan: Practice Mode Free MVP (ALAC Essay Trainer)

This document is authoritative for Phase 5. Implement it as written. Do not redesign the data model,
add adjacent features, or refactor Phase 1-4 code unless an integration step below explicitly requires
it. If an assumption is invalid, stop and report the exact conflict instead of inventing an
alternative.

This plan is derived from `A2_Philippine_Bar_Practice_Mode_Planning_and_Review.docx`, a much larger
planning document covering a full seven-stage Practice Mode roadmap (Review, Free MVP, AI pilot,
Variations, Shared study, Simulation, Syllabus). **Phase 5 is that document's Stage 0 (Review) and
Stage 1 (Free MVP) only.** AI grading, controlled question variations, Bar-year timed simulation, and
syllabus ingestion are explicitly out of scope here and will become later phases. This is a
deliberate, large scope cut from the source document — see "Explicitly deferred" below for the full
list and why.

This plan also resolves eight review comments already left on that document by a prior review pass,
rather than leaving them as open questions. Each resolution is called out inline where it applies.

## Outcome

Let Aaron and Alexs each practice real, reviewed Philippine Bar essay questions using the ALAC answer
pattern (direct Answer, Legal basis, Application, Conclusion), get deterministic structural and
writing-mechanics feedback while they type, self-grade against a reviewed answer key with
evidence-linked scoring, and compare answers with each other once both have submitted — with zero AI
involvement, zero API cost, and zero risk of an unverified or fabricated question ever entering the
system.

## Fixed product decisions

1. Every question in Phase 5 carries an explicit `source_tier`: `supreme_court` (an actual Bar
   questionnaire or Bar Bulletin item), `professor_supplied` (course material from a law professor,
   e.g. a school-administered exam), or `institutional_suggested` (a reviewed institutional answer/
   drafting aid). This mirrors three of the five tiers in the source document's own "Source hierarchy"
   table (the remaining two — current law/jurisprudence, and AI-generated — are not question sources,
   they describe authority validation and Phase 7's later generator, respectively). Only a
   `supreme_court`-tier question may ever be displayed as "Official Bar Question" in the UI;
   `professor_supplied` and `institutional_suggested` questions go through the exact same entry,
   review, practice, and grading pipeline but are always visibly labeled by their real source, never
   described as official. Manual entry and review remain required regardless of tier — Phase 5 builds
   no question generator and no variation engine for any tier.
2. There is no AI grading, AI feedback, or AI-authored content anywhere in Phase 5. The feature must be
   fully useful with zero API keys configured. (Resolves review comment: AI protected-grading and
   spending-cap design work is deferred to the AI pilot phase, not built now.)
3. Grading in Phase 5 is self-grading and partner-grading only, both against a human-reviewed answer
   key and rubric. Every awarded point must cite the exact passage in the student's own answer that
   earned it — a score with no evidence span is not a valid score in this system.
4. Two answer modes only: **Learn ALAC** (four separate fields with structural/writing hints while
   typing, no substantive legal hints) and **Practice** (one blank editor, all feedback after
   submission). **Bar Simulation** (timed, Bar-year-configured, full exam navigation) is a later phase
   — Phase 5 has no timer and no multi-question exam session.
5. A student's own answer is private until they submit it. It becomes visible to their partner only
   once the partner has also submitted their own answer to the same question, or the student
   explicitly reveals it early. The answer key and rubric are never visible before the student's own
   submission.
6. Questions are entered and reviewed directly by a household member through the app — Phase 5 has no
   separate "reviewer role" or permission tier. Both A2 accounts already function as trusted
   co-managers everywhere else in this app (shared courses, shared notes); question review is a
   workflow state (`reviewed` vs `unreviewed`), not a new access-control boundary.
7. A reviewed, locked question's official text and reviewed answer key are never silently edited.
   Any correction after locking is appended to that question's own edit history, never overwritten in
   place.
8. Writing/grammar checks are advisory annotations only. They must never rewrite, auto-correct, or
   otherwise alter the stored text of a student's answer.
9. A2 never labels a Phase 5 score as an official or predicted Philippine Bar grade, and never labels
   a reviewed answer key as an official Supreme Court answer. Every score display states plainly that
   it is A2's own practice rubric.
10. Practice questions link directly to this app's existing `courses` (and, when applicable,
    `reading_items`) rather than a new topic hierarchy. (Resolves review comment: reuse `course_id`/
    `reading_item_id` directly; a separate `course_topics` table is unnecessary until Phase 5 needs
    finer granularity than "which course/reading," which it does not.)
11. Question authorities, rubric criteria, and answer-key detail live in one `jsonb` column on the
    question row, not in separate normalized tables. (Resolves review comment: 11 new tables is a lot
    of migration/RLS surface for a two-person app; this schema's existing convention for low-volume
    structured data — e.g. `thoughts.comments` — is a `jsonb` column, not a child table.)
12. Partner comparison and per-claim commentary reuse the same private-until-shared-plus-comment-thread
    shape already shipped for `thoughts`, not a new reveal/comment system. (Resolves review comment:
    same pattern already exists and works.)
13. No question-set/collection table, and no spaced-repetition/review-scheduling table, in Phase 5.
    With five pilot questions, a full collections or scheduling system is premature; both are already
    on the source document's own deferred list for later stages and stay deferred here too.
14. The ALAC sentence-pattern description shown in the product must be labeled as "A2's practice
    format," never as an official or verified examiner prescription, until its source document, issuer,
    and date are independently verified (they are not, as of this plan).
15. No AI, paid API, analytics SDK, or new backend runtime. Use the existing A2 visual tokens and
    interaction patterns. Do not introduce a new design system or a second modal framework.

## Preconditions

Only one is a real build blocker; the rest are content-quality work that happens in parallel with, or
after, implementation — not a gate on starting it. By household decision, Practice Mode is built
straight through against the draft pilot content, and every question's legal review/locking happens
as one consolidated pass once the feature exists to review it in, not per-phase.

- Phase 1-4 are committed and `npm run build` passes. This is the one real precondition — everything
  else below is tracked, not blocking.
- The ALAC sentence-pattern's source (publication, issuer, date) is either verified, or the UI copy
  ships describing it as "A2's practice format" rather than an official prescription — whichever is
  true first. Implementation should default to the unverified-format copy so it is never blocked on
  this.
- A pilot subject and five representative official Bar essay questions should exist in some form
  (transcribed text, source URL, page number) to build and test the loop against — they do not need to
  be reviewed or locked yet. `PHASE_5_CIVIL_LAW_PILOT_REVIEW_PACK.md` already covers this: five Civil
  Law 2024 questions with draft answer keys, explicitly marked unreviewed. Build against that pack as
  it stands; do not wait for it to be marked reviewed.
- Writing and verifying a real reviewed answer key is genuinely 30-60+ minutes of focused legal work
  per question — that time is real and still needs to happen eventually, but it is a content-review
  task to schedule and complete later (the "touch up" pass), not implementation work and not a reason
  to delay writing code now. `review_status`/`locked` already exist specifically so the app can hold
  draft content safely — an unreviewed question is fully inspectable and unable to affect graded
  practice until someone deliberately reviews and locks it.
- Work begins on a separate branch/worktree named `practice-mode-mvp` or equivalent.

There must be exactly one Phase 5 migration, named `<next>_practice_mode.sql`.

## Database schema

Three new tables total — a deliberate reduction from the source document's eleven, per Fixed product
decisions 10-13.

### `practice_questions`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `household_id` | `uuid` | required, FK households, cascade |
| `created_by` | `uuid` | required, FK auth.users, cascade |
| `source_tier` | `text` | `supreme_court`, `professor_supplied`, or `institutional_suggested`; required |
| `bar_year` | `integer` | required |
| `exam_date` | `date` | nullable |
| `subject` | `text` | required |
| `question_number` | `text` | required (Bar essay numbering is often Roman numerals) |
| `question_text` | `text` | required |
| `source_url` | `text` | required |
| `source_page` | `integer` | nullable |
| `source_fingerprint` | `text` | nullable; a hash of the source file, for provenance/dedup |
| `course_id` | `uuid` | nullable, FK courses, set null |
| `reading_item_id` | `uuid` | nullable, FK reading_items, set null |
| `legal_cutoff_date` | `date` | nullable; law/jurisprudence cutoff the answer key was written against |
| `review_status` | `text` | `unreviewed` or `reviewed`, default `unreviewed` |
| `reviewed_by` | `uuid` | nullable, FK auth.users |
| `reviewed_at` | `timestamptz` | nullable |
| `locked` | `text` | boolean, default false; true once reviewed — text/source become append-only |
| `answer_key` | `jsonb` | required, default `{}`; fixed shape below |
| `edit_history` | `jsonb` | required, default `[]`; append-only correction log |
| `created_at` | `timestamptz` | required, default now |
| `updated_at` | `timestamptz` | required, default now |

`answer_key` fixed shape (documented and enforced client-side, matching this schema's existing
convention for structured `jsonb` columns such as Phase 2's annotation `anchor`):

```json
{
  "directAnswer": "plain-text expected first-sentence answer",
  "legalBasis": { "authorities": ["Art. 36, Family Code", "..."], "explanation": "..." },
  "application": "plain-text expected reasoning tying facts to law",
  "conclusion": "plain-text expected final-sentence result",
  "alternativeConclusions": [{ "conclusion": "...", "conditions": "..." }],
  "rubric": {
    "directAnswer": { "maxPoints": 0.5, "evidenceRequirement": "..." },
    "legalBasis": { "maxPoints": 1.5, "evidenceRequirement": "..." },
    "application": { "maxPoints": 2.0, "evidenceRequirement": "..." },
    "conclusion": { "maxPoints": 0.5, "evidenceRequirement": "..." },
    "legalWriting": { "maxPoints": 0.5, "evidenceRequirement": "..." }
  },
  "commonErrors": ["..."]
}
```

`edit_history` entries: `{ "editedBy": "uuid", "editedAt": "iso", "field": "question_text",
"previousValue": "...", "reason": "..." }`, appended by a database function, never by direct client
update once `locked = true`.

### `practice_attempts`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `question_id` | `uuid` | required, FK practice_questions, cascade |
| `user_id` | `uuid` | required, FK auth.users, cascade |
| `household_id` | `uuid` | required, FK households, cascade |
| `mode` | `text` | `learn_alac` or `practice` |
| `answer_direct` | `text` | nullable; Learn ALAC field |
| `answer_legal_basis` | `text` | nullable; Learn ALAC field |
| `answer_application` | `text` | nullable; Learn ALAC field |
| `answer_conclusion` | `text` | nullable; Learn ALAC field |
| `answer_freeform` | `text` | nullable; Practice mode's single editor |
| `alac_findings` | `jsonb` | required, default `[]`; deterministic structural heuristics, see below |
| `writing_findings` | `jsonb` | required, default `[]`; deterministic writing-mechanics findings |
| `started_at` | `timestamptz` | required, default now |
| `submitted_at` | `timestamptz` | nullable |
| `revealed_early` | `boolean` | required, default false; owner may reveal before partner submits |
| `created_at` | `timestamptz` | required, default now |
| `updated_at` | `timestamptz` | required, default now |

`alac_findings`/`writing_findings` entries: `{ "category": "run_on" | "missing_terminal_punctuation" |
"tentative_phrasing" | "repeated_word" | "inconsistent_naming" | "missing_direct_answer" | ...,
"span": { "start": 0, "end": 42 }, "message": "...", "severity": "info" | "warning" }`. Spans are
character offsets into whichever answer field they were computed against.

### `attempt_feedback`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `attempt_id` | `uuid` | required, FK practice_attempts, cascade |
| `grader_type` | `text` | `self`, `partner`, or `deterministic` |
| `grader_user_id` | `uuid` | nullable, FK auth.users; null only for `deterministic` |
| `rubric_version` | `text` | required (e.g. `pilot-5pt-v1`) |
| `scores` | `jsonb` | required; keyed by rubric component, shape below |
| `total_score` | `numeric(3,1)` | required |
| `comments` | `jsonb` | required, default `[]`; same shape as `thoughts.comments` |
| `created_at` | `timestamptz` | required, default now |
| `updated_at` | `timestamptz` | required, default now |

Unique constraint: `(attempt_id, grader_type, grader_user_id)` — one row per grader per attempt;
regrading updates that row's `scores`/`total_score` rather than inserting a competing one, but a
rubric-version change must insert a new row instead of overwriting (see Versioning below).

`scores` shape: `{ "directAnswer": { "points": 0.5, "evidenceSpan": {"start":0,"end":12} },
"legalBasis": {...}, "application": {...}, "conclusion": {...}, "legalWriting": {...} }`. A component
with `points > 0` must carry a non-null `evidenceSpan` — enforced client-side (matching this schema's
existing precedent of documenting, not database-checking, fixed `jsonb` shapes).

`comments` entries: `{ "id": "uuid", "authorId": "uuid", "body": "...", "disposition": "comment" |
"approve" | "dispute", "createdAt": "iso" }`, appended through a dedicated database function the same
way `add_thought_comment` already appends to `thoughts.comments` — reuse that exact function shape for
a new `add_attempt_feedback_comment(p_feedback_id, p_body, p_disposition)`.

## RLS rules

- `practice_questions`: select for any household member. Insert/update by any household member acting
  as `created_by`/editor — reuse this app's existing trust model between the two accounts rather than
  adding a reviewer permission tier (Fixed decision 6). Once `locked = true`, direct client updates to
  `question_text`, `source_url`, `source_page`, or `answer_key` must go through the
  `correct_locked_question(...)` function (below), never a plain `update`.
- `practice_attempts`: a user manages only their own rows (`user_id = auth.uid()`). Select additionally
  allows viewing another household member's attempt on the same question when that attempt's
  `submitted_at is not null` and (`revealed_early` is true, or the viewer's own attempt on that same
  question is also submitted).
- `attempt_feedback`: `self` feedback is manageable only by the attempt's own `user_id`. `partner`
  feedback is manageable only by the other household member, and only once the underlying attempt is
  visible to them under the rule above. `deterministic` feedback is inserted by whichever household
  member's client computed it, for their own attempt only.

## Required database functions

1. `correct_locked_question(p_question_id, p_field, p_new_value, p_reason)` — the only way to change
   `question_text`, `source_url`, `source_page`, or `answer_key` on a row where `locked = true`.
   Appends one entry to `edit_history` and applies the change atomically.
2. `add_attempt_feedback_comment(p_feedback_id, p_body, p_disposition)` — appends one comment to
   `attempt_feedback.comments`, mirroring `add_thought_comment`'s existing shape exactly.

Neither function is more than the direct equivalents already in this schema; do not add anything
broader (no generic "audit log" table, no comment system beyond this one column).

## TypeScript domain types

Create `src/lib/practiceTypes.ts`:

```ts
export type PracticeMode = 'learn_alac' | 'practice'
export type GraderType = 'self' | 'partner' | 'deterministic'
export type FindingCategory =
  | 'run_on' | 'missing_terminal_punctuation' | 'tentative_phrasing'
  | 'repeated_word' | 'inconsistent_naming' | 'missing_direct_answer'

export interface TextSpan { start: number; end: number }

export interface Finding {
  category: FindingCategory
  span: TextSpan
  message: string
  severity: 'info' | 'warning'
}

export interface AnswerKeyRubricComponent { maxPoints: number; evidenceRequirement: string }

export interface AnswerKey {
  directAnswer: string
  legalBasis: { authorities: string[]; explanation: string }
  application: string
  conclusion: string
  alternativeConclusions: Array<{ conclusion: string; conditions: string }>
  rubric: {
    directAnswer: AnswerKeyRubricComponent
    legalBasis: AnswerKeyRubricComponent
    application: AnswerKeyRubricComponent
    conclusion: AnswerKeyRubricComponent
    legalWriting: AnswerKeyRubricComponent
  }
  commonErrors: string[]
}

export interface RubricScoreComponent { points: number; evidenceSpan: TextSpan | null }
export interface RubricScores {
  directAnswer: RubricScoreComponent
  legalBasis: RubricScoreComponent
  application: RubricScoreComponent
  conclusion: RubricScoreComponent
  legalWriting: RubricScoreComponent
}
```

Add `practice_questions`, `practice_attempts`, `attempt_feedback`, and the two new functions to
`src/types/database.ts`, following this file's existing conventions.

## Routes

```text
/practice
/practice/:questionId
```

- `/practice`: hub with Start practice, Question bank, Progress, and You and Alexs sections (all four
  in one route, tab-switched — no need for four separate routes at this scale).
- `/practice/:questionId`: mode picker (Learn ALAC / Practice) if no attempt in progress, the answer
  editor while answering, and the feedback/comparison view after submission.
- `CourseDetail.tsx` gets one new action, "Practice this course," linking to `/practice?course=<id>`
  (a filtered view of the hub, not a new route).

## Required files

Create:

```text
src/routes/Practice.tsx
src/routes/PracticeQuestion.tsx
src/components/practice/QuestionBank.tsx
src/components/practice/AddQuestionForm.tsx
src/components/practice/AlacEditor.tsx
src/components/practice/BlankEditor.tsx
src/components/practice/WritingFindingsPanel.tsx
src/components/practice/SelfGradeForm.tsx
src/components/practice/PartnerComparisonView.tsx
src/hooks/usePracticeQuestions.ts
src/hooks/usePracticeAttempt.ts
src/hooks/usePartnerComparison.ts
src/lib/practiceTypes.ts
src/lib/alacHeuristics.ts
src/lib/writingChecks.ts
supabase/migrations/<next>_practice_mode.sql
```

Modify only as required: `src/App.tsx` (route registration), `src/components/layout/AppShell.tsx`
(add "Practice" beside Notes/Courses in the primary nav), `src/routes/CourseDetail.tsx` ("Practice
this course" action), `src/types/database.ts`.

Do not add a rich-text editor for answers. Bar essay answers are plain prose with no formatting need;
a plain `<textarea>` with native browser spellcheck is sufficient and keeps evidence-span character
offsets simple (a Tiptap document would make "which characters were highlighted" meaningfully harder
to compute for no real benefit here). Do not create a second modal framework, comment system, or
Supabase client.

## Answer modes

### Learn ALAC

Four separate `<textarea>` fields — Direct Answer, Legal Basis, Application, Conclusion — each with a
short structural prompt placeholder. `alacHeuristics.ts` runs on each field's `onChange` (debounced
~400ms) and can flag purely structural issues while typing: an empty Direct Answer field that doesn't
start with "Yes," "No," or a stated legal result; a Legal Basis field with no capitalized term that
looks like a citation or named doctrine; a Conclusion field whose stated result doesn't match a
plain-text comparison against the Direct Answer field. These are hints about *structure*, never
substantive legal correctness — never compare against `answer_key` while the student is still typing.

### Practice

One blank `<textarea>`. No structural or writing hints appear while typing. All `alacHeuristics.ts`
and `writingChecks.ts` findings, and the answer key, appear only after `submitted_at` is set.

Both modes: submitting sets `submitted_at`, runs both heuristics once against the final text, and
stores the results in `alac_findings`/`writing_findings`. After submission, the answer key becomes
visible and `SelfGradeForm` opens.

## Deterministic writing checks (`writingChecks.ts`)

Implement only what is reliably detectable without a real NLP library — be explicit in the UI about
what this is not. In scope: missing terminal punctuation, repeated adjacent words, a fixed list of
tentative-phrasing terms ("I think," "maybe," "probably," "perhaps"), a simple run-on heuristic
(a sentence, split on `.!?`, exceeding a fixed word-count threshold with no internal comma/semicolon),
and inconsistent party-naming (two capitalized multi-word spans that are near-duplicates of each
other, e.g. "Juan Dela Cruz" vs "Juan de la Cruz," flagged for the student to confirm are the same
person). Out of scope and must not be claimed as covered: subject-verb agreement, sentence-fragment
detection, and true grammar parsing — these require real NLP and are not reliable as regex heuristics;
say so in the UI rather than silently doing a poor job of it.

## Self-grading (`SelfGradeForm.tsx`)

Reveals `answer_key` only after the viewer's own `submitted_at` is set. For each of the five rubric
components, the student enters a point value up to that component's `maxPoints` and must select
(highlight) the supporting span in their own answer text before a nonzero point value is accepted by
the form — mirroring the evidence-based scoring rule for every grader type, self included. Submitting
creates or updates the `(attempt_id, 'self', auth.uid())` `attempt_feedback` row.

## Partner comparison (`PartnerComparisonView.tsx`, `usePartnerComparison.ts`)

Once both attempts on a question are mutually visible (per the RLS rule above), show both answers
side by side with each party's own self-grade. Either partner may add `partner`-grader feedback the
same way `SelfGradeForm` works, scoring the *other* person's answer with the same evidence-span
requirement. Both self- and partner-feedback rows support the `comments` thread
(`add_attempt_feedback_comment`) for approving, disputing, or discussing a specific claimed point —
reusing the exact `thoughts.comments` interaction pattern (inline reply, no separate thread UI).

## Question entry (`AddQuestionForm.tsx`)

A plain form for entering one question of any `source_tier`: all `practice_questions` fields,
including `source_tier` itself, the exact question text, and the structured `answer_key`. Marking a
question `reviewed` (and thus `locked`) is a separate explicit action from creating it — creating a
question does not imply it is reviewed, regardless of tier. An unreviewed question is visible in the
Question bank (labeled "Unreviewed draft") but `PracticeQuestion.tsx` must refuse to start a graded
attempt against it, showing why instead. Every question card/detail view shows two independent
badges — source (`Official Bar Question` / `Professor-supplied` / `Institutional suggested answer`,
per `source_tier`) and review state (`Reviewed` / `Unreviewed draft`) — since a question can be any
combination of the two (e.g. a professor-supplied question that is already reviewed and locked).

## Loading, empty, and error states

Use the same established language as the rest of the app: `Loading…`, `Saving…`, `Saved`. Empty
question bank: explain that questions must be added and reviewed first, with a link to
`AddQuestionForm`. Attempt-save failure: preserve the draft in local component state and show Retry —
never lose a student's typed answer to a network error.

## Accessibility

Every `<textarea>` has a visible label. Findings panels use `aria-live="polite"` for newly appended
items while typing in Learn ALAC mode. The evidence-span highlight interaction (click-and-drag to
select supporting text) must also work via keyboard text selection (native `<textarea>` selection),
not only mouse drag.

## Implementation order and commits

1. **Schema and question entry**
   - Migration, RLS, the two functions, database/domain types, `AddQuestionForm`, `QuestionBank`.
   - Commit: `feat(practice): add question schema and entry workflow`
2. **Answering**
   - Routes, `AlacEditor`, `BlankEditor`, submission flow, `alacHeuristics.ts`, `writingChecks.ts`.
   - Commit: `feat(practice): add ALAC and blank-editor answer modes`
3. **Self-grading**
   - `SelfGradeForm`, evidence-span capture, answer-key reveal-after-submit.
   - Commit: `feat(practice): add evidence-based self grading`
4. **Partner comparison**
   - Reveal rules, `PartnerComparisonView`, `usePartnerComparison`, comment threading.
   - Commit: `feat(practice): add partner comparison and scoring discussion`
5. **Navigation and polish**
   - AppShell nav entry, "Practice this course," Progress view, accessibility/loading-state pass.
   - Commit: `feat(practice): wire up navigation and progress view`

## Required automated checks

Run after every batch:

```bash
npm run build
npm run lint
```

## Manual verification checklist

1. A newly created question is visible but cannot be used for a graded attempt until reviewed.
2. Locking a reviewed question's text/answer key requires `correct_locked_question`; a direct edit
   attempt after locking is rejected.
3. Learn ALAC shows structural hints while typing; no legal-substance hint appears before submission.
4. Practice mode shows no hints of any kind until submission.
5. The answer key is invisible until the viewer's own `submitted_at` is set.
6. A nonzero self-grade component without a selected evidence span is rejected by the form.
7. Partner cannot see the other's answer until both have submitted, or the answer owner explicitly
   reveals it early.
8. A partner-grade claim can be approved, disputed, or commented on by the answer's owner.
9. Both accounts have fully independent attempts, feedback, and reveal state.
10. Deleting/regrading never overwrites a prior `attempt_feedback` row for a different rubric version.
11. `npm run build` passes; `npm run lint` introduces no new warnings.

## Explicitly deferred (to later Practice Mode phases, not part of Phase 5)

- Any AI grading, AI feedback, or AI-authored content of any kind.
- Controlled question variations and the generation/validation pipeline around them.
- Timed Bar Simulation mode, Bar-year exam profiles, and pacing/aggregate reports.
- Syllabus upload, extraction, and coverage-linking.
- Question sets/collections (e.g. "Criminal Law Midterm Coverage").
- Spaced repetition / mastery scheduling ("due for review").
- Public leaderboards or competitive ranking of any kind.
- A dedicated reviewer permission tier distinct from normal household co-management.

## Stop conditions

Stop and report the exact issue before proceeding if:

- Phase 1-4 are not committed and building.
- There is no pilot content at all to build and test against, in any form (not even a draft pack) —
  reviewed content is not required to proceed, but *some* real question text is needed to know the
  feature works.
- A requested adjustment belongs to the Explicitly deferred list.

Content review, locking, and ALAC-source verification are explicitly not stop conditions — they are
tracked as follow-up work to complete once implementation is done.

## Definition of done

Phase 5 is complete when all five implementation batches are committed, build and lint pass with no
new warnings, the five pilot questions are entered (reviewed or not — see Preconditions), both
household accounts can independently answer and self-grade a question, partner comparison and comment
threading work end to end, and every manual verification item above passes using unreviewed draft
content if reviewed content isn't ready yet. A feature that only stores answers without evidence-based
self-grading, or that reveals a partner's answer before their own submission, is not complete.
Reviewing and locking the pilot questions for real practice is tracked separately and does not gate
this definition of done.
