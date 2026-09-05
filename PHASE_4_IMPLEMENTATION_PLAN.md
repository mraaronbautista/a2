# Phase 4 Execution Plan: Canvas Pages, Ink, and PDF Markup

This document is authoritative for Phase 4. Implement it as written. Do not redesign the data model,
add adjacent features, or refactor Phase 1/2/3 code unless an integration step below explicitly
requires it. If an assumption is invalid, stop and report the exact conflict instead of inventing an
alternative.

## Outcome

Add a fourth note type, `canvas`, made of discrete, reorderable pages a user draws and writes on
freehand — pen, highlighter, eraser, basic shapes, movable text boxes, lasso select/move, and saved
signatures — with real Apple Pencil pressure support and palm rejection. Separately, let a user
hand-mark a PDF reading with the same ink tool, layered over the page as a new Phase 2 annotation
kind. Preserve every existing note type, the Phase 1 flowing-text pagination model, the Phase 2
reader, and Phase 3's library/notebook organization untouched.

## Fixed product decisions

1. `canvas` is a new sibling of `case_brief` / `freeform` / `paginated`, not a replacement for any of
   them. A note's type never changes after creation.
2. Canvas pages are literal, ordered, persisted rows — a second page-persistence model, deliberately
   introduced only now (Phase 3 explicitly deferred this). They are independent of Phase 1's
   flow-document pagination; the two mechanisms never share a table or a component.
3. A canvas page holds a flat array of elements: freehand strokes, basic shapes (rectangle, ellipse,
   line, arrow), plain text boxes, and signature placements. No rich text formatting inside a text
   box — font size and color only. This is a deliberate scope limit; a canvas text box is not a
   second rich-text editor.
