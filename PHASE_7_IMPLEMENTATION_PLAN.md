# Phase 7 Execution Plan: Practice Mode Controlled Variations

This document is authoritative for Phase 7. Implement it as written. Do not redesign the data model,
add adjacent features, or refactor Phase 1-6 code unless an integration step below explicitly requires
it. If an assumption is invalid, stop and report the exact conflict instead of inventing an
alternative.

This is Stage 3 ("Variations") of the roadmap in `A2_Philippine_Bar_Practice_Mode_Planning_and_Review.docx`,
built directly on Phase 5's `practice_questions` table and Phase 6's Edge Function/provider
infrastructure. It adds exactly one new capability — generating a labeled, traceable **Bar Question
Variation** from a verified parent question — and nothing else.

## Outcome

Let a household member take one (or, for combined-doctrine variations, two) already-reviewed,
locked official Bar question(s) and produce a new, clearly-labeled variation — a changed fact, a
reversed result, an added exception, a converted format — with every factual change explicitly listed,
every cited authority checked against an approved list, and full generation provenance recorded. A
variation is never usable for graded practice until a household member has separately reviewed and
approved it, exactly like an official question already had to be in Phase 5.

## Fixed product decisions

1. Every variation must declare one or two **verified parent questions** — rows in
   `practice_questions` that are already `review_status = 'reviewed'` and `locked = true`. Generating
   a variation from an unreviewed or unlocked question is refused outright. There is no "generate a
   Bar-style question from scratch" path anywhere in this phase — every variation traces back to a
   real official question.
2. AI-assisted generation is one accelerant, not a requirement. Manual variation authoring through the
   existing Phase 5 `AddQuestionForm` (adding `kind = 'variation'`, filling in `fact_changes` and
   parent links by hand) remains fully available and requires no AI or API key. This phase adds a
   generator on top of that, it does not replace or gate the manual path.
3. A generated variation is never auto-published. It always lands with
   `review_status = 'unreviewed'`, inspectable in a reviewer queue, and cannot be used to start a
   graded attempt until a household member explicitly reviews and locks it — reusing Phase 5's
   existing "Unreviewed Draft" gate on `PracticeQuestion.tsx` verbatim. No new gating logic is needed;
   that gate already keys off `review_status` and applies to every question regardless of `kind`.
4. Generation reuses Phase 6's Edge Function infrastructure directly: the same provider secrets, the
   same monthly-spend check against `practice_settings.monthly_ai_cost_limit_usd` and the same hard
   application-side ceiling. Generation and grading cost share **one** monthly cap, not two — a
   second, separate spending dial would be more configuration surface for a two-person household with
   no real benefit.
5. Fixed variation types only, matching the source document exactly: change one legally material
   fact; change an immaterial fact; reverse the likely result via the minimum necessary factual
   change; add an exception, defense, exemption, or procedural limitation; remove a necessary fact
   and require a qualified answer; combine doctrines (two parents only); convert an official essay
   into MCQ, true/false-with-explanation, short answer, issue-spotting, or answer-repair format.
