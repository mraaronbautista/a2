# Phase 4 Addendum: Verified Against Real Phase 1/2 Code

This addendum sits on top of `PHASE_4_IMPLEMENTATION_PLAN.md`. Unlike the Phase 3 addendum (written
against a plan, before any code existed), this one was written after actually reading the committed
Phase 1-completion and Phase 2 code, so the SQL and integration points below are verified against
what's really in the repo, not inferred from a spec.

## 0. Precondition status

**Phase 4 still cannot start.** Its precondition is Phase 1, 2, *and* 3 committed and building. Phase
1 and 2 are committed (`631b6ce`, `f866495`) and verified — `npm run build`/`npm run lint` pass, and a
full manual-checklist pass against the actual code found the schema and core reader functionality
solid (see the separate Phase 2 verification writeup for the handful of real gaps found — none of
them touch anything Phase 4 depends on). Phase 3 is still unimplemented. Migration numbering is
therefore confirmed but conditional: Phase 2 landed as `0024_pdf_reading_workspace.sql` exactly as its
addendum specified, so Phase 3 remains `0025_library_organization.sql`, and Phase 4 remains
**`0026_canvas_pages.sql`** — contingent on Phase 3 actually shipping as `0025`.

## 1. What was re-verified, and what changed as a result

- **`src/components/notes/PaginatedEditor.tsx` still has no page-navigation API.** I diffed the
  Phase-1-completion commit (`631b6ce`) against it directly: that commit only added the responsive
  mobile toolbar (a collapsible `Tools` drawer) and scroll-area styling. It did not add
  `onPagesChange`, `onVisiblePageChange`, or any scroll-to-page handle. This doesn't affect Phase 4 at
  all — canvas notes are a wholly separate note type and never touch `PaginatedEditor` — but it's
  worth knowing this file is still exactly as unexposed as it was when the Phase 3 addendum was
  written, in case a future phase revisits it.
- **The real `reading_annotations` table differs slightly in wording from the Phase 2 addendum's
  draft SQL**, though not in effect. The committed constraint is:
  ```sql
  constraint reading_annotations_highlight_requires_anchor check (
    kind = 'note' or (quoted_text is not null and quoted_text <> '' and anchor is not null)
  )
  ```
  (it omits the redundant `kind = 'highlight' and` clause the addendum had, since `kind` can only be
  `'note'` or `'highlight'` at that point — functionally identical.) Section 2 below's `alter`
  statements target this exact committed text, not the addendum's draft.
- **The real `kind` check is unnamed** (`kind text not null check (kind in ('highlight', 'note'))`),
  so Postgres auto-named it `reading_annotations_kind_check` — confirmed by the same auto-naming
  convention already used deliberately elsewhere in this schema (`notes_type_check`, dropped and
  re-added by name in `0023_paginated_notes.sql`). The Phase 4 plan's SQL already assumed this exact
  name; no change needed there.
- **The real notes update/delete policy** (from `0008_shared_notes_editable.sql`, read directly) is:
  ```sql
  for update using (owner_id = auth.uid() or (visibility = 'shared' and is_household_member(household_id)));
  ```
  This confirms the Phase 4 plan's `can_edit_note` helper (Section "RLS rules" → `canvas_pages`) was
  modeled correctly — no change needed, just now verified rather than assumed.
- **Everything else in `PHASE_4_IMPLEMENTATION_PLAN.md`** — the `canvas_pages`/`canvas_signatures`
  schema, the element JSON shapes, the tool/input/page-management behavior, the stroke-smoothing
  dependency decision — required no changes. It was written from first principles rather than reacting
  to a mismatched draft, so there was nothing to reconcile there.

## 2. Final `alter` statements for `<next>_canvas_pages.sql`, against the real committed schema

Replace the placeholder `alter` statements in the base plan's "Extend `notes.type`" and "Extend
`reading_annotations`" sections with these exact statements (verified against the live migration
files, not inferred):

```sql
-- notes.type: same pattern 0023 already used for adding 'paginated'
alter table notes drop constraint if exists notes_type_check;
alter table notes add constraint notes_type_check check (type in ('case_brief', 'freeform', 'paginated', 'canvas'));

-- reading_annotations.kind: add 'ink' to the auto-named constraint from 0024
alter table reading_annotations drop constraint if exists reading_annotations_kind_check;
alter table reading_annotations add constraint reading_annotations_kind_check check (kind in ('highlight', 'note', 'ink'));

-- reading_annotations anchor shape: extend the real committed constraint (not the addendum's draft
-- wording) to also accept a valid ink anchor
alter table reading_annotations drop constraint if exists reading_annotations_highlight_requires_anchor;
alter table reading_annotations add constraint reading_annotations_anchor_shape_check check (
  (kind = 'note' and anchor is null)
  or (kind = 'highlight' and quoted_text is not null and quoted_text <> '' and anchor is not null)
  or (kind = 'ink' and quoted_text is null and anchor is not null)
);
```

Note the `kind = 'note' and anchor is null` clause is slightly stricter than the real committed
`note` case (which only required `kind = 'note'`, permitting a stray non-null anchor on a note row).
This is a deliberate tightening, not a bug: Phase 4 introduces a second anchor shape, so `note` rows
should now be constrained to `anchor is null` to prevent an ink or highlight anchor shape from ever
being attached to a `kind = 'note'` row. This does not affect any existing row, since Phase 2's own
`upsertNote` path never sets a non-null anchor for note-kind rows in the code as committed.

## 3. One thing to fix in Phase 2 before or alongside this work (not a Phase 4 task, but adjacent)

The Phase 2 verification pass found that `useReadingAnnotations.ts`'s `upsertNote` is a pure insert,
not an upsert — clicking `+ Note` twice on the same page creates two separate `kind = 'note'` rows
instead of editing the existing one. This is unrelated to Phase 4's schema work, but worth fixing
*before* Phase 4 ships its own `ink` kind on the same table, so the pattern isn't copied. If it's
still unfixed when Phase 4 starts, do not model the ink-annotation save path after `upsertNote` as it
currently exists — check for an existing row on that `(reading_item_id, user_id, page_number, kind)`
combination first, the same way `toggleBookmark` already correctly does for bookmarks in the same
file.

## 4. Everything else

No other part of `PHASE_4_IMPLEMENTATION_PLAN.md` needs revision. Proceed with it as written once
Phase 3 is committed and building, using the corrected `alter` statements in Section 2 above in place
of the base plan's placeholder versions.
