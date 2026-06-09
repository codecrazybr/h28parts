-- LIMPEZA MAIS LEVE DO H28
-- Use esta versao se o Supabase estiver dando timeout.
-- Ela remove a foto de apenas 1 item por execucao.
-- NAO apaga o item, somente limpa o campo photo.

update public.parts
set
  photo = '',
  updated_at = now()
where id = (
  select id
  from public.parts
  where photo is not null
    and photo <> ''
  limit 1
);

notify pgrst, 'reload schema';
