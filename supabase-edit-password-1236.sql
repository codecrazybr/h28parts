create or replace function public.update_part_with_password(
  part_id_input uuid,
  password_input text,
  photo_input text,
  name_input text,
  code_input text,
  drawing_number_input text,
  application_input text,
  registered_by_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if password_input <> '1236' then
    raise exception 'Senha incorreta.';
  end if;

  update public.parts
  set
    photo = coalesce(photo_input, photo),
    name = upper(trim(name_input)),
    code = upper(trim(code_input)),
    drawing_number = upper(trim(drawing_number_input)),
    application = upper(trim(application_input)),
    registered_by = upper(trim(registered_by_input)),
    updated_at = now()
  where id = part_id_input;

  if not found then
    raise exception 'Item não encontrado.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
