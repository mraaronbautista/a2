# Phase 2 Execution Plan: PDF Reading Workspace

This document is authoritative for Phase 2. Implement it as written. Do not redesign the data
model, add adjacent features, or refactor Phase 1 code unless an integration step below explicitly
requires it. If an assumption is invalid, stop and report the exact conflict instead of inventing an
alternative.

## Outcome

Let an A2 user attach a PDF to a course reading and open it in a private, responsive reading
workspace. The workspace must preserve the original PDF, render its real pages, remember each
user's position, provide thumbnails, outline navigation, search, bookmarks, text highlights, typed
page notes, citations, a locally extracted reflow view, printing/download, and linked A2 notes. It
must work without AI, paid APIs, server-side conversion, or usage credits.

## Fixed product decisions

1. Phase 2 supports PDF only. EPUB, DOCX, images, and audio are later phases.
2. Never convert a PDF to DOCX. The uploaded PDF remains the authoritative source.
3. Use PDF.js in the browser for rendering, outlines, links, text extraction, and search.
4. Do not upload extracted PDF text to an AI provider or conversion service.
5. A reading belongs to exactly one course. Its PDF is stored privately in Supabase Storage.
6. One reading has zero or one source PDF. Replacing the file is out of Phase 2; delete and re-add
   is the supported workflow.
7. Progress, bookmarks, highlights, and typed annotations are per-user. Partners do not see or
   overwrite one another's reading state.
8. Linked A2 notes use the existing note model and existing Phase 1 editor. The link stores the
   source page, selected quotation when available, and creation time.
9. PDF page numbers are stable citations. Display page index `1..N`; do not infer printed labels
   such as roman numerals.
10. Text search and reflow work only when the PDF contains an extractable text layer. A scanned
    image-only PDF remains readable as original pages and shows a clear limitation message.
11. OCR is not Phase 2. Do not add Tesseract, cloud OCR, or an OCR database state.
12. Highlights are text-selection annotations anchored by page number plus PDF.js text-item
    positions. They are not freehand marks.
13. Typed annotations are page-level notes with an optional selected quotation. Do not build
    comments, threads, replies, or collaboration.
14. Phase 2 does not include handwriting, drawing, shapes, lasso tools, signatures, or Apple Pencil
    ink. Those belong to Phase 4.
15. Phase 2 does not edit the PDF binary. Annotations are stored separately in Postgres and shown
    as an overlay or side panel.
16. Printing prints the original PDF through the browser. Download returns the unmodified original.
    Do not burn annotations into the file.
17. Search runs locally in the browser. Extracted text may be cached in IndexedDB, never required
    in Postgres.
18. Reflow is an accessibility/reading view, not a document editor. It preserves page boundaries
    and links every block back to its original page.
19. The main A2 sidebar remains visible on desktop unless the user enters reader full screen. On
    iPad and phone, the reading workspace uses all available content width.
20. Use the existing A2 visual tokens and components. Do not introduce a new design system.
21. No AI, API keys, paid services, analytics SDK, telemetry service, or new backend runtime.
22. Existing URL-only and title-only reading records must continue to work unchanged.

## Preconditions

Do not begin Phase 2 implementation until all are true:

- Phase 1 is complete, committed, and `npm run build` passes.
- The Phase 1 migration name is final.
- `notes` supports the Phase 1 freeform note defaults used by linked-note creation.
- Work begins on a separate branch/worktree named `claude/phase-2-pdf-reader` or equivalent.
- The existing uncommitted Phase 2 draft is either committed to that branch as a starting point or
  deliberately excluded. Never overwrite it blindly.

Use the next available migration number. If `0023_paginated_notes.sql` is final, use
`0024_pdf_reading_workspace.sql`. Phase 2 gets exactly one migration.

## Dependencies

Use these packages and no competing PDF framework:

- `pdfjs-dist`: PDF loading, page rendering, outline, text content, and text selection support.
- Existing React, React Router, Supabase client, Tailwind, and Vite dependencies.

