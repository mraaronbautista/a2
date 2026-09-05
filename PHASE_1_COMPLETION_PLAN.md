# Phase 1 Completion Plan: Editor Shell and Responsive Tools

This document is the authoritative closeout plan for Phase 1. Implement exactly the incomplete work
defined here. Do not rewrite completed pagination/editor behavior, redesign A2, or begin Phase 2.
If existing code conflicts with a requirement, stop and report the exact conflict.

## Final status decisions

| Item | Decision | Phase 1 action |
|---|---|---|
| A4/Letter flow | Accepted and frozen | Regression-test only |
| Images | Accepted and frozen | Regression-test only |
| Automatic/manual page breaks | Accepted and frozen | Regression-test only |
| Autosave | Accepted and frozen | Regression-test only |
| Print preview | Accepted and frozen | Regression-test only |
| PDF output | Accepted and frozen | Regression-test only |
| Immersive editor | Must finish | Implement the focused editor shell below |
| Responsive tools | Must finish | Implement the three fixed toolbar layouts below |

Do not use the closeout pass to improve accepted items unless a new shell/toolbar change directly
breaks one of them.

## Product decision: immersive editor

Opening a paginated note automatically enters the immersive editor. There is no separate mode the
user must discover and no Fullscreen API requirement.

Immersive means:

1. The normal A2 desktop sidebar and mobile bottom navigation are hidden while a paginated note is
   open.
2. The editor owns the entire `100dvh` application surface.
3. The page workspace scrolls inside the editor shell; the browser/app shell does not scroll.
4. A compact sticky top bar contains Back, editable title, save state, document settings, and a
   `More` menu.
5. Formatting tools are sticky immediately below the top bar on desktop and iPad.
6. Page canvas uses all remaining height and width.
7. Back returns to Law for Law notes and Us for personal notes.
8. Browser Back behaves normally.
9. Non-paginated freeform notes and case briefs keep the current A2 shell and layout.
10. The focused layout is route-driven by the open note's type, not persisted as user data.

Do not implement an enter/exit focus-mode toggle, the browser Fullscreen API, sidebar collapse
animation, floating window, distraction-free writing mode, or preference storage in Phase 1.

## App-shell integration contract

The route cannot know a note's type before loading it, so use a small focus-layout context rather
than duplicating routes or fetching the note twice.

Create:

```text
src/hooks/useFocusLayout.tsx
```

It exports:

```ts
interface FocusLayoutValue {
  focused: boolean
  setFocused: (focused: boolean) => void
}

export function FocusLayoutProvider(...): JSX.Element
export function useFocusLayout(): FocusLayoutValue
```

`AppShell` wraps its layout in `FocusLayoutProvider`. When `focused` is true:

- Desktop sidebar is not rendered.
- Mobile bottom navigation is not rendered.
- Main remains `min-w-0 flex-1 overflow-hidden`.

`NoteDetail` calls `setFocused(note?.type === 'paginated')` after loading and resets it to false on
unmount and whenever `noteId` changes. The loading screen may use the normal shell briefly. Do not
infer focus from URL because all note types share `/notes/:noteId`.

## Immersive top bar

For paginated notes, replace the current loose metadata stack with one compact header inside the
focused shell.

Required order:

1. Back icon/button, accessible label `Back to Law` or `Back to Us`.
2. Title input, flexible width, single line, ellipsis when unfocused.
3. Save indicator: `Saving…`, `Saved`, or `Save failed`.
4. Desktop/iPad document settings button labeled `Page setup`.
5. Overflow button labeled `More`.

`Page setup` opens a popover/sheet containing only:

- Paper: A4, Letter.
- Orientation: Portrait, Landscape.
- Margin in inches: numeric input, range 0.25..2.0, step 0.25.
- Paper: Blank, Ruled, Grid, Dotted.

`More` contains:

- Course selector for Law notes when courses exist.
- Visibility: Private/Shared.
- Tags input.
- Print / Export PDF.
- Delete note, visually destructive and separated last.

Closing Page setup or More never saves separately; existing autosave handles changed fields.
Click outside and Escape close either surface. Only one may be open at a time.

On phone, Page setup is also placed inside More to preserve header width.

## Product decision: responsive tools

Use three layouts. Do not attempt a shrinking desktop ribbon.

### Desktop: 1024 px and wider

- Sticky top bar height: 52 px.
- Sticky formatting area: two compact rows, as currently grouped.
- Row 1: block style, Bold, Italic, Underline, text color, highlight, alignment, indent/outdent.
- Row 2: bullet list, numbered list, checklist, table, contextual table actions, link, image, page
  break, undo, redo, find, zoom controls, page count.
- Print is in More, not duplicated in the formatting area.
- Text labels are allowed.
- Formatting area may wrap within its own two-row height but must not create a third row at 1024 px.
- Page workspace begins below the sticky bars and scrolls vertically.

### iPad/tablet: 768..1023 px

