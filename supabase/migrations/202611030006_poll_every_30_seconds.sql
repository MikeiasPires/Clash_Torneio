-- Compartilha o intervalo de 30 segundos entre abas, usuarios e instancias da Vercel.
begin;
create or replace function public.x1_claim_players(p_group_id uuid,p_limit integer,p_now timestamptz,p_batch_id uuid)
returns text[] language plpgsql security invoker set search_path='' as $$
declare item record; tags text[] := '{}';
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  if p_group_id is not null and not exists(select 1 from public.x1_groups where id=p_group_id) then
    raise exception 'group_not_found' using errcode='P0002';
  end if;
  for item in select p.tag from public.x1_players p
    where (p.last_attempt_at is null or p.last_attempt_at<=p_now-interval '30 seconds')
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
revoke all on function public.x1_claim_players(uuid,integer,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.x1_claim_players(uuid,integer,timestamptz,uuid) to service_role;
commit;
