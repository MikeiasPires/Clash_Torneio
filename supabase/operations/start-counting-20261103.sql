-- Execute depois da migracao 202611030005_battle_collection_start.sql.
-- Remove em todos os grupos somente partidas anteriores a 03/11/2026, 00h de Brasilia.
-- Mantem as partidas de hoje, contas, grupos, membros, sessoes e convites.
begin;
select pg_catalog.pg_advisory_xact_lock(7243819021);

insert into public.x1_collection_settings(singleton,starts_at)
values(true,timestamptz '2026-11-03 00:00:00-03')
on conflict(singleton) do update set starts_at=excluded.starts_at;

delete from public.x1_group_battles gb using public.x1_battles b
where gb.battle_id=b.id
  and b.played_at < (select starts_at from public.x1_collection_settings where singleton);
delete from public.x1_battles
where played_at < (select starts_at from public.x1_collection_settings where singleton);

-- Invalida lotes em andamento para impedir que uma coleta anterior a limpeza grave dados.
update public.x1_players set lease_token=null,lease_until=null,last_attempt_at=null;

select
  (select starts_at from public.x1_collection_settings where singleton) as inicio_da_contagem,
  count(*) as partidas_mantidas,
  count(*) filter(where played_at < (select starts_at from public.x1_collection_settings where singleton)) as partidas_anteriores_restantes
from public.x1_battles;
commit;
