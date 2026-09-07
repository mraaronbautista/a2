# Phase 6 Execution Plan: Practice Mode AI Pilot

This document is authoritative for Phase 6. Implement it as written. Do not redesign the data model,
add adjacent features, or refactor Phase 1-5 code unless an integration step below explicitly
requires it. If an assumption is invalid, stop and report the exact conflict instead of inventing an
alternative.

This is Stage 2 ("AI pilot") of the roadmap in `A2_Philippine_Bar_Practice_Mode_Planning_and_Review.docx`,
built directly on top of Phase 5's schema. It adds one new, strictly optional grading path
(`grader_type = 'ai'`) to `attempt_feedback` — it does not touch Phase 5's self/partner grading, which
remains the primary, always-available path with zero API dependency.

## Outcome

Let a student optionally request an AI-computed grade for their own already-submitted Phase 5
attempt, from a provider-independent, server-side-only grading path that never exposes a provider key
to the browser, never grades anything but the answer the student themselves submitted, records full
version/cost/confidence metadata on every grade, and is labeled provisional until compared against
this household's own human grading closely enough to trust.

## Fixed product decisions

1. AI grading is opt-in per attempt, triggered by an explicit "Grade with AI" action. It never runs
   automatically on submission.
2. Provider-independent: the grading contract supports OpenAI, Anthropic, or no provider configured.
   With no provider configured, Practice Mode is unchanged from Phase 5 — self and partner grading
   remain fully functional with no degraded experience.
3. Grading happens only inside a Supabase Edge Function, deployed **with JWT verification** (the
   default), not `--no-verify-jwt`. This deliberately differs from `send-reminders` — that function
   is only ever called by a trusted DB trigger or `pg_cron`, never a browser, so it authenticates
   with `SUPABASE_SERVICE_ROLE_KEY` and skips JWT checks entirely. This function is called directly by
   an authenticated end user's browser, so it must verify their JWT and act with their own identity
   (a request-scoped client built from their `Authorization` header) so the exact same RLS rules that
   govern every other read/write in this app govern this one too. What *is* reused from
   `send-reminders`: provider API keys live only in Edge Function environment secrets
   (`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`), read via `Deno.env.get(...)`, and are never sent to or
   stored in the browser.
4. Every AI grade is immutable and versioned once stored: provider, model, prompt version, rubric
   version, answer-key version, input/output token counts, estimated cost, and a confidence value are
   recorded with it. A regrade inserts a new `attempt_feedback` row; it never overwrites a prior one,
   exactly matching Phase 5's own `unique (attempt_id, grader_type, grader_user_id)` pattern — except
   `grader_type = 'ai'` is keyed additionally by prompt/rubric version so a genuine regrade (not just a
   repeated request) is representable at all.
5. An AI grade is labeled **provisional** in the UI until this household's own lightweight calibration
   check (below) has been run and a named household member has confirmed the results are close enough
   to trust. It is never presented as equivalent to a human grade before that.
6. The full gold-standard evaluation harness the source document describes — an independent,
   protected benchmark set graded blind by two or more qualified reviewers — is an **optional stretch
   goal, not a gate this phase depends on.** For a two-person household, self- and partner-grading
   (already shipped in Phase 5) is most of the real value for a fraction of the build cost, and a full
   blinded-comparison harness may reasonably never get built on top of actual bar-prep time pressure.
   Phase 6's actual gate is a much lighter household-run comparison — see "Calibration" below.
