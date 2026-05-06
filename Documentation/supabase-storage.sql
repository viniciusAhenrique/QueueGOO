-- Bucket publico para imagens proprias do QueueGOO.
-- O backend envia arquivos com service_role; o app apenas le URLs publicas.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'queuegoo-media',
  'queuegoo-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