- Sticky top bar height: 52 px with Back, title, save state, Page setup, More.
- Sticky primary formatting strip is one horizontally scrollable row.
- Primary strip order: block style, Bold, Italic, Underline, highlight, bullet list, numbered list,
  checklist, undo, redo.
- Final strip button is `Tools`.
- `Tools` opens a 320 px side sheet in landscape and a bottom sheet capped at 70dvh in portrait.
- Tools sheet contains text color, alignment, indent/outdent, table and contextual actions, link,
  image, page break, find/replace, zoom, fit width, and page count.
- The formatting strip itself must not wrap.
- Every interactive target is at least 44x44 CSS px.

### Phone: below 768 px

- Sticky top bar height: 48 px with Back, title, compact save icon/state, and More.
- No permanently visible desktop/tablet toolbar.
- A fixed bottom formatting bar sits above the safe-area inset.
- Bottom bar has exactly: block style, Bold, Italic, checklist, undo, and Tools.
- Tools opens a bottom sheet capped at 75dvh with every remaining formatting command.
- Bottom sheet sections, in order: Text, Paragraph, Insert, Find and replace, View.
- Touch targets are at least 44x44 CSS px.
- The software keyboard must not permanently hide the toolbar. Use `position: sticky`/normal visual
  viewport behavior; do not implement custom keyboard detection.
- Page canvas defaults to Fit width and leaves 12 px horizontal breathing room.
- No horizontal page scrolling until the user deliberately disables Fit width by changing zoom.
- Bottom content padding must prevent the fixed formatting bar from covering the final page.
- Respect `env(safe-area-inset-bottom)`.

## Toolbar behavior decisions

1. Reuse the existing Tiptap commands and extensions. Move their controls; do not change command
   behavior.
2. Preserve active-state styling in every layout.
3. Color choices stay exactly as currently defined.
4. Toolbar controls use `type="button"` and must not steal the editor selection on pointer down.
5. Sheet/popover actions return focus to the editor after the command runs, except text inputs.
6. Table-only controls appear only when the cursor is inside a table.
7. Find/replace opens inside the current responsive tool surface: inline below the desktop rows,
   inside the tablet/phone Tools sheet otherwise.
8. Zoom range stays 25%..200% in 10% increments.
9. Fit width remains the default on all breakpoints.
10. Page count is display-only.
11. Do not add icons or an icon dependency merely to replace existing labels. Short text labels are
    acceptable; Back/More may use existing inline or project icons.

## Paginated-note layout

For paginated notes only, `NoteDetail` root becomes:

```text
height: 100dvh
display: flex
flex-direction: column
overflow: hidden
width: 100%
```

The editor component receives the remaining space with `min-height: 0` and uses:

```text
toolbar: shrink-0
page workspace: min-h-0 flex-1 overflow-auto
```

Remove the paginated note's `max-w-5xl`, outer `p-6`, `space-y-4`, and `pb-16`. Those desktop page
constraints are the reason the current implementation is only partially immersive.

Non-paginated note markup retains the existing `max-w-2xl`, metadata layout, and delete button.

## Component boundaries

Create:

```text
src/components/notes/PaginatedNoteHeader.tsx
src/components/notes/PaginatedToolbar.tsx
src/components/notes/PageSetupPanel.tsx
src/components/notes/EditorMoreMenu.tsx
src/components/notes/EditorToolsSheet.tsx
src/hooks/useFocusLayout.tsx
```

Modify only:

```text
src/components/layout/AppShell.tsx
src/routes/NoteDetail.tsx
src/components/notes/PaginatedEditor.tsx
src/index.css
```

Splitting toolbar presentation out of `PaginatedEditor` is required, but editor state and command
execution stay owned by `PaginatedEditor`. Pass a narrow toolbar model/callback interface; do not
place the Tiptap Editor instance in global context.

Do not modify migrations, note types, pagination extensions, page-size math, image storage, the
regular `RichTextEditor`, case-brief components, Notes list, Phase 2 files, or Phase 3 files.

## Save-failure closeout requirement

The current shell visibly distinguishes Saving/Saved but must not claim Saved after a failed write.
This is the only accepted-item correction authorized in closeout because immersive navigation can
otherwise hide data loss.

- `handleSave` must inspect the Supabase update result.
- On success: clear dirty, show Saved.
- On failure: keep dirty content in memory, stop the spinner, and show `Save failed` with a Retry
  button/action.
- Back navigation while dirty or failed attempts one save. If it still fails, prevent navigation
  and show `Couldn’t save this note. Retry or discard changes.`
- Discard requires explicit confirmation.
- Do not add offline drafts or a toast library in this closeout pass.

## Accessibility

