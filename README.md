# A²

A shared PWA for two law students to manage courses, readings, tasks, and notes, and keep each
other accountable. Built with React + Vite, Supabase (Postgres, Auth, Storage), and deployed on
Netlify. Installable to the home screen on iPad/iPhone/Mac.

**Status: MVP Phase 1 complete** — auth, full database schema, responsive shell, Today (due
tasks/readings, nudges, quick-add), Calendar (month/week/day, recurring events, Mine/Both
overlay), Courses (reading lists with per-user completion + class-prep/cold-call tracking), Notes
(case briefs, Tiptap freeform notes with images via Supabase Storage, search, tag-by-course,
private/shared), and Us (nudge picker, two-way on-it/later/done reactions, activity log of nudges
sent and received) are all done. Only push notifications remain from the original spec. A course's
rich-text "outline" is still deferred — it's really just a freeform note attached to the course,
so it doesn't need its own field now that Notes exists; wire it up as a fast-follow if it turns out
to be missed.

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