7. Spending control reuses `budget_settings.category_limits`'s exact shape and UI pattern
   (`BudgetCategoryLimitsModal`: a per-household settings row, a nullable numeric cap, "leave blank for
   no cap," upsert-on-save) rather than inventing a new limits system.
8. A hard, non-configurable application-side ceiling exists as a second backstop below the
   household's own configured cap, so a misconfigured or missing household setting can never result in
   unbounded spend.
9. AI is never a source of legal truth by itself. The grading request always includes the Phase 5
   human-reviewed `answer_key`, rubric, and approved authorities; the model's job is to map the
   student's own answer onto that already-reviewed rubric, not to independently assess Philippine law.
10. AI grading of one student's attempt sends only that student's own answer, never their partner's —
    the same reveal boundary Phase 5 already enforces stays intact; AI access does not create a
    side-channel around it.
11. No auto-recharge, no batch API usage, and no prompt caching in this phase — those are optimizations
    for after correctness is established, not before.
12. No AI, paid API, or provider dependency is ever required for Practice Mode to remain useful — this
    is additive to Phase 5, never a replacement for it.

## Preconditions

Only one is a real build blocker: Phase 5's schema (`practice_attempts`, `attempt_feedback`) has to
exist in the working tree for this phase's migration to `alter` it — that is a hard sequencing fact,
not a process choice. It does not require Phase 5 to be reviewed, tested, or "signed off"; the two
phases can be implemented back-to-back in the same pass.

- Phase 5's schema exists (committed or not) so this phase's migration has something to `alter`.
  `npm run build` should pass on whatever Phase 5 state exists at the time.
- Provider pricing should be re-checked before real reliance on the cost estimates shown to users —
  the source document's own pricing table is explicitly dated. This does not block writing the code;
  it blocks trusting the numbers, which is already handled by labeling the pricing constants file as
  needing a refresh (see "Client integration").
- A handful of Phase 5 attempts with `self`/`partner` feedback makes the calibration step meaningful
  once it's time to run it — not needed to build the grading path itself, only to exercise it fully.
- A named household member is responsible for the calibration judgment call once the feature exists —
  an ongoing role, not a precondition to starting implementation.
- Work begins on a separate branch/worktree named `practice-mode-ai-pilot` or equivalent.

There must be exactly one Phase 6 migration, named `<next>_practice_ai_grading.sql`.

## Database schema

Two small extensions to existing Phase 5 tables, plus one new table — deliberately not a large
schema, following the same collapse-into-jsonb reasoning Phase 5 already established.

### Extend `attempt_feedback`

```text
alter table attempt_feedback drop constraint if exists attempt_feedback_grader_type_check;
alter table attempt_feedback add constraint attempt_feedback_grader_type_check
  check (grader_type in ('self', 'partner', 'deterministic', 'ai'));

alter table attempt_feedback add column metadata jsonb not null default '{}'::jsonb;
```

`metadata` is populated only for `grader_type = 'ai'` rows; every other grader type leaves it `{}`.
Fixed shape:

```json
{
  "provider": "openai" | "anthropic",
  "model": "gpt-5.4-mini",
  "promptVersion": "v1",
  "rubricVersion": "pilot-5pt-v1",
  "answerKeyVersion": "iso-timestamp-of-question.updated_at-when-graded",
  "inputTokens": 5000,
  "outputTokens": 1200,
  "estimatedCostUsd": 0.0092,
  "confidence": 0.7,
  "uncertainties": ["citation X could not be matched to an approved authority"]
}
```

The existing unique constraint `(attempt_id, grader_type, grader_user_id)` needs one adjustment for
`ai` rows, since there is no `grader_user_id` for an AI grade and a genuine regrade (rubric or prompt
version changed) must be representable as a new row rather than colliding with the old one:

```text
alter table attempt_feedback drop constraint if exists attempt_feedback_attempt_id_grader_type_grader_user_id_key;
create unique index attempt_feedback_non_ai_unique_idx on attempt_feedback (attempt_id, grader_type, grader_user_id)
  where grader_type <> 'ai';
create unique index attempt_feedback_ai_unique_idx on attempt_feedback (attempt_id, (metadata->>'promptVersion'), (metadata->>'rubricVersion'))
  where grader_type = 'ai';
```

### Extend `practice_attempts`

```text
alter table practice_attempts add column is_benchmark boolean not null default false;
```

Marks an attempt the household has deliberately chosen to use for the calibration comparison below.
Not a new table — this is one flag on an existing row, consistent with Phase 5's own minimalism.

### `practice_settings`

Mirrors `budget_settings` exactly:

| Column | Type | Rules |
|---|---|---|
| `household_id` | `uuid` | PK, FK households, cascade |
| `monthly_ai_cost_limit_usd` | `numeric(10,2)` | nullable; null means no configured cap (the hard application-side ceiling still applies) |
| `updated_at` | `timestamptz` | required, default now |

RLS: identical three policies to `budget_settings` (select/insert/update for any household member) —
reuse that exact policy text.

## The grading Edge Function

Create `supabase/functions/grade-practice-attempt/index.ts`. Flow:

1. Build a request-scoped Supabase client from the caller's `Authorization` header (not the service
   role) — every read/write this function performs happens *as the calling user*, so Phase 5's
   existing RLS policies are the only authorization logic that needs to exist; this function adds no
   parallel access-control logic of its own for reading the attempt/question.
