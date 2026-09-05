# Phase 2 Addendum: Resolved Decisions and Ready-to-Paste Artifacts

This addendum sits on top of `PHASE_2_IMPLEMENTATION_PLAN.md`, which remains authoritative for all
UX/behavior detail (search, reflow, responsive breakpoints, accessibility, states, etc.). This file
exists to remove every decision an implementer would otherwise have to make by re-reading the repo:
it resolves the one real conflict (an existing uncommitted draft that diverges from the required
schema), and hands over the final SQL, type patches, and locked file interfaces verbatim. Where this
addendum gives literal code, use it as-is rather than re-deriving it.

## 0. What was found before this addendum was written

The working tree already has an **uncommitted Phase 2 draft**: `src/routes/ReadingDetail.tsx` (389
lines, one monolithic component), `supabase/migrations/0024_pdf_reading_workspace.sql` (129 lines),
and edits to `src/App.tsx`, `src/components/courses/AddReadingButton.tsx`,
`src/components/courses/ReadingItemRow.tsx`, `src/routes/CourseDetail.tsx`, `src/types/database.ts`.

It implements roughly a fifth of the plan — basic page canvas rendering, naive linear search, basic
bookmarks, basic upload — with a schema that does not match the plan's required schema (no
`reading_annotations` table, no `zoom_mode`/`zoom_value`/`view_mode`, no atomic linked-note RPC, no
file-metadata all-or-none check, storage RLS that doesn't check course-management rights). The plan's
own definition of done says "a basic canvas that only renders pages is not completion," so this draft
cannot simply be committed as Batch 1–3 and extended.

## 1. Resolved decision: discard and rewrite, don't patch

- **Do not commit the draft as a starting point.** Both `ReadingDetail.tsx` and the migration are
  **untracked** (`git status` confirms this — no history is lost either way). Replace both wholesale
  with the artifacts in this addendum rather than patching them incrementally.
- **Keep** `src/App.tsx` — its one-line route registration already matches the plan exactly. No change
  needed.
- **Keep and extend** `src/components/courses/AddReadingButton.tsx`, `ReadingItemRow.tsx`,
  `src/routes/CourseDetail.tsx` — these are tracked (Phase 1 files being modified in place, which the
  plan permits) and are already close to spec. Section 5 below lists the exact remaining gaps in each.
- **Replace** the `reading_*` blocks in `src/types/database.ts` with the blocks in Section 3 — the
  draft's blocks describe the old, wrong schema.
- Work happens on branch `claude/phase-2-pdf-reader`, created from `main`, per the plan's
  preconditions. Do not implement Phase 2 on `main`.
- `pdfjs-dist@^6.3.289` is **already** in `package.json` — no dependency change needed there. The
  draft's worker wiring pattern is correct and should be reused as-is in `usePdfDocument.ts`:
  ```ts
  import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
  import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  ```
  This is a Vite-resolvable local module URL, not a CDN — satisfies the plan's worker requirement.

## 2. Final migration — `supabase/migrations/0024_pdf_reading_workspace.sql`

Replace the draft file's entire contents with this. It is the one and only Phase 2 migration.