Do not add React PDF Viewer, PSPDFKit, Apryse, PDFTron, Nutrient, Adobe PDF Embed, Mammoth,
LibreOffice, Tesseract, or a server PDF worker.

Configure the PDF.js worker through a Vite-resolvable module URL. Do not use a public CDN. Match the
worker to the installed `pdfjs-dist` version.

## Database schema

### Extend `reading_items`

Add exactly these nullable columns:

| Column | Type | Rules |
|---|---|---|
| `storage_path` | `text` | unique; private bucket object path |
| `original_name` | `text` | original filename, max 255 in UI |
| `mime_type` | `text` | null or `application/pdf` |
| `size_bytes` | `bigint` | null or `0..52428800` |

Add database checks:

- `size_bytes is null or size_bytes between 0 and 52428800`
- `mime_type is null or mime_type = 'application/pdf'`
- File metadata is all-or-none: when `storage_path` is null, `original_name`, `mime_type`, and
  `size_bytes` must also be null; when it is non-null, all three metadata fields must be non-null.

Do not add extracted text, page count, progress, or annotations to `reading_items`.

### `reading_progress`

Create exactly these columns:

| Column | Type | Rules |
|---|---|---|
| `reading_item_id` | `uuid` | FK reading_items, cascade |
| `user_id` | `uuid` | FK auth.users, cascade |
| `page_number` | `integer` | required, default 1, minimum 1 |
| `page_count` | `integer` | nullable, minimum 1 |
| `zoom_mode` | `text` | `fit-width`, `fit-page`, or `custom`; default `fit-width` |
| `zoom_value` | `numeric(4,2)` | required, default 1.00, range 0.50..3.00 |
| `view_mode` | `text` | `page` or `reflow`; default `page` |
| `updated_at` | `timestamptz` | required, default now |

Primary key: `(reading_item_id, user_id)`.

The client updates progress after a 750 ms debounce and on page/view change. It must not write on
every scroll event.

### `reading_bookmarks`

Create exactly these columns:

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK, generated UUID |
| `reading_item_id` | `uuid` | FK reading_items, cascade |
| `user_id` | `uuid` | FK auth.users, cascade |
| `page_number` | `integer` | required, minimum 1 |
| `label` | `text` | required, default empty, max 120 in UI |
| `created_at` | `timestamptz` | required, default now |

Unique constraint: `(reading_item_id, user_id, page_number)`.

Create index `(reading_item_id, user_id, page_number)`.

### `reading_annotations`

Create one table for highlights and typed page notes:

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK, generated UUID |
| `reading_item_id` | `uuid` | FK reading_items, cascade |
| `user_id` | `uuid` | FK auth.users, cascade |
| `page_number` | `integer` | required, minimum 1 |
| `kind` | `text` | `highlight` or `note` |
| `color` | `text` | `yellow`, `green`, `blue`, `pink`, or `purple` |
| `quoted_text` | `text` | nullable, max 10,000 characters in UI |
| `body` | `text` | required, default empty, max 20,000 characters in UI |
| `anchor` | `jsonb` | nullable; fixed structure below |
| `created_at` | `timestamptz` | required, default now |
| `updated_at` | `timestamptz` | required, default now |

Highlight rows require non-empty `quoted_text` and non-null `anchor`. Note rows may have both null.
Create indexes `(reading_item_id, user_id, page_number)` and `(user_id, updated_at desc)`.

The only valid `anchor` structure is:

```json
{
  "version": 1,
  "rects": [{"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.025}],
  "textStart": 14,
  "textEnd": 42
}
```

Rectangle values are normalized to page width/height and must be clamped to `0..1` in the client.
`textStart` and `textEnd` are offsets into the locally concatenated page text and are secondary
recovery data. The rectangles are the visual anchor.

### `reading_note_links`

Create exactly these columns:

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK, generated UUID |
| `reading_item_id` | `uuid` | FK reading_items, cascade |
| `note_id` | `uuid` | FK notes, cascade |
| `page_number` | `integer` | required, minimum 1 |
| `quoted_text` | `text` | nullable, max 10,000 characters in UI |
| `annotation_id` | `uuid` | nullable, FK reading_annotations, set null |
| `created_by` | `uuid` | required, FK auth.users, cascade |
| `created_at` | `timestamptz` | required, default now |