2. Load the attempt (RLS already guarantees the caller owns it) and confirm `submitted_at is not
   null` — grading an unsubmitted attempt is refused.
3. Compute this calendar month's AI-grading spend for the household (`sum((metadata->>'estimatedCostUsd')::numeric)`
   over `attempt_feedback` rows with `grader_type = 'ai'` and `created_at` in the current month, joined
   through `practice_attempts.household_id`). Reject if this would exceed
   `practice_settings.monthly_ai_cost_limit_usd` (when set) or the hard application-side ceiling
   (always enforced, regardless of household setting).
4. Build the provider request containing only: the question text, the Phase 5 `answer_key`
   (authorities, rubric, expected/alternative conclusions), and the caller's own answer fields for the
   attempt's `mode`. Never include the partner's answer or any other student's data.
5. Call the configured provider (server-held key from environment secrets) requesting **structured**
   output: per-rubric-component scores, an evidence character-span into the submitted answer text for
   each nonzero score, a confidence value, and a list of uncertainties.
6. Validate deterministically before storing anything: component scores sum to the reported total and
   respect each component's `maxPoints`; every evidence span is a valid, in-range offset into the
   actual submitted text (not a hallucinated quote); every cited authority is checked against
   `answer_key.legalBasis.authorities` — an unmatched citation is not silently dropped, it is added to
   `uncertainties` and the component score is flagged, never fabricated as correct.
7. Insert one `attempt_feedback` row (`grader_type = 'ai'`, full `metadata`). Return it to the caller.
8. On any provider or validation failure, return a clear error and change nothing — the attempt and
   any existing self/partner/deterministic feedback are completely unaffected. The client falls back
   to "grade it yourself" messaging, never a blank/broken state.

## Client integration

- A "Grade with AI" action appears in the attempt feedback view (alongside Phase 5's existing self-
  grade action) only when the Edge Function reports at least one provider configured and the monthly
  cap has not been exceeded.
- Before calling, show an estimated cost using a small constants table
  (`src/lib/aiGradingPricing.ts`, seeded from the source document's own pricing figures but explicitly
  commented as needing a refresh before real reliance) based on a fixed token estimate (5,000 input /
  1,200 output tokens per essay, matching the source document's own planning assumption).
- After grading, show the result with a persistent "Provisional — not yet calibrated for this
  household" badge until the calibration step below has been completed and a household member has
  cleared it (a simple boolean toggle in `practice_settings`, not an automatic threshold).
- Cache the result; never re-call the provider merely to reopen previously computed feedback.
- `practice_settings`'s monthly cap gets its own small settings UI reusing
  `BudgetCategoryLimitsModal`'s exact interaction shape (one numeric field, "leave blank for no cap,"
  Cancel/Save) rather than a new limits component.

## Calibration (the actual Phase 6 gate — intentionally lighter than the source document's full harness)

1. Mark a handful (not dozens) of already self/partner-graded Phase 5 attempts as `is_benchmark`.
2. Run "Grade with AI" against each marked attempt.
3. Show a simple side-by-side comparison (AI score vs. self/partner score, per rubric component) for
   just those benchmark attempts — a small view, not a statistics dashboard.