4. Every canvas element has an explicit position and size in the page's physical coordinate space
   (millimeters, matching Phase 1/3's `PageSettings` model) so pages stay crisp at any zoom and print
   at the same physical size shown on screen.
5. Canvas pages reuse Phase 1/3's paper size, orientation, margin, and paper-background system
   unchanged. Do not create a second page-size or paper-pattern model.
6. A canvas note always has at least one page. Deleting a note's only page is rejected; deleting the
   note itself is unaffected.
7. Signatures are per-user, private, and reusable across any canvas page the user can edit. They are
   not shared between household members and are not tied to a specific note.
8. Undo/redo is local to the current editing session only. It is not persisted and does not survive a
   reload. Do not design a persisted operation log.
9. There is no real-time collaborative canvas editing. Two people editing the same shared canvas note
   at once follow the same last-write-wins-with-self-echo-suppression model already used by Phase 1/3
   notes; do not add operational transform or CRDT machinery.
10. PDF ink markup (Phase 2 integration) is a new `reading_annotations.kind = 'ink'`, reusing that
    table's existing per-user, per-page structure. It is not a new table and does not change how
    highlights or typed notes work.
11. Apple Pencil support means pressure-sensitive stroke width via the Pointer Events API and palm
    rejection while a pen is in contact. It does not mean tilt-based shading, Scribble-style
    handwriting-to-text, or any first-party Apple API — this is a web app, not a native iPad app.
12. No AI, OCR, handwriting recognition, paid API, analytics SDK, or new backend runtime. A drawn
    signature is a picture of a signature, not a verified electronic-signature product.
13. Use the existing A2 visual tokens and interaction patterns. Do not introduce a new design system,
    a second modal framework, or a second icon system.

## Preconditions

Do not begin implementation until all are true:

- Phase 1, 2, and 3 are committed and `npm run build` passes.
- `0023_paginated_notes.sql`, `0024_pdf_reading_workspace.sql`, and `0025_library_organization.sql`
  are the final migration names.
- The generated/manual `Database` type includes all three phases.
- Work begins on a separate branch/worktree named `codex/phase-4-canvas` or equivalent.

If migration numbers differ after Phase 1/2/3 review, use the next available number. There must be
exactly one Phase 4 migration, named `<next>_canvas_pages.sql`.

## Dependencies

Add exactly one new package: a small, dependency-free stroke-smoothing library (e.g. `perfect-freehand`
or equivalent) that turns an array of `{x, y, pressure}` points into a filled outline path. Do not
hand-roll pressure-sensitive stroke smoothing from scratch, and do not add a general-purpose canvas
framework (Fabric, Konva, paper.js) — Phase 4's element set is small and fixed enough not to need one.

Render strokes and shapes as SVG (`<path>`, `<rect>`, `<ellipse>`, `<line>`), not `<canvas>` — SVG
elements stay individually selectable/movable/deletable by the lasso and per-element tools, which a
flattened canvas bitmap would not allow. Use `<canvas>` only for the optional export/flatten path
(Print/Export), never as the live editing surface.

## Database schema

### Extend `notes.type`

Add `'canvas'` to the existing check constraint, following the same pattern Phase 1 used to add
`'paginated'`:

```text
alter table notes drop constraint if exists notes_type_check;
alter table notes add constraint notes_type_check check (type in ('case_brief', 'freeform', 'paginated', 'canvas'));
```

`content` and `page_settings` remain unused (null) for `canvas` notes; a canvas note's real content
lives entirely in `canvas_pages`. `search_text` (Phase 3) for a canvas note is derived from the plain
text found inside its text-box elements only — see "Search integration" below.

### `canvas_pages`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `note_id` | `uuid` | required, FK notes, cascade |
| `order_index` | `bigint` | required, default `1024` |
| `page_settings` | `jsonb` | required; same shape as Phase 1's `PageSettings` (paper, orientation, marginIn, paperStyle) |
| `elements` | `jsonb` | required, default `[]`; array of canvas elements, shape below |
| `created_at` | `timestamptz` | required, default now |
| `updated_at` | `timestamptz` | required, default now |

Create index `(note_id, order_index)`.

Element shapes stored inside `elements` (a plain JSON array, validated client-side, not by a
Postgres check — the array's internal shape is expected to evolve additively across app versions and
is not a security boundary):

```json
{ "id": "uuid", "type": "stroke", "tool": "pen", "color": "#1b2436", "sizeMm": 0.6,
  "points": [{"xMm": 12.4, "yMm": 30.1, "pressure": 0.6}], "createdAt": "iso" }

{ "id": "uuid", "type": "shape", "shape": "rect", "xMm": 10, "yMm": 10, "widthMm": 40, "heightMm": 20,
  "strokeColor": "#1b2436", "fillColor": null, "strokeWidthMm": 0.4 }

{ "id": "uuid", "type": "text", "xMm": 10, "yMm": 60, "widthMm": 80, "heightMm": 20,
  "text": "plain text", "fontSizePt": 12, "color": "#1b2436" }

{ "id": "uuid", "type": "signature", "xMm": 10, "yMm": 200, "widthMm": 50, "heightMm": 20,
  "signatureId": "uuid", "strokes": [ /* same shape as stroke.points, frozen at insert time */ ] }
```

`highlighter` and `eraser` are `tool` values on the same `stroke` element (`highlighter` renders at
reduced opacity; `eraser` removes/splits intersecting strokes client-side at draw time rather than
being persisted as its own element type — a stored page never contains an `eraser` stroke).

### `canvas_signatures`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | required, FK auth.users, cascade |
| `name` | `text` | required, 1-40 characters |
| `strokes` | `jsonb` | required; array of the same point-list shape used by stroke elements |
| `created_at` | `timestamptz` | required, default now |

Create index on `user_id`.

### Extend `reading_annotations` (Phase 2 integration)

Add `'ink'` to the existing `kind` check, and extend the highlight/anchor constraint to also accept a
valid ink anchor:

```text
alter table reading_annotations drop constraint if exists reading_annotations_kind_check;
alter table reading_annotations add constraint reading_annotations_kind_check check (kind in ('highlight', 'note', 'ink'));

alter table reading_annotations drop constraint if exists reading_annotations_highlight_requires_anchor;
alter table reading_annotations add constraint reading_annotations_anchor_shape_check check (
  (kind = 'note' and anchor is null)
  or (kind = 'highlight' and quoted_text is not null and quoted_text <> '' and anchor is not null)
  or (kind = 'ink' and quoted_text is null and anchor is not null)
);
```

An ink annotation's `anchor` uses a distinct fixed shape from the highlight anchor (do not overload
the highlight `rects`/`textStart`/`textEnd` shape):

