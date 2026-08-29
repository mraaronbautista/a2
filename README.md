# A²

A shared PWA for two law students to manage courses, readings, tasks, and notes, and keep each
other accountable. Built with React + Vite, Supabase (Postgres, Auth, Storage), and deployed on
Netlify. Installable to the home screen on iPad/iPhone/Mac.

**Status: MVP Phase 1** — auth, full database schema, responsive shell, and the Today screen
(due tasks/readings, nudges, quick-add) are done. Calendar, full Courses UI, Notes (Tiptap),
the full Us screen, and push notifications are not yet built.

## Stack

- React + TypeScript + Vite, React Router, Tailwind CSS
- Supabase (Postgres + Auth + Storage), Row Level Security on every table
- Supabase email magic-link auth (no OAuth)
- Netlify hosting

## One-time setup

1. **Get your API keys** from your Supabase project's Settings → API: the Project URL and the
   `anon`/publishable key.
2. Copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

3. **Run the migration** — open the SQL Editor in your Supabase project and paste in the contents
   of `supabase/migrations/0001_init.sql` (or `supabase db push` if you have the CLI linked with
   `supabase link --project-ref <ref>`).
4. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

5. **Seed the household** — since this app is scoped to exactly two people, once both partners
   have signed in at least once via magic link (which auto-creates their `profiles` row), run this
   once in the SQL Editor, filling in both `auth.users` emails:

   ```sql
   with new_household as (
     insert into households (name) values ('Our Household') returning id
   )
   insert into household_members (household_id, user_id, role)
   select new_household.id, u.id, 'member'
   from new_household, auth.users u
   where u.email in ('partner1@example.com', 'partner2@example.com');
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
