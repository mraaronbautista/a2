-- Phase 1 of the Notes & Reading workspace: paginated documents.
-- A third note type alongside case_brief/freeform — same `content` jsonb
-- (still a Tiptap doc; the paginated view is a rendering/layout concern,
-- not a different document model), plus its own page_settings so paper
-- size/orientation/margins are stored separately from the content itself
-- (per the "separate data for page settings" note in the workspace plan)
-- rather than folded into the same blob.

alter table notes drop constraint if exists notes_type_check;
alter table notes add constraint notes_type_check check (type in ('case_brief', 'freeform', 'paginated'));

alter table notes add column if not exists page_settings jsonb;
