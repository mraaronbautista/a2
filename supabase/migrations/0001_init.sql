-- A² schema: households, courses/readings, tasks, notes, calendar, nudges, push
-- Every table is scoped to household membership via RLS; rows with
-- visibility = 'private' are additionally scoped to their owner.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Households
-- ---------------------------------------------------------------------------

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Household',
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- SECURITY DEFINER helpers so RLS on household_members doesn't recurse into
-- itself when other tables (or household_members' own policy) check membership.

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.same_household(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from household_members hm1
    join household_members hm2 on hm1.household_id = hm2.household_id
    where hm1.user_id = auth.uid()
      and hm2.user_id = target_user_id
  );
$$;

alter table households enable row level security;
create policy "select own household" on households
  for select using (is_household_member(id));

alter table household_members enable row level security;
create policy "select own household_members" on household_members
  for select using (is_household_member(household_id));

-- Household + membership rows are seeded manually (service role) once both
-- partners have signed up — see README for the one-time seed script.

-- ---------------------------------------------------------------------------
-- Profiles (auto-created on signup)
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "select household profiles" on profiles
  for select using (id = auth.uid() or same_household(id));
create policy "update own profile" on profiles
  for update using (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Courses & readings
-- ---------------------------------------------------------------------------

create table courses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  professor text,
  color text,
  created_at timestamptz not null default now()
);
create index courses_household_id_idx on courses(household_id);

alter table courses enable row level security;
create policy "select household courses" on courses
  for select using (is_household_member(household_id));
create policy "insert own courses" on courses
  for insert with check (owner_id = auth.uid() and is_household_member(household_id));
create policy "update own courses" on courses
  for update using (owner_id = auth.uid());
create policy "delete own courses" on courses
  for delete using (owner_id = auth.uid());

create table reading_items (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  source_link text,
  due_date timestamptz,
  recurrence_rule text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);
create index reading_items_course_id_idx on reading_items(course_id);
create index reading_items_due_date_idx on reading_items(due_date);

alter table reading_items enable row level security;
create policy "select household reading_items" on reading_items
  for select using (
    exists (select 1 from courses c where c.id = reading_items.course_id and is_household_member(c.household_id))
  );
create policy "insert own course reading_items" on reading_items
  for insert with check (
    exists (select 1 from courses c where c.id = reading_items.course_id and c.owner_id = auth.uid())
  );
create policy "update own course reading_items" on reading_items
  for update using (
    exists (select 1 from courses c where c.id = reading_items.course_id and c.owner_id = auth.uid())
  );
create policy "delete own course reading_items" on reading_items
  for delete using (
    exists (select 1 from courses c where c.id = reading_items.course_id and c.owner_id = auth.uid())
  );

create table reading_status (
  reading_item_id uuid not null references reading_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (reading_item_id, user_id)
);

alter table reading_status enable row level security;
create policy "manage own reading_status" on reading_status
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  title text not null,
  description text,
  due_date timestamptz,
  recurrence_rule text,
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_household_id_idx on tasks(household_id);
create index tasks_due_date_idx on tasks(due_date);

alter table tasks enable row level security;
create policy "select visible tasks" on tasks
  for select using (is_household_member(household_id) and (visibility = 'shared' or owner_id = auth.uid()));
create policy "insert own tasks" on tasks
  for insert with check (owner_id = auth.uid() and is_household_member(household_id));
create policy "update own tasks" on tasks
  for update using (owner_id = auth.uid());
create policy "delete own tasks" on tasks
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------

create table notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  type text not null default 'freeform' check (type in ('case_brief', 'freeform')),
  title text not null,
  content jsonb,
  case_brief_facts text,
  case_brief_issue text,
  case_brief_holding text,
  case_brief_reasoning text,
  case_brief_dissent text,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_household_id_idx on notes(household_id);
create index notes_course_id_idx on notes(course_id);

alter table notes enable row level security;
create policy "select visible notes" on notes
  for select using (is_household_member(household_id) and (visibility = 'shared' or owner_id = auth.uid()));
create policy "insert own notes" on notes
  for insert with check (owner_id = auth.uid() and is_household_member(household_id));
create policy "update own notes" on notes
  for update using (owner_id = auth.uid());
create policy "delete own notes" on notes
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Calendar events
-- ---------------------------------------------------------------------------

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  recurrence_rule text,
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  color text,
  created_at timestamptz not null default now()
);
create index calendar_events_household_id_idx on calendar_events(household_id);
create index calendar_events_start_at_idx on calendar_events(start_at);

alter table calendar_events enable row level security;
create policy "select visible calendar_events" on calendar_events
  for select using (is_household_member(household_id) and (visibility = 'shared' or owner_id = auth.uid()));
create policy "insert own calendar_events" on calendar_events
  for insert with check (owner_id = auth.uid() and is_household_member(household_id));
create policy "update own calendar_events" on calendar_events
  for update using (owner_id = auth.uid());
create policy "delete own calendar_events" on calendar_events
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Nudges
-- ---------------------------------------------------------------------------

create table nudges (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('task', 'reading', 'note')),
  item_id uuid not null,
  message text,
  status text not null default 'sent' check (status in ('sent', 'on_it', 'done', 'later')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index nudges_to_user_id_idx on nudges(to_user_id);

alter table nudges enable row level security;
create policy "select own nudges" on nudges
  for select using (is_household_member(household_id) and (from_user_id = auth.uid() or to_user_id = auth.uid()));
create policy "insert nudges" on nudges
  for insert with check (from_user_id = auth.uid() and is_household_member(household_id));
create policy "update own nudges" on nudges
  for update using (from_user_id = auth.uid() or to_user_id = auth.uid());
create policy "delete own nudges" on nudges
  for delete using (from_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Push subscriptions
-- ---------------------------------------------------------------------------

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;
create policy "manage own push_subscriptions" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