- Top bar, toolbar, and page workspace have appropriate landmark labels.
- Every color swatch has an accessible name and selected state.
- More, Page setup, and Tools expose expanded state and controlled panel IDs.
- Sheets/popovers close on Escape and restore trigger focus.
- Bottom sheets trap focus while open.
- Save status uses a polite live region; failure is announced assertively once.
- Active formatting is conveyed with `aria-pressed`, not color alone.
- Horizontal tablet toolbar is keyboard-scrollable and shows visible focus.
- At 200% browser zoom, controls remain reachable and page Fit width recalculates.
- Respect reduced motion; no animated ribbon transitions are required.

## Implementation order

1. **Focused shell**
   - Add focus-layout context, AppShell integration, paginated flex layout, and automatic cleanup.
   - Verify regular notes retain navigation and paginated notes hide it.
   - Commit: `feat(notes): add immersive paginated editor shell`
2. **Paginated header**
   - Move title/save metadata, Page setup, note metadata, print, and delete into fixed surfaces.
   - Add save-failure/retry/discard behavior.
   - Commit: `feat(notes): consolidate document controls`
3. **Responsive toolbar**
   - Extract toolbar, implement desktop rows, tablet strip/sheet, and phone bottom bar/sheet.
   - Preserve all existing commands and active states.
   - Commit: `feat(notes): add responsive editor tools`
4. **Closeout hardening**
   - Accessibility, safe areas, 200% zoom, orientation/resize behavior, print regressions.
   - Commit: `fix(notes): harden immersive editor layout`

Run `npm run build` and `npm run lint` before every commit.

## Acceptance checklist

### Immersive editor

1. Paginated note automatically hides desktop A2 sidebar.
2. Paginated note automatically hides mobile A2 navigation and Quick add.
3. Regular freeform note and case brief retain the existing shell.
4. Paginated editor occupies exactly the visible viewport without body scrolling.
5. Only the page workspace scrolls during normal editing.
6. Header and applicable formatting controls remain visible while scrolling pages.
7. Back destination is correct for Law and personal notes.
8. Browser Back works and focus layout resets after leaving.
9. Switching directly between note IDs cannot leave the app stuck in focused layout.
10. Print output contains no editor header, toolbars, sheets, or A2 navigation.

### Responsive tools

11. At 1440 and 1024 px, all commands fit in no more than two toolbar rows.
12. At 1023 and 768 px, primary tools remain one horizontal strip and all others are in Tools.
13. Below 768 px, only the fixed six-item bottom bar is permanently visible.
14. Every existing formatting command remains available at every breakpoint.
15. Active Bold/Italic/Underline/list/alignment/highlight/color state remains accurate.
16. Tablet and phone targets are at least 44x44 px.
17. Phone Tools sheet respects safe area and remains usable with the keyboard visible.
18. Final page content is not obscured by the phone formatting bar.
19. Fit width recalculates after rotation, sidebar removal, resize, and 200% browser zoom.
20. Fit width has no accidental horizontal scrolling; deliberate custom zoom may scroll.

### Regression and reliability

21. A4/Letter and portrait/landscape still produce correct dimensions.
22. Margin changes still repaginate.
23. Automatic breaks still occur only between top-level blocks.
24. Manual breaks still force the next block to a new page.
25. Images upload and render without changing their stored content.
26. Autosave still debounces ordinary typing.
27. Successful save shows Saved only after the database update succeeds.
28. Failed save retains edits, shows failure, and blocks accidental exit.
29. Print preview and Save as PDF preserve page size, count, and breaks.
30. Find/replace, tables, links, undo/redo, colors, highlighting, indentation, and lists work from
    each responsive layout.
31. Shared/private, course, tags, and delete remain available through More.
32. No Phase 2 reader or Phase 3 library file changes appear in the diff.
33. `npm run build` passes.
34. `npm run lint` introduces no new warning or error.

## Explicitly deferred

- Browser Fullscreen API
- User-selectable focus-mode preference
- Collapsible page thumbnail rail
- Direct page navigation or page reordering
- Headers, footers, footnotes, and page-number formatting
- DOCX import/export
- Handwriting, drawing, shapes, text boxes, and stylus features
- Simultaneous collaborative editing or presence
- Offline draft recovery and version history
- Phase 2 PDF reading features
- Phase 3 notebook organization

## Stop conditions

Stop and report rather than guessing if:

- Phase 1 currently fails to build before closeout changes.
- Current uncommitted changes cannot be clearly separated from this closeout work.
- AppShell focus state would require changing routing or fetching the note twice.
- A toolbar command would need a different Tiptap extension or schema change.
- A requested change belongs to Explicitly deferred work.
- The shell change breaks print pagination and cannot be fixed without changing the pagination
  algorithm.

## Definition of done

Phase 1 is complete when the four closeout commits are finished, all 34 acceptance checks pass,
build passes, no new lint warning exists, save failure cannot silently discard edits, paginated
notes use the automatic focused shell, and all existing formatting actions are reachable and usable
on desktop, iPad, and phone. Do not delay Phase 1 for visual embellishment beyond these criteria.