Unique constraint: `(reading_item_id, note_id)`.

Do not copy full extracted page text into this table.

## Storage contract

Create private bucket `reading-files` with:

- `public = false`
- allowed MIME type `application/pdf`
- file size limit 50 MiB

Every object path is exactly:

```text
<uploader-user-id>/<course-id>/<reading-id>/<sanitized-original-name>
```

Generate the reading ID before upload. Filename sanitization replaces `/`, `\\`, control
characters, and repeated whitespace with `-`; retain a `.pdf` suffix. The database stores the exact
object path returned by the upload.

Upload transaction behavior:

1. Validate file locally.
2. Generate reading ID and storage path.
3. Upload the PDF with `upsert: false`.
4. Insert `reading_items` using the generated ID and file metadata.
5. If insert fails, remove the uploaded object and show the database error.
6. If cleanup fails, report both failures; do not claim success.

Deletion behavior:

1. Confirm with the user.
2. Remove the storage object first.
3. If storage removal fails, keep the database row and report the error.
4. Delete the reading row only after successful storage deletion.
5. Cascade deletes remove per-user state, annotations, and links.

## Row-level security

All new tables must have RLS enabled.

### Reading files

- Select: any household member who can select the parent course/reading.
- Insert: authenticated uploader path must begin with `auth.uid()` and the path course ID must be a
  course the user may manage.
- Delete: course owner, or either household member when the course is shared.
- Update: no policy. Files are immutable.

Do not depend only on path ownership for read access.

### Per-user tables

For `reading_progress`, `reading_bookmarks`, and `reading_annotations`:

- Select/insert/update/delete only when `user_id = auth.uid()`.
- The referenced reading must belong to a course visible to the current household member.
- Prevent changing `user_id` to another account through the `with check` expression.

### Reading-note links

- Select: user can access both reading and note.
- Insert: `created_by = auth.uid()` and user can access both reading and note.
- Delete: creator, note owner, or manager of the shared parent course.
- Update: no policy; link rows are immutable.

Never use `exists (select 1 from notes where id = ...)` without applying explicit household and
private-note ownership rules in the policy.

## TypeScript types

Update the generated/manual `Database` type for every migration column and table. Do not use `any`
or broad type casts to hide a schema mismatch.

Create `src/lib/readingTypes.ts` with:

```ts
export type ReaderViewMode = 'page' | 'reflow'
export type ReaderZoomMode = 'fit-width' | 'fit-page' | 'custom'
export type AnnotationKind = 'highlight' | 'note'
export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

export interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

export interface TextAnchor {
  version: 1
  rects: NormalizedRect[]
  textStart: number
  textEnd: number
}

export interface ExtractedPage {
  pageNumber: number
  text: string
  blocks: Array<{ text: string; heading: boolean }>
}

export interface PdfSearchResult {
  pageNumber: number
  matchCount: number
  snippet: string
}
```

## Routes

Add exactly one route:

```text
/readings/:readingId
```

Route behavior:

- Auth is inherited from the existing protected app shell.
- Missing/inaccessible reading shows `Reading not found` with a link to `/notes?view=courses`.
- Reading without a PDF redirects to its course page and shows a non-blocking message there, or
  renders an explanatory state with a Back link. Pick the existing app's established message
  mechanism; do not add a toast framework.
- Browser Back returns to the course naturally. The explicit Back control links to the course.

## Required files

Create:

```text
src/routes/ReadingDetail.tsx
src/components/reader/PdfDocument.tsx
src/components/reader/PdfPage.tsx
src/components/reader/ReaderToolbar.tsx
src/components/reader/ReaderSidebar.tsx
src/components/reader/PageThumbnail.tsx
src/components/reader/SearchPanel.tsx
src/components/reader/BookmarksPanel.tsx
src/components/reader/AnnotationsPanel.tsx
src/components/reader/ReflowView.tsx
src/components/reader/CreateLinkedNoteDialog.tsx
src/hooks/usePdfDocument.ts
src/hooks/useReadingProgress.ts
src/hooks/useReadingAnnotations.ts
src/lib/pdfText.ts
src/lib/readingTypes.ts
```

