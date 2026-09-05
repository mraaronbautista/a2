# Phase 3 Execution Plan: Library Organization

This document is authoritative for Phase 3. Implement it as written. Do not redesign the data
model, add adjacent features, or refactor Phase 1/2 code unless an integration step below explicitly
requires it. If an assumption is invalid, stop and report the exact conflict instead of inventing an
alternative.

## Outcome

Turn the flat Law and personal note lists into organized libraries with notebooks, sections,
filing, favorites, recents, archive/restore, paper backgrounds, page navigation, previews, and
search. Preserve the existing Course model, Phase 1 editor, Phase 2 reader, and every existing note.

## Fixed product decisions

1. `Law` and `personal` remain separate spaces. No item can cross spaces.
2. Courses and notebooks are different concepts. A notebook may link to one course, but a course is
   never converted into a notebook.
3. A note may be filed in zero or one section. Zero means `Unfiled`.
4. A reading may be referenced in zero or one section while remaining in its course reading list.
5. Filing stores a reference; it never copies note or reading content.
6. Private notebooks accept only private items owned by the notebook owner. Shared notebooks accept
   only shared notes and readings from shared courses. Never change visibility silently.
7. Favorites and recents are per-user. Archive state is shared/canonical.
8. Deleting a notebook or section never deletes its contents. Contents become Unfiled.
9. Flow-document pages are generated layout pages. They can be navigated but never reordered,
   duplicated, or directly deleted.
10. Canvas-page reordering remains Phase 4. Do not create a second page persistence model now.
11. Built-in paper backgrounds are CSS-generated. Do not store background images.
12. Global Phase 3 search covers notebook/section names, note titles/tags/plain text, reading titles,
   and course names. Full PDF text remains searchable inside the Phase 2 reader; do not build a
   second PDF extraction pipeline in Phase 3.
13. No AI, paid APIs, paid OCR, analytics SDK, or new external service.
14. Use the existing visual tokens and interaction patterns. Do not introduce a new design system.

## Preconditions

Do not begin implementation until all are true:

- Phase 1 is committed and `npm run build` passes.
- Phase 2 is committed and `npm run build` passes.
- `0023_paginated_notes.sql` and `0024_pdf_reading_workspace.sql` are the final migration names.
- The generated/manual `Database` type includes both phases.
- Work begins on a separate branch/worktree named `codex/phase-3-library` or equivalent.

If migration numbers differ after Phase 1/2 review, use the next available number. There must be one
Phase 3 migration, named `<next>_library_organization.sql`.

## Database schema

### `notebooks`

