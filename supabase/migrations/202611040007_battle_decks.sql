-- Preserva os placares e permite completar decks antigos ainda presentes na API.
begin;

alter table public.x1_battles
  add column left_cards jsonb not null default '[]' check(jsonb_typeof(left_cards)='array' and jsonb_array_length(left_cards)<=8),
  add column right_cards jsonb not null default '[]' check(jsonb_typeof(right_cards)='array' and jsonb_array_length(right_cards)<=8);

-- O PostgreSQL fixa as colunas de b.* na criação da view.
create or replace view public.x1_visible_battles with(security_invoker=true) as
  select gb.group_id,b.* from public.x1_battles b join public.x1_group_battles gb on gb.battle_id=b.id
  join public.x1_members l on l.group_id=gb.group_id and l.tag=b.left_tag
  join public.x1_members r on r.group_id=gb.group_id and r.tag=b.right_tag;
revoke all on public.x1_visible_battles from public,anon,authenticated;
grant select on public.x1_visible_battles to service_role;

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
    insert into public.x1_battles(id,played_at,left_tag,right_tag,left_name,right_name,left_crowns,right_crowns,left_cards,right_cards)
      values(item->>'id',(item->>'playedAt')::timestamptz,item->'left'->>'id',item->'right'->>'id',
        item->'left'->>'name',item->'right'->>'name',(item->'left'->>'crowns')::integer,(item->'right'->>'crowns')::integer,
        coalesce(nullif(item->'left'->'cards','null'::jsonb),'[]'::jsonb),
        coalesce(nullif(item->'right'->'cards','null'::jsonb),'[]'::jsonb))
      on conflict(id) do update set
        left_cards=case when public.x1_battles.left_cards='[]'::jsonb then excluded.left_cards else public.x1_battles.left_cards end,
        right_cards=case when public.x1_battles.right_cards='[]'::jsonb then excluded.right_cards else public.x1_battles.right_cards end;
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
