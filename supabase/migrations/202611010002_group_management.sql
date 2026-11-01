-- Execute depois de 202611010001_x1_groups.sql. Preserva o histórico de membros removidos.
begin;

create view public.x1_visible_battles with(security_invoker=true) as
  select gb.group_id,b.* from public.x1_battles b join public.x1_group_battles gb on gb.battle_id=b.id
  join public.x1_members l on l.group_id=gb.group_id and l.tag=b.left_tag
  join public.x1_members r on r.group_id=gb.group_id and r.tag=b.right_tag;
revoke all on public.x1_visible_battles from public,anon,authenticated;
grant select on public.x1_visible_battles to service_role;

create or replace view public.x1_results with(security_invoker=true) as
  select b.group_id,b.left_tag as player_tag,b.right_tag as opponent_tag,
    (b.left_crowns>b.right_crowns)::integer as won,(b.left_crowns<b.right_crowns)::integer as lost,
    (b.left_crowns=b.right_crowns)::integer as drawn from public.x1_visible_battles b
  union all
  select b.group_id,b.right_tag,b.left_tag,
    (b.right_crowns>b.left_crowns)::integer,(b.right_crowns<b.left_crowns)::integer,(b.right_crowns=b.left_crowns)::integer
  from public.x1_visible_battles b;