```json
{ "version": 1, "strokes": [ { "color": "#dc2626", "sizeMm": 0.5,
  "points": [{"x": 0.12, "y": 0.34}] } ] }
```

Points here are normalized `0..1` against page width/height, matching the existing highlight-rect
convention in Phase 2, clamped client-side exactly like highlight rectangles are. `color` on an ink
annotation stands in for Phase 2's fixed five-color highlight palette — ink strokes may use any of a
small fixed marker-color set (reuse the same five highlight colors rather than a full color picker).

## RLS rules

### `canvas_pages`

Reuse the same visibility rule Phase 1's notes already enforce (owner, or shared note visible to the
household) rather than inventing a new predicate. Add one helper, mirroring the existing
`can_access_note`/`can_manage_*` pattern from Phase 2/3 (`security definer`, `set search_path =
public`, `stable`):

```text
can_edit_note(p_note_id uuid) returns boolean:
  exists (
    select 1 from notes n
    where n.id = p_note_id
      and (n.owner_id = auth.uid() or (n.visibility = 'shared' and is_household_member(n.household_id)))
  )
```

- Select: `can_access_note(note_id)` (reuse Phase 2's function as-is).
- Insert/update/delete: `can_edit_note(note_id)`, with an explicit check in the delete policy (or in
  the page-count-guard function below) that a note's last remaining page cannot be deleted directly
  through the table — see `delete_canvas_page` below.

### `canvas_signatures`

Select/insert/update/delete only when `user_id = auth.uid()`. No sharing, no household-wide access.

### `reading_annotations`

No RLS change needed — the existing per-user policy from Phase 2 already governs every `kind`,
`ink` included.

## Required database functions

1. `create_canvas_note(p_household_id, p_owner_id inferred from auth.uid(), p_course_id, p_title,
   p_visibility, p_page_settings)` — atomically inserts the `notes` row (`type = 'canvas'`) and its
   first `canvas_pages` row (`order_index = 1024`, `elements = '[]'`). Returns the note ID. Mirrors
   Phase 3's `create_notebook_with_section` pattern.
2. `duplicate_canvas_page(target_page_id uuid)` — validates `can_edit_note`, inserts a new page in
   the same note with the same `page_settings` and a deep copy of `elements` (assign fresh element
   `id`s so later edits on the copy never alias the original), positioned immediately after the
   source page using the same bigint-midpoint approach as Phase 3.
3. `delete_canvas_page(target_page_id uuid)` — validates `can_edit_note`; rejects when it is the
   note's only page, mirroring Phase 3's `delete_section_unfile` "only section" guard.
4. `reorder_canvas_page(target_page_id uuid, before_id uuid, after_id uuid)` — identical
   midpoint/rebalance algorithm to Phase 3's `reorder_section`/`reorder_notebook`, scoped by
   `note_id`. Reuse Phase 3's `midpoint_order_index` helper directly rather than redefining it.

All four functions are `security definer`, `set search_path = public`, and validate `auth.uid()`
through `can_edit_note`/`can_access_note`; none of them ever change a note's `visibility` or
`owner_id`.

Element-level mutations (stroke add/erase, shape move, text edit, lasso move/delete) do **not** get
individual database functions — they are expressed as a full replacement of one page's `elements`
array via a plain `update canvas_pages set elements = $1, updated_at = now() where id = $2`, gated by
the same RLS `can_edit_note` policy. Treating one page as the unit of persistence (not one element)
keeps this consistent with how Phase 1 already persists a whole `content` document per save rather
than per keystroke.

## TypeScript domain types

Create `src/lib/canvasTypes.ts`:

```ts
export type CanvasTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'text' | 'lasso' | 'signature'
export type CanvasShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow'

export interface CanvasPoint {
  xMm: number
  yMm: number
  pressure: number
}

export interface CanvasStrokeElement {
  id: string
  type: 'stroke'
  tool: 'pen' | 'highlighter'
  color: string
  sizeMm: number
  points: CanvasPoint[]
  createdAt: string
}

export interface CanvasShapeElement {
  id: string
  type: 'shape'
  shape: CanvasShapeKind
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  strokeColor: string
  fillColor: string | null
  strokeWidthMm: number
}

export interface CanvasTextElement {
  id: string
  type: 'text'
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  text: string
  fontSizePt: number
  color: string
}

export interface CanvasSignatureElement {
  id: string
  type: 'signature'
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  signatureId: string
  strokes: Array<{ points: CanvasPoint[] }>
}

export type CanvasElement = CanvasStrokeElement | CanvasShapeElement | CanvasTextElement | CanvasSignatureElement

export interface InkAnchor {
  version: 1
  strokes: Array<{ color: string; sizeMm: number; points: Array<{ x: number; y: number }> }>
}
```

Add `canvas_pages`, `canvas_signatures`, the extended `notes.type`/`reading_annotations.kind` unions,
and the four new functions to `src/types/database.ts`, following the existing Row/Insert/Update/
Relationships/Functions conventions used by the Phase 2/3 migrations. Do not use `any` or a broad
cast to paper over `elements`'/`anchor`'s `Json` type — narrow with the types above at the read
boundary in `useCanvasPage.ts`/`usePdfDocument.ts`, not in the generated types file.

## Routes

No new route. Canvas notes open at the existing `/notes/:noteId` route; `NoteDetail.tsx` renders
`CanvasEditor` instead of `PaginatedEditor`/`RichTextEditor`/`CaseBriefFields` when
`note.type === 'canvas'`, the same way it already branches on type today.

## Required files

Create:

```text
src/components/notes/CanvasEditor.tsx
src/components/notes/canvas/CanvasPageView.tsx
src/components/notes/canvas/CanvasPageThumbnailRail.tsx
src/components/notes/canvas/CanvasToolbar.tsx
src/components/notes/canvas/CanvasElementLayer.tsx
src/components/notes/canvas/LassoSelection.tsx
src/components/notes/canvas/SignaturePad.tsx
src/components/notes/canvas/SignatureLibraryDialog.tsx
src/hooks/useCanvasPages.ts
src/hooks/useCanvasHistory.ts
src/hooks/useCanvasSignatures.ts
src/lib/canvasTypes.ts
src/lib/canvasGeometry.ts
src/lib/canvasStroke.ts
```

Modify only as required:

```text
package.json
package-lock.json
src/routes/NoteDetail.tsx
src/components/notes/AddNoteModal.tsx (or wherever note type is chosen at creation)
src/lib/pageSizes.ts (reused, not modified, unless a canvas-only page-size need is discovered)
src/components/reader/AnnotationsPanel.tsx
src/components/reader/PdfDocument.tsx
src/hooks/useReadingAnnotations.ts
src/types/database.ts
supabase/migrations/<next>_canvas_pages.sql
```

Do not create a second modal framework, a second Supabase client, or a duplicate paper-background
implementation — reuse Phase 1/3's `pageSizes.ts` for every physical-dimension calculation.

## Canvas editor behavior

### Tools

- **Select** (default): tap/click an element to select it; drag its handles to resize (shapes, text,
  signature placements only — a stroke's bounding box can be moved but not individually reshaped).
  Drag its body to move. Delete key or an explicit toolbar button removes the selection.
- **Pen** / **Highlighter**: pointer-down starts a stroke; points are sampled at the browser's native
  pointer-event rate (do not throttle below what the pointer event stream itself provides); pointer-up
  finalizes it into a `CanvasStrokeElement`, generating its smoothed outline via the stroke library
  from Section "Dependencies." Highlighter renders at a fixed reduced opacity and a wider default
  `sizeMm`; both share one color palette (fixed 8-swatch set, reusing tokens already in the app where
  they exist, e.g. the Phase 2 highlight palette, extended only if a distinct ink-specific color is
  genuinely needed).
- **Eraser**: while dragging, any stroke whose path intersects the eraser's circular hit area is
  removed entirely from the page's live element array (whole-stroke erase, not sub-path erasing —
  partial-stroke splitting is out of scope for Phase 4).
- **Shape**: pointer-down sets the shape's origin corner; drag defines width/height; pointer-up
  commits a `CanvasShapeElement` of whichever shape (rect/ellipse/line/arrow) is active in the
  toolbar. Arrow is a line element with `shape: 'arrow'` and a fixed arrowhead marker rendered from
  its start/end (`xMm/yMm` to `xMm+widthMm/yMm+heightMm`).
- **Text**: click places a new `CanvasTextElement` with a default width/height; it immediately enters
  inline-edit mode (a plain `contentEditable` or absolutely-positioned `<textarea>` overlay, not a
  Tiptap instance); blur commits the text (empty text on blur deletes the element rather than leaving
  a blank box).
- **Lasso**: freehand-drag a closed loop; on pointer-up, any element whose full bounding box falls
  inside the loop becomes the active multi-selection. Selected elements can then be dragged together
  (all `xMm`/`yMm`/point offsets shift by the same delta), deleted together, or (strokes/shapes only)
  recolored together.
- **Signature**: opens `SignatureLibraryDialog` to pick an existing saved signature (placing a
  `CanvasSignatureElement` referencing it) or capture a new one via `SignaturePad`, which after
  saving both stores it in `canvas_signatures` and immediately places it on the current page.

### Apple Pencil and input handling

- Listen for `pointerdown`/`pointermove`/`pointerup` (not mouse or touch events) on the page surface.
- Read `event.pressure` for stroke width modulation; when a non-pen pointer reports the browser
  default of `0.5` constant pressure (mouse/trackpad), treat the stroke as constant-width rather than
  trying to fake pressure variation.
- Palm rejection: once a `pointerType === 'pen'` stroke begins, ignore all `pointerType === 'touch'`
  pointer events until that pen stroke's `pointerup`/`pointercancel`. Do not attempt palm rejection
  against other pen input (two simultaneous pens is not a real scenario here).
- Two-finger touch while a tool other than Select is active pans/zooms the page instead of drawing,
  consistent with how iPad note apps separate "one Pencil point draws, two touch points navigate."
- `touch-action: none` on the active drawing surface to prevent the browser's own scroll/zoom
  gestures from competing with pointer capture.

### Page management

- Toolbar/rail actions: New page (appends via the same order-index-at-end pattern as Phase 3),
  Duplicate page, Delete page (confirmation required; disabled/hidden when it is the only page),
  reorder via explicit Move up/down controls first (desktop drag-and-drop optional polish only after
  the non-drag path works, same rule Phase 3 set for library reordering).
- `CanvasPageThumbnailRail.tsx` renders one small live-scaled preview per page (an actual scaled-down
  SVG render of that page's elements — unlike Phase 3's flow-document text-only previews, a canvas
  page's "content" *is* its visual layout, so a miniature real render is both meaningful and cheap:
  it is the same SVG element list at a smaller `viewBox`, not a screenshot). Virtualize the same way
  Phase 2/3 do: render only the visible range plus 2 pages before/after.
- Page settings (paper size/orientation/margin/paper style) are set once per note at creation and
  editable per-page afterward from the same settings control Phase 1 already has for paginated notes,
  reusing that component rather than building a second one.

### Autosave and sync

- Debounce persistence of the active page's `elements` array 750 ms after the last change (stroke
  finalized, element moved/resized, text blurred), matching the cadence Phase 2/3 already use for
  comparable per-page saves. Also save immediately on page switch/navigation away so a debounce
  window is never lost.
