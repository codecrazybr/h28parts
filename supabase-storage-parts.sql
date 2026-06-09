-- Permissoes do bucket "parts" para salvar fotos como link.
-- Execute somente depois de criar o bucket publico chamado parts.

create policy if not exists "Permitir visualizar fotos dos itens"
on storage.objects for select
to anon
using (bucket_id = 'parts');

create policy if not exists "Permitir enviar fotos dos itens"
on storage.objects for insert
to anon
with check (bucket_id = 'parts');

create policy if not exists "Permitir atualizar fotos dos itens"
on storage.objects for update
to anon
using (bucket_id = 'parts')
with check (bucket_id = 'parts');