Create exactly these columns:

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `household_id` | `uuid` | required, FK households, cascade |
| `owner_id` | `uuid` | required, FK auth.users, cascade |
| `course_id` | `uuid` | nullable, FK courses, set null |
| `space` | `text` | `law` or `personal` |
| `name` | `text` | required, trimmed, 1-100 characters |
| `description` | `text` | required, default empty, max 500 enforced in UI |
| `visibility` | `text` | `private` or `shared`, default `shared` |
| `cover` | `jsonb` | required, default fixed cover JSON below |
| `order_index` | `bigint` | required, default `1024` |
| `archived_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | required, default now |
| `updated_at` | `timestamptz` | required, default now |

Default cover:

```json
{"color":"#5b6478","pattern":"plain","icon":null}
```

Create indexes on `household_id`, `(household_id, space, archived_at)`, and `course_id`.

### `notebook_sections`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `notebook_id` | `uuid` | required, FK notebooks, cascade |
| `name` | `text` | required, 1-100 characters |
| `color` | `text` | nullable |
| `order_index` | `bigint` | required |
| `created_at` | `timestamptz` | required |
| `updated_at` | `timestamptz` | required |

Create index on `(notebook_id, order_index)`.

### `library_entries`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `section_id` | `uuid` | required, FK sections, cascade |
| `note_id` | `uuid` | nullable, FK notes, cascade |
| `reading_item_id` | `uuid` | nullable, FK reading_items, cascade |
| `order_index` | `bigint` | required |
| `created_at` | `timestamptz` | required |

Add `check (num_nonnulls(note_id, reading_item_id) = 1)`.

Add partial unique indexes so each note and each reading appears in at most one section:

- unique `note_id` where non-null
- unique `reading_item_id` where non-null
- index `(section_id, order_index)`

### Per-user state

Create `notebook_user_state`:

- `notebook_id uuid` FK notebooks cascade
- `user_id uuid` FK auth.users cascade
- `is_favorite boolean not null default false`
- `last_opened_at timestamptz null`
- `updated_at timestamptz not null default now()`
- primary key `(notebook_id, user_id)`

Create `note_user_state` with the same fields using `note_id` and primary key
`(note_id, user_id)`.

Extend existing `reading_progress`:

- `is_favorite boolean not null default false`
- `last_opened_at timestamptz null`

Do not create a polymorphic user-state table.

### Existing-table additions

Add to `notes`:

- `archived_at timestamptz null`
- `search_text text not null default ''`

Add to `reading_items`:

- `archived_at timestamptz null`

Do not migrate existing notes into notebooks. They appear as Unfiled automatically.

## RLS rules

Follow the existing A2 two-person co-management model.

### Notebooks

- Select: household member and (`shared` or owner).
- Insert: authenticated owner, household member, and linked course belongs to same household.
- Update/delete: owner or household member when shared.
- A personal notebook must have `course_id is null`; enforce with a check constraint.

### Sections and entries

- Access derives from accessible parent notebook.
- Entry insertion must validate item household, space, and visibility.
- Shared notebook: shared note or reading from a shared course only.
- Private notebook: private note owned by notebook owner only; readings are not allowed.
- Use `security definer` functions for move/delete/reorder operations. Set `search_path = public`.
- Do not trust client-side validation as the security boundary.

### User state

- A user can select/insert/update/delete only rows where `user_id = auth.uid()`.
- The referenced notebook/note/reading must also be accessible.

## Required database functions

Implement these functions in the Phase 3 migration:

1. `create_notebook_with_section(...)`
   - Creates notebook and initial `General` section atomically.
   - Returns notebook ID.
2. `file_note(target_note_id, target_section_id)`
   - Validates access/space/visibility.
   - Upserts the note's single library entry at the section end.
3. `file_reading(target_reading_id, target_section_id)`
   - Validates shared notebook/shared course and Law space.
   - Upserts the reading's single entry at the section end.
4. `move_library_entry(target_entry_id, target_section_id)`
   - Validates destination and moves atomically.
5. `remove_library_entry(target_entry_id)`
   - Deletes only the reference.
6. `delete_section_unfile(target_section_id)`
   - Deletes entries, then section. Source items survive.
   - Rejects deletion when it is the notebook's only section; caller must create/select replacement
     or delete notebook.
7. `delete_notebook_unfile(target_notebook_id)`
   - Deletes notebook; source items survive through entry cascades.
8. `reorder_notebook`, `reorder_section`, and `reorder_library_entry`
   - Accept target ID and adjacent IDs/destination.
   - Use `bigint` midpoint ordering.
   - Rebalance siblings to multiples of 1024 only when no integer midpoint exists.

All functions must validate `auth.uid()` and must never change note/notebook visibility.

## TypeScript domain types

Create `src/lib/libraryTypes.ts` containing only shared domain types:

```ts
export type LibrarySpace = 'law' | 'personal'
export type LibraryVisibility = 'private' | 'shared'
export type NotebookPattern = 'plain' | 'linen' | 'grid' | 'diagonal' | 'legal' | 'speckled'

export interface NotebookCover {
  color: string
  pattern: NotebookPattern
  icon: string | null
}