Modify only as required:

```text
package.json
package-lock.json
src/App.tsx
src/routes/CourseDetail.tsx
src/components/courses/AddReadingButton.tsx
src/components/courses/ReadingItemRow.tsx
src/types/database.ts
supabase/migrations/<next>_pdf_reading_workspace.sql
```

Do not modify Phase 1 editor files except for importing an existing shared type if compilation
requires it. Do not reorganize existing routes, course components, or CSS globally.

## Add-reading behavior

Keep the existing Single/Bulk switch.

### Single mode

Fields in order:

1. Reading title, required.
2. Source link, optional URL.
3. PDF file, optional.
4. Due date, optional.

Client validation for a selected file:

- MIME is `application/pdf` or filename ends in `.pdf` when Safari omits MIME.
- First five bytes decode to `%PDF-`; reject renamed non-PDF files.
- File is no larger than 50 MiB.
- Title defaults once from the filename without `.pdf`; later file changes do not overwrite a title
  the user edited.

Disable modal dismissal and Submit while uploading. Show `Uploading…`, then `Saving…`. Preserve
entered fields after failure. Reset only after full success.

### Bulk mode

- One trimmed, non-empty line creates one title-only reading.
- No PDF upload, URL parsing, or due-date parsing.
- Maximum 200 lines per submission.
- Preserve order exactly.

## Course reading-list behavior

- A PDF reading's title opens `/readings/:readingId`.
- A URL-only reading opens its source link in a new safe tab.
- A title-only reading has no click destination.
- Show metadata `PDF · Read in A2` for attached PDFs.
- Keep existing read/unread, prep status, due date, ordering, note creation, and delete controls.
- Keyboard focus and click targets must not conflict: clicking status controls must never navigate.
- PDF rows expose a Download action only inside the reader, not as a competing primary row action.

## Reader information architecture

The reader has four persistent regions:

1. Top toolbar: Back, document/course title, sidebar toggle, view toggle, bookmark, `+ Note`, print,
   download, full screen.
2. Left sidebar: tabs for Pages, Outline, Search, Bookmarks, Annotations.
3. Center viewport: original PDF page or reflowed text.
4. Bottom status bar: previous/next, page input, page count, zoom controls.

Desktop sidebar width is 272 px. It is collapsible. iPad sidebar overlays at 300 px in portrait and
may remain docked in landscape. Phone uses a bottom sheet/drawer and never permanently consumes
horizontal space.

## PDF loading and lifecycle

1. Load reading metadata, course metadata, progress, bookmarks, and annotations in parallel.
2. Download the private object as a Blob through the authenticated Supabase client.
3. Convert the Blob to `ArrayBuffer` and pass it to PDF.js.
4. Use the bundled PDF.js worker.
5. Set page count from `pdf.numPages` and clamp saved progress to `1..numPages`.
6. Start at saved page, else page 1.
7. Cancel active PDF render tasks before rerendering a canvas.
8. Destroy the PDF.js document and revoke all object URLs on unmount.
9. Ignore stale async responses after reading ID changes or unmount.

Password-protected PDF: show `This PDF is password protected and cannot be opened in A2 yet.` Do
not build a password prompt in Phase 2.

Corrupt/unsupported PDF: show `A2 could not open this PDF. The original file was not changed.`

## Page rendering

- Render one main page at a time, centered on a neutral darker workspace.
- Render at `devicePixelRatio` for sharp text while keeping CSS dimensions in logical pixels.
- Maximum backing canvas dimension is 8192 px; reduce render scale if necessary.
- Show a skeleton while a page renders and retain the previous page until the new canvas is ready.
- Preserve page aspect ratio.
- Default zoom mode is Fit width.
- Zoom range is 50%..300% in 10% increments.
- Fit width subtracts viewport padding and never introduces horizontal scrolling at 100% layout.
- Fit page accounts for both available width and height.
- Custom zoom may scroll in both directions.
- Rotation is view-only in 90-degree increments and is session-only in Phase 2.

