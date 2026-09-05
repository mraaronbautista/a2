# A²

A shared PWA for two people to run their life together — courses, readings, tasks, notes, a joint
budget, and shared goals today; law school is the current chapter, not the whole point. Built with
React + Vite, Supabase (Postgres, Auth, Storage), and deployed on Netlify. Installable to the home
screen on iPad/iPhone/Mac.

**Status: MVP Phase 1 complete**, now iterating post-launch. Auth, full database schema, and a
responsive shell are done. Nav is four screens: **Timeline** (merged with Calendar — Day/Week/Month
as an internal view toggle rather than separate nav items, with a due tasks/readings agenda,
recurring events, a 7-day DateStrip, swipe left/right on Day or Month view to step to the next/
previous day or month (works even on a day with nothing scheduled), pull-to-refresh (hand-rolled,
since installed PWAs get no native browser pull-to-refresh), a Mine/Both filter dropdown, a
clickable month/year picker on the heading for fast long-range navigation, and one quick-add for
either a task or an event, opened from the nav bar's "+"; a task carries an optional Starts/Ends
pair just like an event does (not just a single due date), rendering as a proportional block on
the Day timeline when both are set; clicking a task opens a read view first — title, time,
course, notes, visibility, subtasks, and comments — with a small icon row (edit, add attachment,
duplicate, delete) rather than dropping straight into an editable form; the pencil icon toggles
into full edit/delete (start/end time, course, notes, subtasks, file attachments via Supabase
Storage), and a per-task comment/question thread (ask, reply, or mark handled — a shared task is
co-managed, so either partner can do any of this, not just its owner) whose composer only shows
Send once there's something typed; two of your own timed items that overlap get an
"Overlap" badge and render in side-by-side columns instead of one hiding the other, an overdue
task shows a one-tap "Remind" button that nudges your partner without leaving the timeline, a
block's time label always shows its actual minute (e.g. "4:30am", not rounded down to "4am"), a
free stretch of 90+ minutes between items collapses to a thin "free" divider instead of forcing
a long empty scroll, and a bell icon in the header opens the full Nudges panel — compose, react
(on it/later/done), and cancel — with an unread badge for nudges sent to you), **Law** (labeled
"Notes" in the codebase, renamed in nav since notes now split by space — this tab only shows
`space: 'law'` notes; a Notes/Courses sub-view toggle — Notes is case briefs and Tiptap freeform
notes with headings, multicolor highlight, working lists, and images via Supabase Storage; search;
tag-by-course; private/shared — a shared note is co-managed, so either partner can edit or delete
it, and the detail view shows who last touched it and when; Courses is reading lists with per-user
completion + class-prep/cold-call tracking, an "Add reading" form with a Bulk mode — one reading
per line, paste a whole syllabus at once — a "+ Note" link on each reading that jumps straight into
a new note already titled and tagged to that course, an "is_shared" classmates toggle so both
partners can manage the same reading list, and a per-course syllabus workspace — upload the
original file (PDF/DOC/DOCX/TXT/MD/HTML/images, kept immutable in Storage), get locally-extracted
text you can review and correct, with an explicit "Text ready" vs. "Extraction review needed"
status rather than silently trusting an imperfect extraction, plus a separate notes field and a
plain-text export of the edited version), **Budget** (an eye icon in the header masks every
balance/amount on screen as "₱••••" — a per-device preference, persisted, for handing your phone
to someone else without exposing numbers; real accounts — asset/debt/savings, balance
always derived from starting_balance + everything posted, never stored, each optionally tagged with
an owner label ("whose account is this," cosmetic only — every account stays fully shared/editable
by both partners regardless) — with an Expense/Income/Transfer entry form; a transfer moves money
between two of your own accounts in one step, so paying down a credit card or funding a savings
goal is a "From ... To ..." pick rather than two manual entries, and correctly reduces what a debt
account shows as owed. A tap-to-pick category grid on expense/income — Food & Drink, Transportation,
Housing & Utilities, School & Books, Personal Care, Shopping, Health Care, Entertainment,
Subscriptions, Gifts, plus a Custom fallback — free-form tags on top of that category for anything
narrower (e.g. "reimbursable", "trip:tokyo"), an optional monthly limit per category shown as
spent-vs-planned with its own progress bar, an overall monthly total that rolls up whatever limits
are set, a running shared-expense balance ("who owes whom") computed from whichever transactions
are marked Split 50/50 rather than Personal, and recurring income templates that aren't
monthly-only — Monthly (day of month), Weekly, or Biweekly (day of week, plus one anchor date to
pin which week — "every 2nd Wednesday" needs to know 2nd-since-when); nothing auto-posts from a
template, it just tracks "expected, not yet logged" and pre-fills the entry form when you log it),
and **Us** (a Goals/Thoughts/Notes sub-view toggle — Goals is short/long-term aspirations for both
partners, title + optional target date + done/not done, private-or-shared like tasks; Thoughts is
an inbox for unstructured shared notes with comment threads, archiving, and one-tap promotion into
a task, carrying any existing comments over as checklist items; Notes is `space: 'personal'` —
plain freeform notes with no course association, for anything that isn't law school). The mobile
nav is a floating pill (Timeline, Law, Budget, Us) with the quick-add "+" as its own circle beside
it, at the same level; desktop keeps the sidebar plus a "Quick add" button above it. A floating
Pomodoro timer (customizable session length, vibration + notification when a session ends) is
available everywhere but stays hidden until first actually started, and can be hidden again from
Settings. A Settings sheet (gear icon on every screen) covers notifications, a manual light/dark
toggle (persisted per-device), a short in-app guide, and sign out.

**Live sync**: calendar events, tasks, readings, reading status, nudges, thoughts, goals, accounts,
budget transactions, budget settings, recurring income, notes, and courses all update in real time
across both accounts via Supabase Realtime (`useRealtimeRefresh` hook) — no manual reload needed to
see the other partner's changes. RLS still applies to what each subscriber receives. Course syllabi
are the one exception — not yet wired into realtime, so a partner's edit needs a reload to show up.

**Push notifications are live**: the `send-reminders` Edge Function is deployed, its VAPID secrets
are set, and the DB trigger (instant push on a new nudge) and pg_cron sweep (task-due reminders,
every 15 min) are both wired to it and verified working end-to-end against the real project. The
whole original spec is now built. A course's rich-text "outline" is the one deliberate exception —
it's really just a freeform note attached to the course, so it doesn't need its own field now that
Notes exists; wire it up as a fast-follow if it turns out to be missed.

## Planned: Notes & Reading workspace

The next major Notes goal is a combined writing, handwriting, reading, and annotation workspace
inspired by Word for the web, Goodnotes, Notability, and OneNote, while remaining part of A² rather
than becoming a separate office app. The existing Notes/Courses switcher remains the library and
organizer: opening a note enters an immersive editor, opening an uploaded reading enters a dedicated
reader, and the current structured case-brief editor remains available. Creation becomes explicit
and contextual (`New note` on Notes, `New course` on Courses, and `Add reading` / `New course note`
inside a course); the global Quick add continues to mean Task or Event everywhere.

### Paginated notes

- Upgrade freeform notes into a responsive, full-workspace editor with real A4 or US Letter pages,
  portrait/landscape orientation, margins, stable page breaks, zoom, fit-to-width, print preview,
  and page-accurate PDF export. Pages are physical sheets from the start, not an infinite canvas
  that is divided only when printing.
- Provide two document behaviors: **flow**, where rich text continues automatically between pages,
  and **canvas**, where handwriting, text boxes, images, and shapes can be placed freely on separate
  printable sheets. Existing Tiptap JSON remains the structured text layer; ink and positioned
  objects use separate page data rather than being embedded in the rich-text document.
- Retain headings, lists, multicolor highlighting, images, course association, tags, private/shared
  access, last-editor information, and autosave. Add formatting such as underline, text color,
  alignment, indentation, checklists, tables, links, find/replace, undo/redo, and manual page breaks.
  Headers, footers, page numbers, footnotes, reusable templates, and DOCX import/export are later
  compatibility work rather than blockers for the first release.
- Add blank, ruled, grid, and dotted paper. A later handwriting phase adds pressure-sensitive pens,
  highlighters, erasers, lasso selection, shapes, movable text boxes, Apple Pencil/stylus input,
  palm-rejection-friendly interaction, and pinch-to-zoom/two-finger pan.

### Reading mode

- A course reading may be an uploaded PDF first and EPUB later. Reading mode preserves the source;
  it does not automatically convert the file into a note or DOCX.
- The PDF reader includes original-page rendering, thumbnails, outline navigation, search, zoom/fit,
  bookmarks, saved progress/last position, text selection, highlights, typed or handwritten
  annotations, page rotation, full-screen reading, printing, and page-accurate citations.
- For easier reading on small screens, extract an available PDF text layer locally and offer an
  optional reflowed view with adjustable font size, spacing, width, and theme. Each extracted block
  remains linked to its original PDF page/location so citations and source verification stay intact.
  Scanned PDFs may run optional on-device OCR; the original page remains authoritative and
  low-confidence recognition must not be presented as verified text.
- EPUB support adds chapter/table-of-contents navigation, reflowable typography, themes, bookmarks,
  highlights, annotations, progress, and chapter/location-based citations. EPUB screen page numbers
  are not treated as stable citations because they change with layout and font settings.
- Highlights and selections can create linked A² notes that retain the reading, quotation, page or
  EPUB location, annotation, and capture date. Desktop/iPad can offer reader-and-note split view;
  phone uses a sheet or separate screen.

### Responsive behavior and storage

- Desktop uses a collapsible page-thumbnail rail, centered printable canvas, compact Write/Draw/
  Insert/Layout tools, optional contextual panel, and bottom status/zoom controls. The main A²
  sidebar can collapse during focused editing.
- iPad is a first-class stylus and keyboard experience with touch-sized controls, a collapsible
  thumbnail rail, portrait/landscape layouts, and reader/note split view. Phone fits one page to the
  screen, moves navigation into drawers/sheets, uses contextual or bottom tools, and only introduces
  horizontal movement after deliberate zooming rather than squeezing in a desktop ribbon.
- Keep the note as the parent record, but store page setup/order, ink strokes, positioned objects,
  readings, annotations, bookmarks, progress, and source links separately. Large PDFs, EPUBs,
  images, and future audio live in Storage, not a single JSON database value. Cache recent documents
  and unsaved drafts locally for offline recovery, then synchronize when connectivity returns.
- Initial sharing retains the current whole-note autosave model but must not claim safe simultaneous
  editing. True live collaboration, presence, incremental conflict-safe text/ink updates, comments,
  and version history are a later phase.

### Cost boundary and delivery order

Core functionality must not require AI, API keys, usage credits, or paid conversion/OCR services.
Use browser/local and open-source components such as the existing Tiptap editor, PDF.js for PDF
rendering/text extraction, epub.js for EPUB reading, IndexedDB for local drafts/cache, browser print
for initial PDF output, and an on-device OCR option for scans. No AI features are currently planned.

Delivery order:

1. Paginated typed notes: immersive editor, A4/Letter flow, images, page breaks, autosave, responsive
   tools, print preview, and PDF output.
2. PDF reading: upload/storage, reader, thumbnails, search, bookmarks/progress, annotations,
   citations, locally extracted/reflowed text, and linked notes.
3. Notebook organization: page management, paper templates, notebooks/sections, covers, favorites,
   archive, previews, and expanded search.
4. Freeform handwriting and stylus tools.
5. EPUB reading.
6. Advanced non-AI tools such as local OCR, scanning, audio-linked notes, backlinks, citation
   organization, and version history.
7. True collaboration, DOCX compatibility, and portable notebook backups.

## Stack

- React + TypeScript + Vite, React Router, Tailwind CSS
- Supabase (Postgres + Auth + Storage), Row Level Security on every table
- Supabase email/password auth, two fixed accounts (no sign-up flow, no OAuth)
- Netlify hosting

## One-time setup

1. **Get your API keys** from your Supabase project's Settings → API: the Project URL and the
   `anon`/publishable key.
2. Copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

3. **Run the migrations** — open the SQL Editor in your Supabase project and paste in the contents
   of each file in `supabase/migrations/`, in order (or `supabase db push` if you have the CLI
   linked with `supabase link --project-ref <ref>`).
4. **Create the two accounts** — Supabase Auth identifies users by email, so the app maps each
   `Username` field to `<username>@a2.local` under the hood. In Supabase Dashboard →
   Authentication → Users → Add user, create one user per partner with that synthetic email and
   the chosen password, checking **Auto Confirm User** each time (otherwise sign-in fails with
   "email not confirmed").
5. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

6. **Seed the household** — since this app is scoped to exactly two people, once both accounts
   exist (their `profiles` row is auto-created on first sign-in), run this once in the SQL Editor:

   ```sql
   with new_household as (
     insert into households (name) values ('Our Household') returning id
   )
   insert into household_members (household_id, user_id, role)
   select new_household.id, u.id, 'member'
   from new_household, auth.users u
   where u.email in ('attyaaron@a2.local', 'attyalexs@a2.local');
   ```

## Deploying

Connect the GitHub repo to Netlify (New site → Import from Git). Build command and publish
directory are already set in `netlify.toml`. Set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as environment variables in the Netlify dashboard — they are not
committed to the repo.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run lint` — run Oxlint