- Apply the same self-echo-window pattern already used by `NoteDetail.tsx`'s autosave (Phase 3
  addendum's `SELF_ECHO_WINDOW_MS = 6000`) to `canvas_pages` realtime updates.
- Show the same `Saving…`/`Saved`/error language already established, scoped to "page N" rather than
  the whole note.

### Undo/redo

`useCanvasHistory.ts` keeps an in-memory stack of previous `elements` snapshots for the currently open
page only (cleared on page switch), capped at a fixed depth (50 entries) to bound memory. Undo/redo
are keyboard-accessible (`Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z`) and via toolbar buttons; both disabled at
the ends of the stack. This stack is never persisted or synced.

### Print and export

Reuse Phase 1's physical-mm print approach: render each page's SVG at its true `pageDimensionsMm`
size inside the same kind of page-sheet stack Phase 1 already prints via `@page { size }` + the
`.paginated-page-stack`-style visibility rules, so canvas notes print at the same fidelity and
mechanism as paginated notes. Do not add a PDF-generation library; printing *is* the export path
(the browser's own "Save as PDF" in the print dialog), identical in spirit to Phase 1/2.

## PDF ink annotations (Phase 2 integration)

- Add an `Ink` tool to the reader's existing annotation affordances (alongside highlight/note),
  reusing the same drawing surface component (`CanvasElementLayer`-level primitives, specifically just
  the pen/highlighter/eraser stroke logic — not full canvas pages) as an overlay positioned over the
  current PDF page, the same way Phase 2's highlight rectangles are already positioned over the text
  layer.
- Each completed ink stroke set for one uninterrupted drawing session on one page saves as one
  `reading_annotations` row with `kind = 'ink'`, `anchor` in the ink shape from the schema section
  above, `quoted_text = null`, `body = ''`. A user can draw multiple separate ink annotations per
  page (e.g., a circle around one paragraph and an arrow elsewhere are two rows, not one) — group
  strokes into a single row only while actively continuing the same drawing gesture without switching
  tools or pages.
- Cross-page ink is unsupported, identical to Phase 2's cross-page highlight rule: `Draw one page at
  a time.`
- Rendering: `AnnotationsPanel.tsx` and the main page view render ink strokes the same way highlight
  rectangles already render — an SVG overlay scaled to the current zoom, positioned via the same
  normalized `0..1` coordinate convention.
- Deleting an ink annotation follows the existing per-kind confirmation rule Phase 2 established for
  typed notes (confirm only when there is meaningful content — here, always confirm, since an ink
  annotation is never "empty" once it exists).

## Search integration (Phase 3 continuity)

For `canvas` notes, `notes.search_text` is the concatenation of every `CanvasTextElement.text` across
all of a note's pages, joined with newlines, recomputed on the same debounced save as the active
page's `elements` (not on every keystroke). Ink strokes, shapes, and signatures contribute nothing to
`search_text` — there is no OCR or shape-description text in Phase 4.

## Responsive rules

### Desktop and iPad landscape

- Toolbar is a single docked row/column with tool icons, color/size pickers appearing as a small
  popover for the active tool.
- Canvas page renders at 100% physical size by default with the same fit-to-width option Phase 1's
  paginated editor already provides; reuse that zoom control rather than building a second one.

### iPad portrait and phone

- Toolbar collapses to the most-used tools (Select, Pen, Eraser, Lasso) plus a `More` overflow for
  Highlighter/Shape/Text/Signature, mirroring Phase 2's phone toolbar `More` pattern.
- `CanvasPageThumbnailRail` becomes a bottom sheet, matching Phase 2/3's established mobile rail
  pattern.
- Two-finger pan/zoom is the primary navigation gesture on phone since a phone has no Pencil; a
  finger-only "Select" and "Pen" still work, just without pressure variation.

## Loading and error states

- Initial page load: `Opening canvas…` skeleton matching the app's existing loading language.
- Per-page save failure: inline `Couldn't save page N` with Retry; the in-memory `elements` state is
  never discarded on a failed save, so the user's drawing is never lost from the screen even if the
  network call fails.
- Signature save failure: preserve the drawn-but-unsaved signature in the dialog and allow retry
  without redrawing.

## Realtime behavior

Add `canvas_pages` to the note screen's realtime subscription table list (`useRealtimeRefresh`,
unchanged hook). Do not subscribe to another user's `canvas_signatures` — they are private and never
shared, so no realtime handling is needed for that table at all.

