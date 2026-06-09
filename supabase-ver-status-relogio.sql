-- Permite que o site mostre a ultima atividade do relogio de 24h.
-- Nao altera itens, nao altera fotos e nao apaga nada.

create policy if not exists "Permitir visualizar status do relogio"
on public.h28_maintenance_log for select
to anon
using (true);