export interface LibraryItemSummary {
  id: string
  kind: 'note' | 'reading'
  title: string
  subtitle: string
  preview: string
  courseName: string | null
  sectionId: string | null
  sectionName: string | null
  notebookId: string | null
  notebookName: string | null
  visibility: LibraryVisibility
  isFavorite: boolean
  archivedAt: string | null
  updatedAt: string
}
```

Add the new tables/columns/functions to `src/types/database.ts`. Do not regenerate unrelated type
formatting.

## Plain-text extraction

Create `src/lib/notePlainText.ts`.

Implement one pure function:

```ts
export function notePlainText(content: JSONContent | null): string
```

Rules:

- Depth-first traversal of Tiptap JSON.
- Include text-node text.
- Add newlines between block nodes.
- Ignore image URLs and non-text attributes.
- Collapse repeated whitespace.
- Trim result.
- Cap persisted `search_text` at 200,000 characters.

Integration with Phase 1 is limited to adding `search_text: notePlainText(content)` to the existing
note save payload. Do not otherwise modify editor behavior.

For case briefs, concatenate Facts, Issue, Holding, Reasoning, and Dissent into `search_text` on save.

## Paper templates

Create `src/lib/paperTemplates.ts` with fixed built-ins:

- `blank`
- `ruled`
- `wide-ruled`
- `narrow-ruled`
- `grid`
- `small-grid`
- `dotted`
- `legal`

Add `template` to Phase 1's page settings with default `blank`. Treat missing values on old notes as
`blank`; do not run a data backfill.

Implement backgrounds with CSS gradients using physical millimeter spacing. Add one print option:
`Include paper background`, default off. Dark mode changes editor appearance but never forces a dark
printed page.

Do not add uploaded/custom templates in Phase 3.

## Page navigation contract

Create `src/components/notes/pagination/PageThumbnailRail.tsx` only after reading Phase 1's final
pagination API. Adapt to it; do not replace it.

For flow documents:

- Show page number and lazy preview.
- Clicking scrolls to that page.
- Selected page follows scroll position.
- No reorder/delete/duplicate buttons.
- Refresh affected previews 750 ms after editing stops.
- Render only visible thumbnails plus 2 before/after.

On phone, the rail becomes a bottom sheet. On desktop/iPad landscape it is a collapsible left rail.

## Routes

Add one route:

```text
/notebooks/:notebookId
```

Section selection uses `?section=<uuid>`. Do not add a route per section.

Existing routes remain canonical:

- `/notes/:noteId`
- `/readings/:readingId`
- `/courses/:courseId`

## Required files

Create:

```text
src/routes/NotebookDetail.tsx
src/components/library/LibrarySidebar.tsx
src/components/library/LibraryMobileFilters.tsx
src/components/library/LibrarySearch.tsx
src/components/library/LibraryFilters.tsx
src/components/library/LibraryItemCard.tsx
src/components/library/LibraryItemMenu.tsx
src/components/library/NotebookCard.tsx
src/components/library/NotebookCover.tsx
src/components/library/NotebookGrid.tsx
src/components/library/NotebookHeader.tsx
src/components/library/NotebookSection.tsx
src/components/library/MoveItemDialog.tsx
src/components/library/AddExistingDialog.tsx
src/components/library/NewNotebookDialog.tsx
src/components/library/EditNotebookDialog.tsx
src/components/library/NewSectionDialog.tsx
src/components/library/ArchiveDialog.tsx
src/components/library/LibraryEmptyState.tsx
src/hooks/useLibrary.ts
src/hooks/useNotebook.ts
src/hooks/useLibraryUserState.ts
src/lib/libraryTypes.ts
src/lib/libraryOrdering.ts
src/lib/libraryPermissions.ts
src/lib/libraryPreview.ts
src/lib/notePlainText.ts
src/lib/paperTemplates.ts
```

Do not create duplicate Supabase clients, editor components, PDF renderers, modal frameworks, icon
systems, or theme systems.

## Notes screen changes

Retain the top-level `Notes / Courses` switcher. Within Notes add this secondary navigation:

```text
All | Notebooks | Favorites | Recent | Unfiled | Archived
```

Rules:

- Default is `All`.
- Encode selection as `?library=all|notebooks|favorites|recent|unfiled|archived`.
- Preserve existing course filter and search where applicable.
- Add visible `New note` and `New notebook` actions. Do not route these through global Quick add.
- `All` excludes archived items.
- `Unfiled` means no `library_entries` row.
- `Recent` groups Today, Yesterday, Previous 7 days, and Older.
- `Archived` provides Restore and Delete; no inline editing.

For the personal notes area in Us, reuse the same library components with `space="personal"`. Do
not duplicate library business logic.

## Notebook screen behavior

Header contains:

- Back
- Cover
- Name
- Optional course badge
- Private/Shared badge
- Search within notebook
- New note
- Add existing
- Add section
- Overflow settings

Body displays ordered sections. Each section can collapse locally using `localStorage`; collapsed
state does not need database persistence.

Section actions:

- Rename
- Recolor
- Move up/down
- Delete and unfile

Item actions:

- Open
- Favorite/unfavorite
- Move
- Remove from notebook
- Archive
- Delete

Use explicit move dialogs and up/down controls first. Desktop drag-and-drop is optional polish only
after all acceptance tests pass. There must always be a non-drag alternative.

## Creating and filing

### New notebook

Fields:

- Name, required
- Description, optional
- Space fixed from current screen
- Visibility, default shared
- Course, Law only and optional
- Cover color/pattern/icon

Submit calls `create_notebook_with_section`. Open the created notebook after success.

### New note inside notebook

Pre-fill:

- Space from notebook
- Visibility from notebook
- Course from notebook, if any
- Section currently selected
- Type defaults to paginated for Law and freeform for personal

Create note first, then call `file_note`. If filing fails, preserve the note in Unfiled and show an
error; never delete the newly created note as rollback.

### Add existing

- Search accessible active items in the same space.
- Exclude already-filed items.
- Notes/readings tabs.
- Hide incompatible private/shared items; show an explanation count rather than disabled rows.
- Call only `file_note` or `file_reading`.

## Favorites and recents

- Add favorite buttons to notebook cards, note cards, reading cards, editor header, and reader
  header through shared components where possible.
- Upsert the appropriate user-state row.
- Record `last_opened_at` only after the item successfully loads.
- Recent shows at most 50 items, sorted descending.
- Archived or inaccessible items never appear in Recent/Favorites active views.

## Archive and deletion

### Archive notebook

Archive notebook only. Do not offer archive-all-contents in Phase 3.

### Archive note

- Set `notes.archived_at`.
- Preserve its library entry.
- Restore returns it to the same section.

### Archive reading

- Set `reading_items.archived_at`.
- Exclude it from Course lists and Timeline queries.
- Preserve progress, bookmarks, annotations, links, and library entry.

### Delete notebook/section

Call the database unfile functions. Display copy that explicitly says source content survives.

### Delete reading

Linked notes survive. File, progress, bookmarks, annotations, and link rows may be removed according
to existing Phase 2 cascade behavior.

## Previews

`libraryPreview.ts` returns:

- Paginated/freeform note: first non-empty 180 characters from `search_text`.
- Case brief: Issue first, then Holding, maximum 180 characters.
- Reading: filename plus `Page X of Y` from the current user's progress.
- Notebook: section count, active item count, and latest update.

Never fetch full note content merely to render the library. Use stored `search_text` and metadata.
Existing notes with empty `search_text` show no preview until next save; do not backfill in the
browser automatically.

## Query rules

- Fetch at most 50 library items initially.
- Add `Load more`; no infinite-scroll requirement.
- Never select PDF blobs in list queries.
- Exclude `archived_at is not null` unless Archived is selected.
- Search is debounced 250 ms.
- Trim search query and ignore queries under 2 characters for content search; title filtering may
  still occur client-side for one character.
- Preserve `library`, `course`, `type`, and `q` in URL search parameters.

## Responsive rules

### Desktop (`md` and wider)

- A2 sidebar remains.
- Library sidebar width: 224 px, collapsible.
- Main library content maximum width: 1100 px.
- Notebook grid: 3 columns when space permits, 2 on narrower desktop.

### iPad portrait

- Library sidebar collapsed by default.
- Notebook grid: 2 columns.
- Section tabs may scroll horizontally.
- Touch targets at least 44 px.

### Phone

- One-column cards.
- Secondary library navigation uses horizontally scrollable chips.
- Notebook/section picker and Move dialog use bottom sheets.
- Page thumbnails use bottom sheet.
- Do not require drag-and-drop.
- Respect safe-area insets and the existing mobile navigation.

## Loading and error states

Every query/mutation must have an explicit state:

- Skeleton for initial library/notebook load.
- Inline spinner for row mutation.
- Empty-state component for valid empty results.
- Inline error with Retry for reads.
- Preserve form values after mutation failure.
- Optimistic reorder/move with rollback on failure.
- Never blank the whole screen during realtime refresh.

Use existing A2 language: `Loading…`, `Saving…`, `Saved`, and concise recovery messages.

## Realtime behavior

Add `notebooks`, `notebook_sections`, and `library_entries` to relevant realtime subscriptions.
Do not reload while a local move/reorder mutation is pending. Ignore the mutation's immediate echo
using the same pattern already used for note autosave, then refresh.

User-state changes do not need cross-account realtime because they are private per user.

## Accessibility

- All icon-only buttons require `aria-label`.
- Menus and dialogs must be keyboard operable.
- Escape closes the topmost dialog.
- Focus returns to the trigger.
- Reorder actions announce the new position in an `aria-live` region.
- Color is never the only indicator for visibility/type/selection.
- Notebook covers require text labels; decorative patterns are hidden from assistive technology.
- Minimum touch target is 44 by 44 px on tablet/phone.

## Implementation order and commits

Use these exact batches. Build and lint after each batch. Do not combine all work into one commit.

1. **Schema**
   - Migration, RLS, functions, database types, domain types.
   - Commit: `Add Phase 3 library schema`
2. **Notebook CRUD**
   - Hooks, notebook cards/grid/dialogs, route, sections, Unfiled.
   - Commit: `Add notebook and section organization`
3. **Filing**
   - Library entries, Add existing, Move, Remove, ordering.
   - Commit: `Add note and reading filing`
4. **Personal integration**
   - Reuse components in Us personal notes.
   - Commit: `Extend notebooks to personal notes`
5. **Favorites, Recent, Archive**
   - User state, archive/restore, course/timeline exclusions.
   - Commit: `Add library favorites recents and archive`
6. **Search and previews**
   - Plain-text extraction, save integration, filters, previews, URL state.
   - Commit: `Add library previews and search`
7. **Paper and page navigation**
   - Built-in backgrounds and Phase 1 thumbnail adapter.
   - Commit: `Add paper templates and page navigation`
8. **Responsive/accessibility polish**
   - Device layouts, keyboard, focus, screen-reader labels, final tests.
   - Commit: `Polish Phase 3 library experience`

If the repository owner wants one final commit, squash only after review.

## Required verification

Run after every batch:

```bash
npm run build
npm run lint
git diff --check
```

Before completion, verify against a migrated local/test Supabase project:

1. Existing notes appear in All and Unfiled.
2. Existing course readings remain intact.
3. Create private/shared Law notebooks.
4. Create private/shared personal notebooks.
5. Create/rename/recolor/reorder/delete sections.
6. File and move compatible notes.
7. File and move a reading from a shared course.
8. Confirm incompatible visibility/space operations fail in the database, not only UI.
9. Delete a section and confirm source items survive in Unfiled.
10. Delete a notebook and confirm source items survive.
11. Favorite differs between the two user accounts.
12. Recent updates only after successful open.
13. Archive/restore note retains section membership.
14. Archive reading disappears from Course and Timeline and restores correctly.
15. Search finds titles, tags, case-brief text, Tiptap text, courses, notebooks, and sections.
16. Generated flow pages navigate but expose no move/delete actions.
17. Paper patterns retain physical spacing and print only when requested.
18. Test Safari desktop, iPad portrait/landscape, and iPhone-width responsive views.
19. Test keyboard-only create, move, archive, restore, and dialog dismissal.
20. Confirm no AI/API-credit/network conversion dependency was introduced.

## Stop conditions

Stop and report rather than improvise if:

- Phase 1 does not expose stable page elements or a page-navigation callback.
- Phase 2 changed the reading/progress schema described here.
- Migration numbering conflicts.
- Database policies cannot validate item visibility without changing existing RLS helpers.
- A required integration would replace or substantially rewrite Claude's Phase 1/2 implementation.
- An existing user could lose access or content through the proposed migration.

## Definition of done

Phase 3 is done only when all eight implementation batches are committed, all required verification
steps pass, existing content remains accessible, database-level permission tests pass, and the
feature works at desktop, iPad, and phone widths. Partial UI without RLS, migrations, responsive
behavior, or migration verification is not complete.