```sql
-- Phase 2 of the Notes & Reading workspace: private PDF course readings.
-- The uploaded PDF is immutable and stored privately; per-user progress,
-- bookmarks, highlights, and typed notes are separate tables so partners
-- reading the same source have fully independent state.

-- ---------------------------------------------------------------------------
-- reading_items: attach an optional PDF to an existing reading
-- ---------------------------------------------------------------------------

alter table reading_items
  add column storage_path text unique,
  add column original_name text,
  add column mime_type text,
  add column size_bytes bigint;

alter table reading_items
  add constraint reading_items_mime_type_check
    check (mime_type is null or mime_type = 'application/pdf'),
  add constraint reading_items_size_bytes_check
    check (size_bytes is null or size_bytes between 0 and 52428800),
  add constraint reading_items_file_metadata_all_or_none check (
    (storage_path is null and original_name is null and mime_type is null and size_bytes is null)
    or
    (storage_path is not null and original_name is not null and mime_type is not null and size_bytes is not null)
  );

-- ---------------------------------------------------------------------------
-- Shared access helpers (SECURITY DEFINER, same pattern as is_household_member)
-- ---------------------------------------------------------------------------

create or replace function public.can_access_reading(p_reading_item_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from reading_items r
    join courses c on c.id = r.course_id
    where r.id = p_reading_item_id
      and is_household_member(c.household_id)
  );
$$;

create or replace function public.can_manage_course(p_course_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from courses c
    where c.id = p_course_id
      and (c.owner_id = auth.uid() or (c.is_shared and is_household_member(c.household_id)))
  );
$$;

create or replace function public.can_access_note(p_note_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from notes n
    where n.id = p_note_id
      and is_household_member(n.household_id)
      and (n.visibility = 'shared' or n.owner_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- reading_progress: per-user page/zoom/view state
-- ---------------------------------------------------------------------------

create table reading_progress (
  reading_item_id uuid not null references reading_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_number integer not null default 1 check (page_number >= 1),
  page_count integer check (page_count is null or page_count >= 1),
  zoom_mode text not null default 'fit-width' check (zoom_mode in ('fit-width', 'fit-page', 'custom')),
  zoom_value numeric(4,2) not null default 1.00 check (zoom_value between 0.50 and 3.00),
  view_mode text not null default 'page' check (view_mode in ('page', 'reflow')),
  updated_at timestamptz not null default now(),
  primary key (reading_item_id, user_id)
);

alter table reading_progress enable row level security;
create policy "manage own reading progress" on reading_progress
  for all using (user_id = auth.uid() and can_access_reading(reading_item_id))
  with check (user_id = auth.uid() and can_access_reading(reading_item_id));

-- ---------------------------------------------------------------------------
-- reading_bookmarks: per-user page bookmarks with optional label
-- ---------------------------------------------------------------------------

create table reading_bookmarks (
  id uuid primary key default gen_random_uuid(),
  reading_item_id uuid not null references reading_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_number integer not null check (page_number >= 1),
  label text not null default '',
  created_at timestamptz not null default now(),
  unique (reading_item_id, user_id, page_number)
);

create index reading_bookmarks_lookup_idx on reading_bookmarks(reading_item_id, user_id, page_number);

alter table reading_bookmarks enable row level security;
create policy "manage own reading bookmarks" on reading_bookmarks
  for all using (user_id = auth.uid() and can_access_reading(reading_item_id))
  with check (user_id = auth.uid() and can_access_reading(reading_item_id));

-- ---------------------------------------------------------------------------
-- reading_annotations: highlights and typed page notes, per user
-- ---------------------------------------------------------------------------

create table reading_annotations (
  id uuid primary key default gen_random_uuid(),
  reading_item_id uuid not null references reading_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_number integer not null check (page_number >= 1),
  kind text not null check (kind in ('highlight', 'note')),
  color text not null default 'yellow' check (color in ('yellow', 'green', 'blue', 'pink', 'purple')),
  quoted_text text,
  body text not null default '',
  anchor jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_annotations_highlight_requires_anchor check (
    kind = 'note' or (kind = 'highlight' and quoted_text is not null and quoted_text <> '' and anchor is not null)
  )
);

create index reading_annotations_lookup_idx on reading_annotations(reading_item_id, user_id, page_number);
create index reading_annotations_recent_idx on reading_annotations(user_id, updated_at desc);

alter table reading_annotations enable row level security;
create policy "manage own reading annotations" on reading_annotations
  for all using (user_id = auth.uid() and can_access_reading(reading_item_id))
  with check (user_id = auth.uid() and can_access_reading(reading_item_id));

-- ---------------------------------------------------------------------------
-- reading_note_links: link a reading page/quotation to an existing A2 note
-- ---------------------------------------------------------------------------

create table reading_note_links (
  id uuid primary key default gen_random_uuid(),
  reading_item_id uuid not null references reading_items(id) on delete cascade,
  note_id uuid not null references notes(id) on delete cascade,
  page_number integer not null check (page_number >= 1),
  quoted_text text,
  annotation_id uuid references reading_annotations(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (reading_item_id, note_id)
);

alter table reading_note_links enable row level security;
create policy "select accessible reading note links" on reading_note_links
  for select using (can_access_reading(reading_item_id) and can_access_note(note_id));
create policy "insert accessible reading note links" on reading_note_links
  for insert with check (
    created_by = auth.uid()
    and can_access_reading(reading_item_id)
    and can_access_note(note_id)
  );
create policy "delete manageable reading note links" on reading_note_links
  for delete using (
    created_by = auth.uid()
    or exists (select 1 from notes n where n.id = reading_note_links.note_id and n.owner_id = auth.uid())
    or exists (
      select 1 from reading_items r
      where r.id = reading_note_links.reading_item_id and can_manage_course(r.course_id)
    )
  );
-- No update policy: link rows are immutable.

-- ---------------------------------------------------------------------------
-- create_reading_linked_note: atomic note + link creation
-- ---------------------------------------------------------------------------

create or replace function public.create_reading_linked_note(
  p_reading_item_id uuid,
  p_page_number integer,
  p_quoted_text text,
  p_annotation_id uuid,
  p_title text,
  p_visibility text,
  p_content jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_household_id uuid;
  v_note_id uuid;
begin
  if not can_access_reading(p_reading_item_id) then
    raise exception 'reading not found or not accessible';
  end if;

  select r.course_id, c.household_id into v_course_id, v_household_id
  from reading_items r join courses c on c.id = r.course_id
  where r.id = p_reading_item_id;

  if p_annotation_id is not null and not exists (
    select 1 from reading_annotations a
    where a.id = p_annotation_id and a.reading_item_id = p_reading_item_id and a.user_id = auth.uid()
  ) then
    raise exception 'annotation not found or not owned by caller';
  end if;

  insert into notes (household_id, owner_id, course_id, type, title, content, visibility, space)
  values (v_household_id, auth.uid(), v_course_id, 'freeform', p_title, p_content, p_visibility, 'law')
  returning id into v_note_id;

  insert into reading_note_links (reading_item_id, note_id, page_number, quoted_text, annotation_id, created_by)
  values (p_reading_item_id, v_note_id, p_page_number, p_quoted_text, p_annotation_id, auth.uid());

  return v_note_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private reading-files bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reading-files', 'reading-files', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

-- Path shape: <uploader-user-id>/<course-id>/<reading-id>/<sanitized-name>.pdf

create policy "select readable reading files" on storage.objects
  for select using (
    bucket_id = 'reading-files'
    and exists (
      select 1 from reading_items r
      where r.storage_path = storage.objects.name
        and can_access_reading(r.id)
    )
  );

create policy "insert own reading files" on storage.objects
  for insert with check (
    bucket_id = 'reading-files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and can_manage_course(((storage.foldername(name))[2])::uuid)
  );

create policy "delete manageable reading files" on storage.objects
  for delete using (
    bucket_id = 'reading-files'
    and exists (
      select 1 from reading_items r
      where r.storage_path = storage.objects.name
        and can_manage_course(r.course_id)
    )
  );

-- No update policy: files are immutable.
```

