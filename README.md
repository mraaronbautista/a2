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
(on it/later/done), and cancel — with an unread badge for nudges sent to you), **Notes** (a
Notes/Courses sub-view toggle — Notes is case briefs and Tiptap freeform notes with headings,
multicolor highlight, working lists, and images via Supabase Storage; search; tag-by-course;
private/shared — a shared note is co-managed, so either partner can edit or delete it, and the
detail view shows who last touched it and when; Courses is reading lists with per-user completion
+ class-prep/cold-call tracking, an "Add reading" form with a Bulk mode — one reading per line,
paste a whole syllabus at once — a "+ Note" link on each reading that jumps straight into a new
note already titled and tagged to that course, and an "is_shared" classmates toggle so both
partners can manage the same reading list), **Budget** (a joint income/expense tracker with a
tap-to-pick category grid — Food & Drink, Transportation, Housing & Utilities, School & Books,
Personal Care, Shopping, Health Care, Entertainment, Subscriptions, Gifts, plus a Custom
fallback — an optional monthly limit per category shown as spent-vs-planned with its own progress
bar, an overall monthly total that rolls up whatever limits are set, a running shared-expense
balance ("who owes whom") computed from whichever transactions are marked Split 50/50 rather than
Personal, and recurring income templates that aren't monthly-only — Monthly (day of month), Weekly,
or Biweekly (day of week, plus one anchor date to pin which week — "every 2nd Wednesday" needs to
know 2nd-since-when); nothing auto-posts from a template, it just tracks "expected, not yet logged"
and pre-fills the entry form when you log it), and **Us** (a Goals/Thoughts sub-view toggle — Goals is short/long-term aspirations for
both partners, title + optional target date + done/not done, private-or-shared like tasks; Thoughts
is an inbox for unstructured shared notes with comment threads, archiving, and one-tap promotion
into a task, carrying any existing comments over as checklist items). The mobile nav is a floating
pill (Timeline, Notes, Budget, Us) with the quick-add "+" as its own circle beside it, at the same
level; desktop
keeps the sidebar plus a "Quick add" button above it. A Settings sheet (gear icon on every screen)
covers notifications, a manual light/dark toggle (persisted per-device), a short in-app guide, and
sign out.

**Live sync**: calendar events, tasks, readings, nudges, thoughts, goals, budget transactions,
notes, and courses all update in real time across both accounts via Supabase Realtime
(`useRealtimeRefresh` hook) — no manual reload needed to see the other partner's changes. RLS
still applies to what each subscriber receives.

**Push notifications are live**: the `send-reminders` Edge Function is deployed, its VAPID secrets
are set, and the DB trigger (instant push on a new nudge) and pg_cron sweep (task-due reminders,
every 15 min) are both wired to it and verified working end-to-end against the real project. The
whole original spec is now built. A course's rich-text "outline" is the one deliberate exception —
it's really just a freeform note attached to the course, so it doesn't need its own field now that
Notes exists; wire it up as a fast-follow if it turns out to be missed.

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