Use a PDF.js text layer over the main page so selection works. Thumbnails do not need a text layer.

## Navigation

- Previous/next buttons clamp to valid pages.
- Page input accepts integers only and commits on Enter or blur.
- Invalid input restores the current page.
- Keyboard shortcuts outside text inputs: Left/PageUp = previous, Right/PageDown = next, Home = 1,
  End = last page, `+`/`-` = zoom, `0` = fit width, `b` = bookmark.
- Do not intercept browser shortcuts using Meta/Ctrl.
- Changing page scrolls the reader viewport to the page top.
- Saved progress updates after navigation without blocking rendering.

## Thumbnails and outline

- Render thumbnails lazily using `IntersectionObserver`.
- Keep at most 20 thumbnail canvases mounted around the visible sidebar region.
- Current page has accent border and `aria-current="page"`.
- Bookmark indicator appears on bookmarked thumbnails.
- Clicking a thumbnail navigates and closes the phone drawer.

Outline:

- Use `pdf.getOutline()`.
- Display nested levels with indentation.
- Resolve destinations using `getDestination`/`getPageIndex`.
- External outline URLs open in a new tab with `noopener,noreferrer`.
- If no outline exists, show `This PDF has no table of contents.`

## Search

- Search is case-insensitive literal text search, not regex.
- Minimum query length is 2 characters.
- Start after 300 ms debounce or immediately on Enter.
- Extract pages incrementally and show progress `Searching page X of N…`.
- Each result is grouped by page and includes page number, match count, and a snippet with at most
  100 surrounding characters.
- Clicking a result opens that page. Highlighting the exact occurrence on canvas is not required.
- A new query cancels/invalidates the prior query.
- Empty query clears results.
- If the document has no extractable text, show the scanned-PDF limitation once.
- Cache extracted `ExtractedPage[]` in IndexedDB by a key derived from reading ID, size, and storage
  path. Cache failure must not break reading.

## Reflow view

Reflow uses the same locally extracted page text.

- Preserve page groups with headings `Page N` and stable anchors.
- Selecting `Page N` returns to original-page view on that page.
- Default font size 18 px; choices 16, 18, 20, 22, 24.
- Line-height choices 1.4, 1.6, 1.8; default 1.6.
- Content width choices Narrow 640 px, Medium 760 px, Wide 920 px; default Medium.
- Themes: A2 light, Sepia, Dark. Theme applies only inside reflow content.
- Paragraph direction follows PDF item order. Do not claim correct multi-column reconstruction.
- Preserve line/paragraph breaks heuristically; never change or summarize wording.
- Reflow controls are stored locally, not in Postgres. Only `view_mode` is synchronized.
- If no text layer exists, disable Reflow and explain why.

## Bookmarks

- Bookmark button toggles the current page.
- Optimistically update, then revert and show inline error on database failure.
- Sidebar lists bookmarks in page order.
- Optional bookmark label is edited inline and saved on blur/Enter.
- Deleting a bookmark requires no confirmation because it is easily recreated.
- Bookmark state is private to the current user.

## Highlights and annotations

### Create highlight

1. User selects text in the main PDF text layer.
2. Selection must be entirely inside one PDF page.
3. Show a compact selection popover: five colors, `Add note`, `Copy citation`.
4. Normalize selection rectangles against the page container.
5. Save a `highlight` row with quoted text, color, anchor, and empty body.
6. Render translucent rectangles behind/over the text layer without blocking selection.

Cross-page selection is unsupported. Show `Highlight one page at a time.`

### Typed page note

- `Add note` creates/opens a `note` annotation for the current page.
- If text is selected, copy it into `quoted_text` and include an anchor.
- Body is plain text, autosaved after 600 ms, and shows Saved/Saving/Error.
- Empty note with no quotation is deleted when its editor closes.
- Annotation panel groups items by page, then creation time.
- Clicking an annotation navigates to its page.
- Deleting an annotation requires confirmation only when body is non-empty.

