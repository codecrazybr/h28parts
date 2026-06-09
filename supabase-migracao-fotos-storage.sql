-- MIGRACAO DE FOTOS BASE64 PARA LINKS DO SUPABASE STORAGE - H28
-- Execute este SQL uma vez no Supabase antes de abrir migrar-fotos.html.
-- Senha usada pela ferramenta: 1236

create or replace function public.get_base64_photo_stats(
  password_input text
)
returns table (
  total_items bigint,
  total_mb numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if trim(password_input) <> '1236' then
    raise exception 'Senha incorreta.';
  end if;

  return query
  select
    count(*)::bigint as total_items,
    round(coalesce(sum(length(photo)), 0)::numeric / 1024 / 1024, 2) as total_mb
  from public.parts
  where photo like 'data:image/%';
end;
$$;

grant execute on function public.get_base64_photo_stats(text) to anon;

create or replace function public.migrate_part_photo_to_link(
  part_id_input text,
  password_input text,
  photo_url_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if trim(password_input) <> '1236' then
    raise exception 'Senha incorreta.';
  end if;

  if photo_url_input is null or trim(photo_url_input) = '' then
    raise exception 'Link da foto inválido.';
  end if;

  update public.parts
  set
    photo = trim(photo_url_input),
    updated_at = now()
  where id = part_id_input
    and photo like 'data:image/%';

  if not found then
    raise exception 'Item não encontrado ou foto já migrada.';
  end if;
end;
$$;

grant execute on function public.migrate_part_photo_to_link(text, text, text) to anon;

notify pgrst, 'reload schema';