Manually verify all access paths listed in the plan's Batch 1 check before committing.

## 3. Final `src/types/database.ts` patch

Replace the existing `reading_bookmarks`, `reading_note_links`, `reading_progress` blocks and the
`reading_items` block's new columns, and insert a new `reading_annotations` block, so they read
exactly as follows (alphabetical key order matches this file's existing convention). Insert
`reading_annotations` alphabetically before `reading_bookmarks`.

```ts
      reading_items: {
        Row: {
          course_id: string
          created_at: string
          due_date: string | null
          id: string
          mime_type: string | null
          order_index: number
          original_name: string | null
          recurrence_rule: string | null
          size_bytes: number | null
          source_link: string | null
          storage_path: string | null
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          mime_type?: string | null
          order_index?: number
          original_name?: string | null
          recurrence_rule?: string | null
          size_bytes?: number | null
          source_link?: string | null
          storage_path?: string | null
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          mime_type?: string | null
          order_index?: number
          original_name?: string | null
          recurrence_rule?: string | null
          size_bytes?: number | null
          source_link?: string | null
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_annotations: {
        Row: {
          anchor: Json | null
          body: string
          color: string
          created_at: string
          id: string
          kind: string
          page_number: number
          quoted_text: string | null
          reading_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor?: Json | null
          body?: string
          color?: string
          created_at?: string
          id?: string
          kind: string
          page_number: number
          quoted_text?: string | null
          reading_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor?: Json | null
          body?: string
          color?: string
          created_at?: string
          id?: string
          kind?: string
          page_number?: number
          quoted_text?: string | null
          reading_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_annotations_reading_item_id_fkey"
            columns: ["reading_item_id"]
            isOneToOne: false
            referencedRelation: "reading_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_bookmarks: {
        Row: {
          created_at: string
          id: string
          label: string
          page_number: number
          reading_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          page_number: number
          reading_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          page_number?: number
          reading_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_bookmarks_reading_item_id_fkey"
            columns: ["reading_item_id"]
            isOneToOne: false
            referencedRelation: "reading_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_note_links: {
        Row: {
          annotation_id: string | null
          created_at: string
          created_by: string
          id: string
          note_id: string
          page_number: number
          quoted_text: string | null
          reading_item_id: string
        }
        Insert: {
          annotation_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          note_id: string
          page_number: number
          quoted_text?: string | null
          reading_item_id: string
        }
        Update: {
          annotation_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          note_id?: string
          page_number?: number
          quoted_text?: string | null
          reading_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_note_links_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "reading_annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_note_links_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_note_links_reading_item_id_fkey"
            columns: ["reading_item_id"]
            isOneToOne: false
            referencedRelation: "reading_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_progress: {
        Row: {
          page_count: number | null
          page_number: number
          reading_item_id: string
          updated_at: string
          user_id: string
          view_mode: string
          zoom_mode: string
          zoom_value: number
        }
        Insert: {
          page_count?: number | null
          page_number?: number
          reading_item_id: string
          updated_at?: string
          user_id: string
          view_mode?: string
          zoom_mode?: string
          zoom_value?: number
        }
        Update: {
          page_count?: number | null
          page_number?: number
          reading_item_id?: string
          updated_at?: string
          user_id?: string
          view_mode?: string
          zoom_mode?: string
          zoom_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "reading_progress_reading_item_id_fkey"
            columns: ["reading_item_id"]
            isOneToOne: false
            referencedRelation: "reading_items"
            referencedColumns: ["id"]
          },
        ]
      }
```

And add to the `Functions` block (keep existing entries, insert this one alphabetically):

```ts
      can_access_note: { Args: { p_note_id: string }; Returns: boolean }
      can_access_reading: { Args: { p_reading_item_id: string }; Returns: boolean }
      can_manage_course: { Args: { p_course_id: string }; Returns: boolean }
      create_reading_linked_note: {
        Args: {
          p_annotation_id: string | null
          p_content: Json
          p_page_number: number
          p_quoted_text: string | null
          p_reading_item_id: string
          p_title: string
          p_visibility: string
        }
        Returns: string
      }
```

## 4. New small library helpers (write exactly this — no design decisions left)

### `src/lib/readingTypes.ts` (copy verbatim from `PHASE_2_IMPLEMENTATION_PLAN.md` "TypeScript types")

Use the plan's code block as-is; it is already final.

### `src/lib/citations.ts`

```ts
export function formatCitation(readingTitle: string, pageNumber: number): string {
  return `${readingTitle}, p. ${pageNumber}`
}

export function formatQuoteCitation(quotedText: string, readingTitle: string, pageNumber: number): string {
  const normalized = quotedText.replace(/\s+/g, ' ').trim().slice(0, 1000)
  return `“${normalized}” — ${formatCitation(readingTitle, pageNumber)}`
}
```

### `src/lib/tiptapContent.ts`

```ts
import type { JSONContent } from '@tiptap/react'

export function buildQuoteCitationDoc(quotedText: string | null, citation: string): JSONContent {
  const paragraphs: JSONContent[] = []
  if (quotedText) {
    paragraphs.push({ type: 'paragraph', content: [{ type: 'text', text: quotedText }] })
  }
  paragraphs.push({ type: 'paragraph', content: [{ type: 'text', text: citation }] })
  return { type: 'doc', content: paragraphs }
}
```

### File validation + sanitization (used by `AddReadingButton.tsx`, colocate in that file or a new
`src/lib/pdfUpload.ts` — implementer's choice, but logic must be exactly this)

```ts
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] // "%PDF-"
const MAX_PDF_BYTES = 52428800 // 50 MiB

async function isPdfFile(file: File): Promise<boolean> {
  const looksLikePdfType = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!looksLikePdfType) return false
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  return PDF_MAGIC.every((byte, index) => head[index] === byte)
}

function sanitizePdfFilename(name: string): string {
  const withoutExtension = name.replace(/\.pdf$/i, '')
  const sanitized = withoutExtension.replace(/[/\\\x00-\x1f]/g, '-').replace(/\s+/g, '-').trim()
  return `${sanitized || 'reading'}.pdf`
}
```

Reject with a clear inline message before starting the upload when `!isPdfFile(file)` or
`file.size > MAX_PDF_BYTES`.

### Storage path construction (upload flow)

```ts
const readingId = crypto.randomUUID()
const storagePath = `${userId}/${courseId}/${readingId}/${sanitizePdfFilename(file.name)}`
```

Generate `readingId` client-side and pass it explicitly into the `reading_items` insert (`.insert({
id: readingId, ... })`) so the storage path and the row agree, per the plan's upload transaction
steps.

## 5. Locked gaps in the three already-modified Phase 1 files (Batch 2)

`AddReadingButton.tsx` currently (in the uncommitted diff) already gets right: single/bulk switch,
field order, title-default-once-from-filename guard (`if (file && !title) setTitle(...)`), storage
cleanup on failed insert. Still missing, add these:

- Call `isPdfFile` and the 50 MiB check client-side **before** calling `.upload(...)`; show the
  rejection inline without touching storage.
- Generate `readingId` before upload (Section 4) instead of only randomizing the path; pass `id:
  readingId` into the `reading_items` insert.
- Track two distinct busy states so the button/status text reads `Uploading…` then `Saving…`
  (upload phase vs. insert phase), not one generic `saving`.
- Disable modal dismissal (backdrop click / Escape) while either busy state is true.
- Preserve all entered fields on any failure; only clear the form on full success (already correct
  for bulk; verify the single-mode failure paths don't clear `title`/`sourceLink`/`dueDate`/`pdf`
  before confirming success).

`ReadingItemRow.tsx` and `CourseDetail.tsx` diffs already match the plan's "Course reading-list
behavior" section (PDF title opens `/readings/:id`, URL-only opens source link, metadata label `PDF
· Read in A2`, delete removes the storage object first). No further changes needed for those two
files beyond what Batches 6–9 add (e.g., nothing — bookmark/annotation cascade is handled entirely by
the DB `on delete cascade`, not by this component).

## 6. Locked interfaces for the Batch 3+ required files

Build these as separate files per the plan's "Required files" list — do not fold them back into one
`ReadingDetail.tsx` monolith like the discarded draft. Exact responsibilities/signatures:

- **`src/hooks/usePdfDocument.ts`** — `(storagePath: string | null) => { status: 'loading' |
  'ready' | 'password' | 'corrupt' | 'missing' | 'error', document: PDFDocumentProxy | null, pdfBlob:
  Blob | null, pageCount: number, errorMessage: string }`. Owns download-then-parse, worker wiring
  (Section 1), cancellation on unmount/reading-id change, and document destroy on unmount.
- **`src/hooks/useReadingProgress.ts`** — `(readingId: string, userId: string, pageCount: number) =>
  { page, setPage, zoomMode, zoomValue, viewMode, setZoomMode, setZoomValue, setViewMode }`. Loads
  saved row once `pageCount` is known (to clamp), debounces writes 750 ms, and also writes
  immediately (not just after debounce) on explicit page/view changes per the plan.
- **`src/hooks/useReadingAnnotations.ts`** — `(readingId: string, userId: string) => { bookmarks,
  annotations, toggleBookmark(page), setBookmarkLabel(id, label), createHighlight(page, quotedText,
  color, anchor), upsertNote(page, body, quotedText, anchor), deleteAnnotation(id) }`. All mutations
  optimistic with rollback on failure, matching the plan's Bookmarks/Highlights sections.
- **`src/lib/pdfText.ts`** — `extractPageText(pdf, pageNumber): Promise<ExtractedPage>` (cached per
  pdf-instance+page in a module-level `WeakMap`), `searchDocument(pdf, query, onProgress):
  Promise<PdfSearchResult[]>` (cancellable via an `AbortSignal` param), `clampRect(rect):
  NormalizedRect` (clamps `x/y/width/height` to `0..1`), plus the IndexedDB cache keyed by
  `` `${readingId}:${sizeBytes}:${storagePath}` `` for `ExtractedPage[]`.
- **`src/components/reader/PdfDocument.tsx`** — owns the main-viewport render loop (one canvas, task
  cancellation before rerender, skeleton while rendering, text layer overlay for selection).
- **`src/components/reader/PdfPage.tsx`** — single-page canvas + text-layer renderer, reusable by
  both `PdfDocument` (main view) and `PageThumbnail` (small/no text layer).
- **`src/components/reader/ReaderToolbar.tsx`** — top bar per the plan's "Reader information
  architecture" §1; receives view/zoom/page state and callbacks as props, no data fetching itself.
- **`src/components/reader/ReaderSidebar.tsx`** — tab container (Pages/Outline/Search/
  Bookmarks/Annotations) plus responsive shell (docked/overlay/bottom-sheet per breakpoint).
- **`src/components/reader/PageThumbnail.tsx`** — one lazy thumbnail; parent virtualizes to ≤20
  mounted via `IntersectionObserver` per the plan.
- **`src/components/reader/SearchPanel.tsx`**, **`BookmarksPanel.tsx`**, **`AnnotationsPanel.tsx`** —
  pure presentational panels driven by the hooks above; no direct Supabase calls.
- **`src/components/reader/ReflowView.tsx`** — renders `ExtractedPage[]` with the font/line-height/
  width/theme controls (locally persisted, e.g. `localStorage`, per the plan — only `view_mode`
  round-trips to Postgres).
- **`src/components/reader/CreateLinkedNoteDialog.tsx`** — calls `supabase.rpc('create_reading_linked_note',
  {...})` using `buildQuoteCitationDoc` + `formatCitation`/`formatQuoteCitation` from Section 4;
  navigates to `/notes/:noteId` only after the RPC resolves with a note id.
- **`src/routes/ReadingDetail.tsx`** — thin orchestrator: resolves the route param, runs the three
  hooks, and composes the components above. Should be small; if it's growing back toward 300+ lines,
  that's a sign logic leaked out of the components/hooks it should live in.

## 7. Everything else

For search debounce/snippet rules, reflow typography defaults, thumbnail virtualization, outline
resolution, print/download/full-screen mechanics, responsive breakpoints, loading/error copy, realtime
deletion handling, and accessibility requirements: implement exactly what
`PHASE_2_IMPLEMENTATION_PLAN.md` already specifies in those sections — this addendum does not repeat
or change any of it. Follow the same 9-batch commit order and commit messages from that plan's
"Implementation order and commits" section unchanged, running `npm run build` and `npm run lint`
after each batch as it specifies.
