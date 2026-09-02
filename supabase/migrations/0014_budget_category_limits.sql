-- Replace the single overall monthly_limit with a per-category limit map,
-- now that categories are a known curated set (see src/lib/budgetCategories.ts)
-- rather than purely freeform tags — a fixed limit per ad-hoc tag never
-- worked, but a fixed limit per a small known list of categories does.
-- The overall "monthly budget" shown in the UI becomes a rollup (sum) of
-- whatever categories actually have a limit set, computed client-side —
-- there's no separate top-level number to keep in sync any more.

alter table budget_settings drop column monthly_limit;
alter table budget_settings add column category_limits jsonb not null default '{}'::jsonb;