Annotations are never embedded into Phase 1 Tiptap JSON.

## Citations

Use one fixed citation format:

```text
<Reading title>, p. <page number>
```

When quoted text exists, clipboard content is:

```text
“<quoted text>” — <Reading title>, p. <page number>
```

Normalize internal whitespace and cap copied quotation at 1,000 characters. Use curly quotation
marks as shown. `Copy citation` writes only to the clipboard and shows `Citation copied` for two
seconds. Do not generate Bluebook citations in Phase 2.

## Linked A2 notes

The `+ Note` action opens a small dialog instead of creating immediately.

Fields/state:

- Fixed source: reading title and current page.
- Optional selected quotation, read-only preview.
- Note title, default `<Reading title> — p. <page>`.
- Visibility, default shared when the course is shared and private when the course is private.
- Actions: Cancel, Create note.

On submit, perform one database RPC `create_reading_linked_note` that atomically:

1. Validates access to the reading/course.
2. Creates a `freeform` Law note owned by `auth.uid()`, associated with the reading's course.
3. Creates `reading_note_links` with page, quotation, optional annotation ID, and creator.
4. Returns the note ID.

The new note body starts with a normal paragraph containing the quotation when present, followed by
a paragraph containing the fixed citation. If Phase 1's initial Tiptap JSON helper exists, reuse it;
otherwise add a small pure helper under `src/lib`, not inside the reader route.

Navigate to `/notes/:noteId` only after both records commit. On failure, remain in the reader and
show the exact error. Do not leave an unlinked orphan note.

## Print, download, and full screen

- Download creates a temporary object URL for the original Blob, uses `original_name`, clicks a
  temporary anchor, then revokes the URL.
- Print opens the original Blob in a temporary same-origin browser tab or printable iframe and
  invokes the browser print dialog after load. It prints all original pages.
- Neither action includes stored overlays.
- Full screen targets the reader root through the Fullscreen API.
- Listen for `fullscreenchange` so the button label/state stays correct.
- If Fullscreen API is unavailable, hide the control.

## Responsive behavior

### Desktop, 1024 px and wider

- Docked/collapsible 272 px sidebar.
- Single-row toolbar where space permits.
- Page centered with 32 px workspace padding.
- Bottom navigation/status remains visible.

### iPad portrait, 768..1023 px

- Sidebar opens as a 300 px overlay with scrim.
- Toolbar allows two compact rows.
- Touch targets are at least 44x44 px.
- Fit width is recalculated on orientation change.
- Text selection popover stays within visual viewport and avoids the software keyboard.

### Phone, below 768 px

- Sidebar is a bottom sheet capped at 80dvh.
- Toolbar shows Back, title, panels, view, and More. Bookmark, note, print, download, and full screen
  live in More.
- Bottom bar shows previous, `N / total`, next, and zoom/view menu.
- Default page mode fits width with 12 px side padding.
- Reflow is promoted beside Page view because it is the most readable phone mode.
- No horizontal overflow unless the user deliberately chooses custom zoom above fit width.
- Respect top/bottom safe-area insets.

## Loading, empty, and error states

- Metadata load: centered `Opening reading…`.
- File download: progress cannot be known reliably; show `Downloading PDF…` with indeterminate bar.
- PDF parse: `Preparing pages…`.
- Page render: canvas skeleton.
- Search: incremental status.
- Missing file: explanation plus Back to course.
- Offline with no cached Blob: `This reading is unavailable offline.` Retry button.
- Network/database errors: show inline error and Retry; preserve current reader state.
- Annotation mutation failure: preserve draft locally and offer Retry.

Do not show raw stack traces, storage paths, or Supabase policy text to end users. Log technical
details only in development.

## Realtime behavior

