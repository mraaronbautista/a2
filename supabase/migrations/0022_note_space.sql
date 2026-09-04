-- Notes had one list for everything — law reading notes and case briefs
-- sat next to purely personal notes (a trip itinerary, a shared list) with
-- nothing to tell them apart. Splitting them by space: Law keeps the
-- course-linked, case-brief-capable notes; Us gets its own personal note
-- space, plain freeform only, no course association.
--
-- Existing notes default to 'law' — this only affects where new notes are
-- filed going forward, not a reclassification of what's already there.
alter table notes add column space text not null default 'law' check (space in ('law', 'personal'));
create index notes_space_idx on notes(space);