4. A named household member reviews the comparison and decides whether the AI grades are close enough
   to be useful. If yes, they clear the "provisional" flag in `practice_settings`; if not, AI grading
   stays labeled provisional (or a different provider/model pair is tried) until it is.
5. This is the entire calibration requirement for Phase 6. The source document's full independent,
   blinded, multi-reviewer gold-standard evaluation set remains available as a future, optional,
   higher-rigor replacement for this step — it is not built now.

## Loading and error states

Same established language as the rest of the app. If the AI call fails: "Couldn't get an AI grade
right now — your answer and any other feedback are unaffected," with Retry. If the spending cap would
be exceeded: state that plainly and point at self/partner grading instead of silently disabling the
button with no explanation.

## Implementation order and commits

1. **Schema and Edge Function skeleton**
   - Migration, `practice_settings`, the Edge Function with provider selection and structured-output
     validation (no client UI yet — test via direct function calls).
   - Commit: `feat(practice): add AI grading schema and edge function`
2. **Cost controls**
   - Monthly spend computation, hard ceiling, `practice_settings` limit UI (reusing
     `BudgetCategoryLimitsModal`'s shape).
   - Commit: `feat(practice): add AI grading spending controls`
3. **Client grading UX**
   - "Grade with AI" action, cost estimate confirmation, result display, provisional badge.
   - Commit: `feat(practice): add AI grading to the attempt view`
4. **Calibration**
   - Benchmark marking, comparison view, provisional-flag toggle.
   - Commit: `feat(practice): add household AI grading calibration`

## Required automated checks

Run after every batch:

```bash
npm run build
npm run lint
```

## Manual verification checklist

1. With no provider configured, Practice Mode behaves exactly as it did at the end of Phase 5.
2. "Grade with AI" sends only the caller's own answer — confirm via the Edge Function's outgoing
   request that no partner data is included.
3. A regrade (rubric or prompt version bumped) inserts a new `attempt_feedback` row; the prior one is
   untouched.
4. Exceeding the household's configured monthly cap blocks further AI grading with a clear message;
   the hard application ceiling blocks it even if the household cap is unset.
5. A fabricated/unmatched citation in a model response is flagged as an uncertainty, never silently
   scored as correct.
6. A provider failure leaves the attempt and existing feedback completely intact.
7. The "Provisional" badge is present until a household member clears it via the calibration view, and
   absent afterward.
8. `npm run build` passes; `npm run lint` introduces no new warnings.

## Explicitly deferred

- The full independent, blinded, multi-reviewer gold-standard evaluation harness.
- Controlled question variation generation.
- Timed Bar Simulation mode.
- Syllabus upload/ingestion.
- Batch API usage, prompt caching, and provider auto-recharge.

## Stop conditions

Stop and report the exact issue before proceeding if:

- Phase 5's `practice_attempts`/`attempt_feedback` schema does not exist yet — there is nothing for
  this phase's migration to `alter`.
- No provider API key can be provisioned as a server-side secret without exposing it to the browser.
- The chosen provider's structured-output mode cannot reliably return evidence spans as validatable
  character offsets into the submitted text.
- A requested adjustment belongs to the Explicitly deferred list.

Phase 5 being uncommitted, unreviewed, or not yet calibration-tested is explicitly not a stop
condition — only its schema needing to exist first is.

## Definition of done

Phase 6 is complete when all four implementation batches are committed, build and lint pass with no
new warnings, AI grading works end to end for at least one provider, spending controls are verified to
actually block further grading once exceeded, and no partner data ever reaches the grading request.
The household's calibration comparison and provisional-label decision is separate follow-up work, not
a gate on this definition of done — the feature should ship correctly labeled "Provisional" by default
and simply wait for that human decision, rather than implementation being blocked on it. A grading
path that silently fabricates a citation or exposes a provider key to the browser is not complete
regardless.