- Do not subscribe to another user's progress/bookmarks/annotations.
- Subscribe to `reading_items` only to detect deletion or metadata change of the open reading.
- If the reading is deleted remotely, stop saving and show `This reading was deleted.` with Back.
- Phase 2 makes no claim of simultaneous annotation collaboration.

## Accessibility

- Every icon-only control has an accessible name and visible tooltip/title.
- Sidebar tabs use correct tab/list semantics and keyboard navigation.
- Current page uses `aria-current`.
- Search status and save failures use polite live regions.
- Dialog traps focus, closes on Escape when not uploading/saving, and restores trigger focus.
- Scrims and drawers are keyboard dismissible.
- Color is never the only indication of selected annotation or current page.
- Reflow content is selectable semantic text with real headings for page boundaries.
- Reader remains usable at 200% browser zoom.
- Respect reduced-motion preference; no animated page turns.

## Performance limits

- Never render every full-size page canvas simultaneously.
- Keep exactly one main page canvas mounted.
- Lazy-render thumbnails and release distant canvases.
- Cache page text promises during the session so search and reflow share extraction work.
- Avoid setting React state once per PDF text item; update by page/batch.
- Do not put the PDF ArrayBuffer, Blob, extracted full text, or PDF.js proxies into global context.
- A 500-page text PDF must remain navigable before full search extraction completes.

## Implementation order and commits

Implement in this order. Run the listed check before each commit. Do not combine batches unless the
preceding batch is already committed and verified.

1. **Database and storage**
   - Migration, RLS, bucket, RPC, and TypeScript database types.
   - Check migration manually for all access paths; run build.
   - Commit: `feat(reading): add private PDF workspace schema`
2. **Upload integration**
   - Install/configure PDF.js, add file validation and transactional upload cleanup, update rows.
   - Verify title-only, URL-only, valid PDF, fake PDF, oversized PDF, and failed insert.
   - Commit: `feat(reading): upload course PDFs privately`
3. **Reader shell and rendering**
   - Route, document hook, authenticated download, main canvas, toolbar, navigation, zoom, cleanup.
   - Verify multi-page, rotated, corrupt, password-protected, and 200-page PDFs.
   - Commit: `feat(reading): render PDFs in responsive reader`
4. **Pages and outline**
   - Lazy thumbnails, active page, bookmark markers, PDF outline resolution, responsive drawers.
   - Verify no-outline and nested-outline documents.
   - Commit: `feat(reading): add page and outline navigation`
5. **Search and reflow**
   - Shared local extraction, incremental search, IndexedDB cache, reflow controls, scanned fallback.
   - Verify normal text, multi-column, and image-only PDFs.
   - Commit: `feat(reading): add local search and reflow view`
6. **Progress and bookmarks**
   - Per-user restored page/view/zoom and bookmark CRUD/labels with optimistic rollback.
   - Verify isolation using both fixed accounts.
   - Commit: `feat(reading): save private progress and bookmarks`
7. **Annotations and citations**
   - Text layer selection, normalized highlights, typed notes, panel, copy citation.
   - Verify zoom/rotation alignment and cross-page rejection.
   - Commit: `feat(reading): add highlights notes and citations`
8. **Linked notes**
   - Dialog, atomic RPC, initial content, source metadata, navigation to Phase 1 editor.
   - Verify private/shared defaults and rollback on failure.
   - Commit: `feat(reading): create source-linked A2 notes`
9. **Print, download, full screen, and hardening**
   - Original-file actions, responsive polish, accessibility, errors, performance cleanup.
   - Run full verification below.
   - Commit: `fix(reading): harden responsive PDF workspace`

## Required automated checks

Run after every batch:

```text
npm run build
npm run lint
```

Before handoff also run the project's test command if one exists. Do not add a test framework solely
for Phase 2. Report pre-existing lint warnings separately; introduce zero new warnings or errors.

Run a focused diff review and confirm:

- No Phase 1 editor implementation was unintentionally changed.
- No secret, service key, PDF fixture, or generated build output was committed.
- No `any`, `@ts-ignore`, disabled lint rule, public storage URL, or CDN worker was introduced.
- Migration filename and `Database` types agree.

