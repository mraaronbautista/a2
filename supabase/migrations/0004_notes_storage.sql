-- Storage bucket for images embedded in freeform notes. Public read (so
-- rendered <img> tags don't need signed-URL rotation) but writes are
-- restricted to the uploader's own folder: note-images/<user_id>/<file>.

insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do nothing;

create policy "note images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'note-images');

create policy "users upload note images to their own folder"
  on storage.objects for insert
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete their own note images"
  on storage.objects for delete
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);
