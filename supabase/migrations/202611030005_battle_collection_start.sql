-- Limite global opcional. Sem uma linha de configuracao, preserva a coleta existente.
begin;

create table if not exists public.x1_collection_settings (
  singleton boolean primary key default true check(singleton),
  starts_at timestamptz not null
);
alter table public.x1_collection_settings enable row level security;
revoke all on public.x1_collection_settings from public,anon,authenticated,service_role;
grant select on public.x1_collection_settings to service_role;

create or replace function public.x1_finish_player(p_tag text,p_batch_id uuid,p_matches jsonb,p_error text,p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; linked integer; total integer := 0; collection_start timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  perform 1 from public.x1_players where tag=p_tag and lease_token=p_batch_id for update;
  if not found then return jsonb_build_object('stale',true,'recorded',0); end if;
  select starts_at into collection_start from public.x1_collection_settings where singleton;
  for item in select value from jsonb_array_elements(p_matches) loop
    if (item->>'playedAt')::timestamptz < collection_start then continue; end if;
    if p_tag not in (item->'left'->>'id',item->'right'->>'id') then continue; end if;
    if not exists(select 1 from public.x1_members l join public.x1_members r on r.group_id=l.group_id
      where l.tag=item->'left'->>'id' and r.tag=item->'right'->>'id') then continue; end if;
    insert into public.x1_battles(id,played_at,left_tag,right_tag,left_name,right_name,left_crowns,right_crowns)
      values(item->>'id',(item->>'playedAt')::timestamptz,item->'left'->>'id',item->'right'->>'id',
        item->'left'->>'name',item->'right'->>'name',(item->'left'->>'crowns')::integer,(item->'right'->>'crowns')::integer)
      on conflict do nothing;
    insert into public.x1_group_battles(group_id,battle_id)
      select l.group_id,item->>'id' from public.x1_members l join public.x1_members r on r.group_id=l.group_id
      where l.tag=item->'left'->>'id' and r.tag=item->'right'->>'id' on conflict do nothing;
    get diagnostics linked = row_count;
    total := total+linked;
  end loop;
  update public.x1_players set last_success_at=case when p_error is null then p_now else last_success_at end,
    last_error=p_error,lease_until=null,lease_token=null where tag=p_tag and lease_token=p_batch_id;
  return jsonb_build_object('stale',false,'recorded',total);
end $$;

revoke all on function public.x1_finish_player(text,uuid,jsonb,text,timestamptz) from public,anon,authenticated;
grant execute on function public.x1_finish_player(text,uuid,jsonb,text,timestamptz) to service_role;
commit;
