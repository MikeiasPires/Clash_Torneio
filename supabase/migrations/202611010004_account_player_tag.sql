begin;
create function public.x1_link_player(p_account_id uuid,p_player jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare account public.x1_accounts%rowtype;
begin
  -- Mesmo bloqueio usado pelos convites: uma tag só pode pertencer a uma conta.
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  select * into account from public.x1_accounts where id=p_account_id for update;
  if not found then raise exception 'account_missing'; end if;
  if account.player_tag is not null and account.player_tag<>p_player->>'tag' then raise exception 'tag_changed'; end if;
  if exists(select 1 from public.x1_accounts where player_tag=p_player->>'tag' and id<>p_account_id) then raise exception 'tag_taken'; end if;
  update public.x1_accounts set player_tag=p_player->>'tag',player_name=p_player->>'name' where id=p_account_id;
end $$;
revoke all on function public.x1_link_player(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.x1_link_player(uuid,jsonb) to service_role;
commit;