create function public.x1_add_members(p_id uuid,p_players jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; added integer := 0; changed integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  perform 1 from public.x1_groups where id=p_id for update;
  if not found then raise exception 'group_not_found' using errcode='P0002'; end if;
  for item in select value from jsonb_array_elements(p_players) loop
    insert into public.x1_players(tag,name) values(item->>'tag',item->>'name')
      on conflict(tag) do update set name=excluded.name;
    insert into public.x1_members(group_id,tag) values(p_id,item->>'tag') on conflict do nothing;
    get diagnostics changed = row_count;
    added := added+changed;
  end loop;
  if (select count(*) from public.x1_members where group_id=p_id)>20 then raise exception 'member_limit'; end if;
  insert into public.x1_group_battles(group_id,battle_id)
    select p_id,b.id from public.x1_battles b
    join public.x1_members l on l.tag=b.left_tag and l.group_id=p_id
    join public.x1_members r on r.tag=b.right_tag and r.group_id=p_id on conflict do nothing;
  return jsonb_build_object('added',added);
end $$;

create function public.x1_remove_member(p_id uuid,p_tag text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  perform 1 from public.x1_groups where id=p_id for update;
  if not found then raise exception 'group_not_found' using errcode='P0002'; end if;
  delete from public.x1_members where group_id=p_id and tag=p_tag;
  if not found then raise exception 'member_not_found' using errcode='P0002'; end if;
  return jsonb_build_object('removed',p_tag);
end $$;

create function public.x1_delete_group(p_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare battle_ids text[];
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  perform 1 from public.x1_groups where id=p_id for update;
  if not found then raise exception 'group_not_found' using errcode='P0002'; end if;
  select array_agg(battle_id) into battle_ids from public.x1_group_battles where group_id=p_id;
  delete from public.x1_group_battles where group_id=p_id;
  delete from public.x1_members where group_id=p_id;
  delete from public.x1_groups where id=p_id;
  delete from public.x1_battles b where b.id=any(battle_ids)
    and not exists(select 1 from public.x1_group_battles gb where gb.battle_id=b.id);
  delete from public.x1_players p where not exists(select 1 from public.x1_members m where m.tag=p.tag)
    and not exists(select 1 from public.x1_battles b where b.left_tag=p.tag or b.right_tag=p.tag);
  return jsonb_build_object('deleted',p_id);
end $$;

revoke all on function public.x1_add_members(uuid,jsonb),public.x1_remove_member(uuid,text),public.x1_delete_group(uuid) from public,anon,authenticated;
grant execute on function public.x1_add_members(uuid,jsonb),public.x1_remove_member(uuid,text),public.x1_delete_group(uuid) to service_role;

-- Todas as escritas usam a mesma trava transacional para serializar coleta e edição.
create or replace function public.x1_create_group(p_id uuid,p_name text,p_players jsonb,p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  if jsonb_array_length(p_players) not between 2 and 20 then raise exception 'invalid_members'; end if;
  insert into public.x1_groups(id,name,created_at) values(p_id,p_name,p_now);
  for item in select value from jsonb_array_elements(p_players) loop
    insert into public.x1_players(tag,name) values(item->>'tag',item->>'name')
      on conflict(tag) do update set name=excluded.name;
    insert into public.x1_members(group_id,tag) values(p_id,item->>'tag');
  end loop;
  insert into public.x1_group_battles(group_id,battle_id)
    select p_id,b.id from public.x1_battles b
    join public.x1_members l on l.tag=b.left_tag and l.group_id=p_id
    join public.x1_members r on r.tag=b.right_tag and r.group_id=p_id
    on conflict do nothing;
  return jsonb_build_object('id',p_id,'name',p_name,'enabled',true,'createdAt',p_now);
end $$;

create or replace function public.x1_claim_players(p_group_id uuid,p_limit integer,p_now timestamptz,p_batch_id uuid)
returns text[] language plpgsql security invoker set search_path='' as $$
declare item record; tags text[] := '{}';
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  if p_group_id is not null and not exists(select 1 from public.x1_groups where id=p_group_id) then
    raise exception 'group_not_found' using errcode='P0002';
  end if;
  for item in select p.tag from public.x1_players p
    where (p.last_attempt_at is null or p.last_attempt_at<=p_now-interval '60 seconds')
      and (p.lease_until is null or p.lease_until<=p_now)
      and exists(select 1 from public.x1_members m join public.x1_groups g on g.id=m.group_id
        where m.tag=p.tag and g.enabled and (p_group_id is null or m.group_id=p_group_id)
        and (select count(*) from public.x1_members cm where cm.group_id=g.id)>=2)
    order by p.last_attempt_at nulls first,p.tag limit least(greatest(p_limit,1),8)
    for update of p skip locked
  loop
    update public.x1_players set last_attempt_at=p_now,lease_until=p_now+interval '120 seconds',lease_token=p_batch_id where tag=item.tag;
    tags := array_append(tags,item.tag);
  end loop;
  return tags;
end $$;

create or replace function public.x1_finish_player(p_tag text,p_batch_id uuid,p_matches jsonb,p_error text,p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; linked integer; total integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  perform 1 from public.x1_players where tag=p_tag and lease_token=p_batch_id for update;
  if not found then return jsonb_build_object('stale',true,'recorded',0); end if;
  for item in select value from jsonb_array_elements(p_matches) loop
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

create or replace function public.x1_group_snapshot(p_id uuid,p_offset integer default 0,p_limit integer default 50)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'group',(select jsonb_build_object('id',id,'name',name,'enabled',enabled,'createdAt',created_at) from public.x1_groups where id=p_id),
    'members',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from (
      select p.tag,p.name,p.last_success_at as "lastSuccessAt",p.last_error as "lastError"
      from public.x1_players p join public.x1_members m on m.tag=p.tag where m.group_id=p_id order by p.name,p.tag) m),
    'matches',(select coalesce(jsonb_agg(to_jsonb(b)),'[]') from (
      select b.* from public.x1_visible_battles b
      where b.group_id=p_id order by b.played_at desc,b.id desc limit least(greatest(p_limit,1),50) offset greatest(p_offset,0)) b),
    'headToHead',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
      select player_tag as "playerTag",opponent_tag as "opponentTag",sum(won) as wins,sum(lost) as losses,sum(drawn) as draws,count(*) as total
      from public.x1_results where group_id=p_id group by player_tag,opponent_tag) r),
    'totalMatches',(select count(*) from public.x1_visible_battles where group_id=p_id)
  );
$$;

create or replace function public.x1_list_groups()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(g)),'[]') from (
    select g.id,g.name,g.enabled,g.created_at as "createdAt",
      (select count(*) from public.x1_members m where m.group_id=g.id) as "memberCount",
      (select count(*) from public.x1_visible_battles b where b.group_id=g.id) as "matchCount"
    from public.x1_groups g order by g.created_at desc,g.id) g;
$$;
commit;
