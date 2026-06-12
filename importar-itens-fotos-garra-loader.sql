-- IMPORTACAO EM MASSA H28 - FOTOS GARRA LOADER
-- Origem: 2 fotos enviadas em 11/06/2026
--
-- Regras:
-- - REF e QUANT nao sao cadastrados.
-- - DESENHO vira "numero do desenho".
-- - COD. ESTOQUE vira "codigo do item".
-- - APLICACAO fixa: GARRA LOADER.
-- - Itens repetidos pelo codigo NAO sao substituidos.
-- - Linhas com COD. ESTOQUE "***", vazio, rabiscado ou ilegivel foram deixadas fora.

create unique index if not exists parts_code_unique
on public.parts (lower(trim(code)));

with incoming(name, code, drawing_number, application) as (
  values
    ('BRACO ROTATIVO DA GARRA (LOADER NORMAL)', '12202002', '897-47', 'GARRA LOADER'),
    ('EIXO GUIA', '12203459', '4043-6-2A-2A', 'GARRA LOADER'),
    ('ARRUELA DE BRONZE DO RETENTOR', '12201219', '897-23', 'GARRA LOADER'),
    ('ARRUELA LISA DE FIXACAO DO RETENTOR', '12202851', '897-22', 'GARRA LOADER'),
    ('CARCACA DO CONJUNTO', '12203521', '4043-6-2A-10', 'GARRA LOADER'),
    ('BUCHA', '12203530', '4043-6-2A-11', 'GARRA LOADER'),
    ('MANCAL', '12201600', '4043-6-2A-14A', 'GARRA LOADER'),
    ('EIXO', '12203491', '4043-6-2A-15B', 'GARRA LOADER'),
    ('BUCHA', '12202576', '4043-6-2A-18A / 897-29', 'GARRA LOADER'),
    ('PINO PARA A MOLA MAIOR', '12200646', '897-29', 'GARRA LOADER'),
    ('PINO PARA MOLA MENOR', '12203505', '897-29A', 'GARRA LOADER'),
    ('PINO PARA MOLA', '12203548', '897-29', 'GARRA LOADER'),
    ('BUCHA PARA MOLA', '12202592', '4043-6-2A-18B / 897-29', 'GARRA LOADER'),
    ('MOLA', '12200387', '4043-6-2A-20A', 'GARRA LOADER'),
    ('MOLA', '12200867', '4043-6-2A-20A', 'GARRA LOADER'),
    ('OLHAL DA MOLA', '12202258', '4043-6-2A-20A-1', 'GARRA LOADER'),
    ('BATENTE', '12203483', '4043-6-2A-19', 'GARRA LOADER'),
    ('PARAFUSO DE FIXACAO DO CONJUNTO', '12201618', '4043-6-2A-21', 'GARRA LOADER'),
    ('SUPORTE', '12203513', '4043-6-2A-27', 'GARRA LOADER'),
    ('ARRUELA', '12200379', '4043-6-2A-28', 'GARRA LOADER'),
    ('PARAFUSO AJUSTADOR DO SUPORTE', '12201626', '4043-6-2A-31', 'GARRA LOADER'),
    ('SUPORTE DO RETENTOR', '12203467', '4043-6-2A-32A', 'GARRA LOADER'),
    ('ENCOSTO TRAVA DA GARRA', '12203475', '4043-6-2A-33', 'GARRA LOADER'),
    ('BUCHA FLANGEADA INFERIOR', '12200409', '4043-6-2A-34A', 'GARRA LOADER'),
    ('BUCHA FLANGEADA SUPERIOR', '12202266', '4043-6-2A-35A', 'GARRA LOADER'),
    ('RETENTOR VEDATEC 11254', '12200034', 'COMERCIAL', 'GARRA LOADER'),
    ('PARAFUSO ALLEN 1/4 X 3/4 UNC', '10200525', 'COMERCIAL', 'GARRA LOADER'),
    ('CONTRA PORCA 1/2 13 FIOS UNC', '10203346', 'COMERCIAL', 'GARRA LOADER'),
    ('PARAFUSO ALLEN CABECA CHATA M4 X 0,70 X 10', '11500280', '4043-6-2A-78', 'GARRA LOADER'),
    ('ROLO DE COMANDO REF. KR22-X-PP-A', '10205990', 'COMERCIAL', 'GARRA LOADER'),
    ('PARAFUSO ALLEN COM CABECA 1/2 X 52 UNC', '10203460', 'COMERCIAL', 'GARRA LOADER'),
    ('PARAFUSO SEXTAVADO M5 X 0,80 X 45', '12201170', 'COMERCIAL', 'GARRA LOADER'),
    ('RETENTOR SABO 00569B', '13203401', 'COMERCIAL', 'GARRA LOADER')
),
normalized as (
  select distinct on (lower(trim(code)))
    upper(trim(name)) as name,
    upper(trim(code)) as code,
    upper(trim(drawing_number)) as drawing_number,
    upper(trim(application)) as application
  from incoming
  where trim(code) <> ''
  order by lower(trim(code))
)
insert into public.parts (
  id,
  photo,
  name,
  code,
  drawing_number,
  application,
  assembly,
  registered_by,
  created_at,
  updated_at
)
select
  gen_random_uuid()::text,
  '',
  n.name,
  n.code,
  n.drawing_number,
  n.application,
  'NAO INFORMADO',
  'IMPORTACAO POR FOTO',
  now(),
  now()
from normalized n
where not exists (
  select 1
  from public.parts p
  where lower(trim(p.code)) = lower(trim(n.code))
)
on conflict do nothing;