## Manual verification checklist

Use both A2 accounts and desktop, iPad portrait/landscape, and phone widths.

1. Existing title-only reading still renders and all old controls work.
2. Existing URL-only reading still opens its source safely.
3. A valid PDF under 50 MiB uploads and produces one database row/object.
4. Fake and oversized PDFs are rejected before upload.
5. Failed database insert cleans up its uploaded object.
6. Private storage object cannot be opened anonymously.
7. Both household users can open a shared-course PDF.
8. An unauthorized user cannot read the row, object, progress, bookmark, annotation, or note link.
9. Reader restores at the current user's last valid page.
10. Partner opens the same document with independent progress.
11. Previous/next, page input, Home/End, and thumbnails navigate correctly.
12. Fit width, fit page, custom zoom, and rotation render sharply.
13. Thumbnail list does not eagerly render every page.
14. Nested outline destinations navigate correctly; missing outline has an empty state.
15. Search finds literal text, reports match counts, and cancels a superseded query.
16. Reflow retains page boundaries and links back to original pages.
17. Image-only PDF disables search/reflow without blocking page reading.
18. Bookmark add/remove/label persists and is private per user.
19. Highlight remains aligned after zoom and available after reload.
20. Cross-page selection cannot create a malformed highlight.
21. Typed annotation autosaves and failed save preserves the draft.
22. Citation clipboard output matches the fixed format.
23. Linked-note RPC creates both note and source link or neither.
24. Linked note opens in the Phase 1 editor with correct course, visibility, quotation, and citation.
25. Downloaded bytes and filename match the original upload.
26. Print uses the original PDF and all pages.
27. Full screen enters/exits and restores controls correctly.
28. Deleting a reading removes the storage object and cascades state.
29. Desktop sidebar docks/collapses without covering the page.
30. iPad overlay and phone bottom sheet are dismissible and respect safe areas.
31. Phone fit-width has no accidental horizontal scrolling.
32. Keyboard-only navigation reaches every control and restores dialog focus.
33. Reader is usable at 200% browser zoom and with reduced motion.
34. `npm run build` passes.
35. `npm run lint` has no new warnings or errors.

## Explicitly deferred

Do not implement any of these during Phase 2:

- PDF-to-DOCX conversion or editable PDF text
- AI summaries, chat-with-PDF, embeddings, or semantic search
- OCR of scanned PDFs
- EPUB, DOCX, PowerPoint, images, audio, or web clipping
- Handwriting, drawing, Apple Pencil, shapes, signatures, or lasso tools
- Annotation export/burn-in or modified PDF downloads
- Bluebook or automatic legal citation generation
- Split-screen note editing
- Shared annotations, presence, comments, or conflict-free collaboration
- Offline PDF download management beyond incidental browser/IndexedDB cache
- Notebook filing, favorites, archive, covers, and library-wide search (Phase 3)
- Version history, backups, and bulk file import

## Stop conditions

Stop and report the exact issue before proceeding if:

- Phase 1 is uncommitted or does not build.
- The expected note schema/defaults differ from the linked-note requirements.
- The migration number is already used by different committed work.
- Existing Phase 2 files contain changes whose ownership or intended preservation is unclear.
- Supabase cannot enforce the required private bucket or RLS policies.
- PDF.js cannot be bundled locally with its matching worker.
- Implementing a requirement would require a paid service, AI credit, service-role key in the
  browser, public storage, or weakening an existing policy.
- A requested adjustment belongs to the Explicitly deferred list.

Do not solve a stop condition by deleting work, weakening security, changing Phase 1 architecture,
or silently shrinking the scope.

## Definition of done

Phase 2 is complete only when all nine implementation batches are committed, the migration and
manual `Database` type match, build passes, no new lint warning exists, every applicable manual
verification item passes, both household accounts have isolated personal reading state, private
PDF access has been verified, and the handoff lists any known limitation. A basic canvas that only
renders pages is not completion; search, reflow, bookmarks, annotations, citations, and atomic
linked notes are part of Phase 2.