## Accessibility

- Every icon-only tool button has an `aria-label` and visible tooltip.
- Canvas drawing itself is inherently pointer-based and cannot be made keyboard-operable in a
  meaningful way; the surrounding chrome (tool selection, page navigation, undo/redo, delete-selected)
  must be fully keyboard operable, and Select-tool element deletion must work via `Delete`/`Backspace`
  once an element is focused/selected.
- Provide a text-equivalent affordance for signature placement (the signature's stored `name` is used
  as its `aria-label` when placed), since a signature image itself conveys no accessible text.
- Respect reduced-motion preference: no animated ink "drying" or transition effects.

## Implementation order and commits

1. **Schema and canvas note shell**
   - Migration (notes.type extension, canvas_pages, canvas_signatures, reading_annotations.kind
     extension), RLS, functions, database types, domain types, empty `CanvasEditor` that can create
     a note and show one blank page.
   - Commit: `Add canvas note schema and empty editor shell`
2. **Drawing core**
   - Pointer-event pipeline, pen/highlighter/eraser, stroke smoothing, autosave, undo/redo.
   - Commit: `Add freehand drawing to canvas notes`
3. **Shapes, text, and select/lasso**
   - Shape tool, text boxes, Select tool with resize/move, Lasso multi-select/move/delete.
   - Commit: `Add shapes text and selection tools to canvas notes`
