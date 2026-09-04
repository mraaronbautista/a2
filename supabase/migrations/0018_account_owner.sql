-- Accounts can now be tagged as belonging to one partner or the other —
-- purely a label so you can tell "whose account is this" at a glance
-- (e.g. Aaron's Visa vs. a joint checking account). This is NOT a
-- visibility split: per 0016's note, net worth stays a fully shared
-- picture — every account is still selectable/editable by both partners
-- under the existing household-wide RLS policies. owner_id null means
-- joint/shared, same convention as other nullable owner columns in this
-- schema.
alter table accounts add column owner_id uuid references auth.users(id) on delete set null;