6. The generator receives only: the parent question's text, its reviewed `answer_key`, an explicit
   **approved-authority pool** for this generation (defaulting to the parent's own authorities,
   extendable by the human before generating — never left to the model's own memory), the selected
   variation type, and the parent's `legal_cutoff_date`. It never receives unrestricted instructions to
   invent new law.
7. Every factual change the generator claims to have made is recorded as an explicit, structured diff
   (`fact_changes`) — field, previous value, new value, and its stated legal effect — shown to the
   reviewer before approval. A generated variation with an unexplained factual change (a difference
   between parent and variation text with no corresponding `fact_changes` entry) fails deterministic
   validation and is discarded before it ever reaches the reviewer queue.
8. Deterministic validation runs before a generated draft is stored at all, and rejects: any cited
   authority not in the approved pool for this generation, a missing or invalid parent link, an
   unexplained factual change, doctrine outside the selected variation type's scope, and an answer key
   inconsistent with the stated changes. A rejected generation is not saved as a bad draft to fix later
   — it fails immediately and the human tries again (different type, adjusted authority pool, or
   manual authoring instead).
9. Every question list, card, and detail view must display "Official Bar Question" or "Bar Question
   Variation" as a visibly distinct label — reusing Phase 5's existing labeling requirement, now with
   a second real value to distinguish.

## Preconditions

Only one is a real build blocker: Phase 6's Edge Function/provider infrastructure and Phase 5's
`practice_questions` table have to exist for this phase's migration and generator to build on. That
does not require Phase 5/6 to be reviewed or calibration-complete first — schema and code existing is
enough, and all three phases can be implemented back-to-back.

- Phase 5's `practice_questions` table and Phase 6's Edge Function pattern exist in the working tree.
- End-to-end testing of the *generator* specifically needs one `reviewed`/`locked` question to generate
  from — for development, a household member (or a tester) can simply flip one draft question's status
  directly rather than waiting for a full legal-review pass, since that gate exists precisely to keep
  unreviewed content out of *graded practice*, not out of *testing the generation pipeline*. Schema
  work, manual variation authoring, and the reviewer queue UI need no locked question to build at all.
- Phase 6's calibration decision informs how much a household member should trust AI-drafted
  variations, but is not required to exist before this phase's code is written.
- Work begins on a separate branch/worktree named `practice-mode-variations` or equivalent.

There must be exactly one Phase 7 migration, named `<next>_practice_variations.sql`.

## Database schema

Extends `practice_questions` only — no new tables. Everything else (grading, attempts, feedback,
spending controls) is exactly Phase 5/6's existing schema, unchanged.

```text
alter table practice_questions add column kind text not null default 'official'
  check (kind in ('official', 'variation'));
alter table practice_questions add column parent_question_ids uuid[];
alter table practice_questions add column variation_type text
  check (variation_type in (
    'change_material_fact', 'change_immaterial_fact', 'reverse_result',
    'add_exception', 'remove_necessary_fact', 'combine_doctrines', 'convert_format'
  ));
alter table practice_questions add column fact_changes jsonb not null default '[]'::jsonb;
alter table practice_questions add column generation_metadata jsonb not null default '{}'::jsonb;

alter table practice_questions add constraint practice_questions_variation_shape check (
  (kind = 'official' and parent_question_ids is null and variation_type is null)
  or (kind = 'variation' and variation_type is not null
      and array_length(parent_question_ids, 1) between 1 and 2
      and (variation_type = 'combine_doctrines') = (array_length(parent_question_ids, 1) = 2))
);
```

`parent_question_ids` is a plain array, not a join table — with at most two parents ever, this matches
this schema's existing precedent (e.g. Phase 5's own `jsonb`-over-child-table choices) over adding
normalized infrastructure for a cardinality of one or two. It cannot carry a native foreign key;
referential integrity here is enforced by the generation function and by manual-entry validation in
`AddQuestionForm`, not by the database schema — document this limitation rather than pretending a
`uuid[]` column can enforce it.

`fact_changes` shape: `[{ "field": "...", "previousValue": "...", "newValue": "...", "legalEffect":
"..." }]`.

`generation_metadata` shape (mirrors Phase 6's `attempt_feedback.metadata` exactly, same field names,
same reasoning — one grading/generation provenance shape across this whole feature):

```json
{
  "provider": "openai" | "anthropic",
  "model": "gpt-5.6-terra",
  "promptVersion": "v1",
  "approvedAuthorityPool": ["Art. 36, Family Code", "..."],
  "inputTokens": 4000,
  "outputTokens": 900,
  "estimatedCostUsd": 0.018,
  "confidence": 0.6,
  "warnings": ["..."]
}
```

No RLS change: `practice_questions`' existing Phase 5 policies (select for household, insert/update by
any household member while `locked = false`) already cover variation rows identically to official
rows — `kind` is just another column, not a new access dimension.

## The generation Edge Function

Create `supabase/functions/generate-practice-variation/index.ts`, following Phase 6's exact shape:
JWT-verified (not `--no-verify-jwt` — same reasoning as Phase 6, this is called by an authenticated
end user), request-scoped client built from the caller's own session. Extract Phase 6's monthly-
spend-check logic into one small shared helper both this function and `grade-practice-attempt` call,
rather than duplicating that query.

Flow:

1. Load and validate the parent question(s): must exist, be `reviewed`, and be `locked`. For
   `combine_doctrines`, exactly two parents; every other type, exactly one.