4. **Pages**
   - `canvas_pages` CRUD, thumbnail rail, new/duplicate/delete/reorder, per-page settings reuse.
   - Commit: `Add canvas page management`
5. **Signatures**
   - `SignaturePad`, `canvas_signatures` CRUD, `SignatureLibraryDialog`, placement element.
   - Commit: `Add reusable signatures to canvas notes`
6. **PDF ink markup**
   - Reader ink tool, `reading_annotations.kind = 'ink'` end to end, rendering/deletion.
   - Commit: `Add ink markup to the PDF reader`
7. **Print, search integration, responsive/accessibility polish**
   - Physical-mm print path, `search_text` integration, phone/iPad layouts, keyboard/ARIA pass.
   - Commit: `Polish Phase 4 canvas and ink experience`

## Required automated checks

Run after every batch:

```bash
npm run build
npm run lint
```

## Manual verification checklist

1. Create a canvas note; draw with mouse and confirm a stroke persists after reload.
2. On an iPad with Apple Pencil, confirm pressure varies stroke width and that a resting palm while
   drawing does not create stray marks.
3. Erase part of a multi-stroke drawing; confirm only intersected strokes are removed.
4. Draw a rectangle, ellipse, line, and arrow; resize and recolor each via Select.
5. Add a text box, type, blur, and confirm it persists; confirm an emptied text box is removed.
6. Lasso-select three mixed elements and move them together; confirm relative positions are
   preserved.
