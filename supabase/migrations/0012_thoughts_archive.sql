-- Archive thoughts instead of only being able to delete them outright.
-- Adapted from tandem-webapp's cork_notes.archived — "Unpin" used to be the
-- only way to get a pin off the active board, which meant losing it for
-- good just to declutter. Archived thoughts stay readable (and their
-- comments intact) in a collapsed section; permanent delete now only lives
-- there.

alter table thoughts add column archived boolean not null default false;