2. Check the shared monthly spend cap (same helper as Phase 6, same cap).
3. Build the provider request with only the parent's text/answer key, the caller-supplied approved-
   authority pool (defaulting to the parent's own), the selected `variation_type`, and the legal
   cutoff. Request structured output: the new question text, every changed fact with its legal
   effect, expected and alternative conclusions, controlling authorities used, an ALAC-shaped answer
   key matching Phase 5's `answer_key` structure, confidence, and warnings.
4. Validate deterministically per Fixed decision 8. Any failure returns an error and stores nothing.
5. On success, insert one `practice_questions` row (`kind = 'variation'`, `review_status =
   'unreviewed'`, `locked = false`, full provenance in `generation_metadata`). Return it.

## Client integration

- `GenerateVariationDialog.tsx`: pick one or two reviewed+locked parent questions (filtered to the
  same subject/course by default), pick a variation type, review/edit the approved-authority pool
  (pre-filled from the parent), show the shared Phase 6 cost estimate, generate.
- `VariationDiffView.tsx`: renders `fact_changes` as a clear before/after list plus each entry's
  stated legal effect — this is the primary thing a reviewer reads before approving, more prominent
  than the raw question text diff.
- `ReviewerQueue.tsx`: lists every `kind = 'variation'` row with `review_status = 'unreviewed'`
  (surfaced as a new section/tab on the existing `/practice` hub, not a new route), each showing the
  diff view, confidence, and warnings, with Approve (sets `review_status`/`reviewed_by`/`reviewed_at`/
  `locked` exactly like Phase 5's existing official-question review action) or Reject (delete the
  row — nothing else references an unreviewed variation, so this is a plain delete, not an unfile).
- `QuestionBank.tsx` (Phase 5) gets one addition: a visible "Official" / "Variation" badge per row,
  and a parent-question link on variation rows.

## Loading and error states

Same established language. A rejected generation shows the validator's specific reason (unsupported
citation, missing fact explanation, etc.), not a generic failure — the reviewer/generator is the same
person here, so the specific reason is directly actionable.

## Implementation order and commits

1. **Schema**
   - Migration, domain/database types, `kind`/variation-type additions to `AddQuestionForm` and
     `QuestionBank` (manual variation authoring works before the generator does).
   - Commit: `feat(practice): add variation schema and manual authoring`
2. **Generation**
   - Edge Function, shared spend-check helper extracted from Phase 6, `GenerateVariationDialog`.
   - Commit: `feat(practice): add AI-assisted variation generation`
3. **Review**
   - `VariationDiffView`, `ReviewerQueue`, approve/reject actions.
   - Commit: `feat(practice): add variation reviewer queue`

## Required automated checks

Run after every batch:

```bash
npm run build
npm run lint
```

## Manual verification checklist

1. Generation refuses an unreviewed or unlocked parent.
2. A generated variation with an unexplained factual change is rejected before being stored.
3. A generated variation citing an authority outside the approved pool is rejected before being
   stored.
4. An approved variation becomes attemptable exactly like an official question; a still-unreviewed
   one is inspectable but cannot start a graded attempt.
5. Manual variation authoring (no AI) works end to end with no provider configured.
6. Combine-doctrines variations require and store exactly two parent links; every other type requires
   exactly one.
7. Generation cost counts against the same monthly cap Phase 6 established, not a separate one.
8. Every list/card/detail view visibly distinguishes Official from Variation.
9. `npm run build` passes; `npm run lint` introduces no new warnings.

## Explicitly deferred

- Timed Bar Simulation mode.
- Syllabus upload/ingestion.
- Batch generation of many variations at once.
- A dedicated "variation quality" calibration process beyond Phase 6's existing grading calibration —
  if generated-variation quality turns out to need its own trust-building step, treat that as a
  future addition, not something this phase's exit condition depends on.

## Stop conditions

Stop and report the exact issue before proceeding if:

- Phase 5's `practice_questions` table or Phase 6's Edge Function pattern do not exist yet.
- The chosen provider cannot reliably return a structured, per-fact change list distinct from free
  prose — without that, deterministic validation of "every change is explained" cannot function.
- A requested adjustment belongs to the Explicitly deferred list.

No official question being reviewed/locked yet is not a stop condition for building this phase — flip
one draft question's status manually to exercise the generator during development if needed.

## Definition of done

Phase 7 is complete only when all three implementation batches are committed, build and lint pass
with no new warnings, manual variation authoring works with zero AI configured, generated variations
cannot bypass review to enter graded practice, every rejection reason from deterministic validation is
shown to the user rather than silently discarded, and Official/Variation labeling is visible
everywhere a question appears. A generator that can publish directly to graded practice, or that
accepts an authority the human never approved, is not complete.