7. Record a signature, place it on two different pages, and confirm both placements reference the
   same saved signature after reload.
8. Add a second and third page; reorder, duplicate, and delete a page; confirm deleting the only
   remaining page is rejected.
9. Confirm partner accounts each have their own signature library and cannot see the other's.
10. Confirm undo/redo works across a mixed sequence of strokes, shapes, and moves, and that switching
    pages clears the history stack without affecting saved content.
11. Draw an ink annotation on a PDF reading page; confirm it renders aligned after zoom and reload,
    and that a cross-page drag is rejected with the existing one-page-at-a-time message.
12. Print a multi-page canvas note and confirm physical page size matches the on-screen page.
13. Confirm a canvas note's text-box content is findable through Phase 3's library search and that
    strokes/shapes contribute nothing to the search index.
14. Test phone and iPad-portrait layouts: toolbar overflow, bottom-sheet thumbnail rail, two-finger
    pan/zoom.
15. `npm run build` passes; `npm run lint` introduces no new warnings.

## Stop conditions

Stop and report the exact issue before proceeding if:

- Phase 1/2/3 are not committed and building.
- The chosen stroke-smoothing dependency cannot render acceptably from a plain `points` array without
  pulling in a full canvas framework.
- Pointer Events pressure/palm-rejection behavior is not testable in the available environment (a
  real limitation to report, not a reason to silently ship untested Pencil handling as done).
- A requested adjustment belongs to the Explicitly deferred list.

## Explicitly deferred

- Handwriting-to-text recognition, OCR, or any AI-assisted cleanup of ink.
- Verified/legal-grade electronic signatures (this is a drawn picture, not a signing product).
- Sub-path/partial-stroke erasing.
- Real-time collaborative multi-cursor canvas editing.
- Persisted, cross-session undo history.
- Tilt-based shading or other Pencil features beyond pressure.
- A general-purpose canvas/whiteboard framework or a second PDF/export pipeline.

## Definition of done

Phase 4 is complete only when all seven implementation batches are committed, the migration and
manual `Database` type match, build passes, no new lint warning exists, every manual verification
item passes on desktop, iPad (with and without Apple Pencil), and phone, both household accounts have
isolated signature libraries, and PDF ink markup round-trips correctly through Phase 2's existing
annotation infrastructure. A drawing surface that only accepts mouse input, or canvas pages that
cannot be reordered/duplicated/deleted, is not completion.
