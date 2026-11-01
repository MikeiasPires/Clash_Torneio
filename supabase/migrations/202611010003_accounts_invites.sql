begin;
create table public.x1_accounts (
  id uuid primary key,email text not null unique,password_hash text not null,
  display_name text not null check(length(display_name) between 1 and 100),age integer not null check(age between 1 and 120),
  photo text check(length(photo)<=280000),photo_version text,phrase text not null default '' check(length(phrase)<=160),
  player_tag text unique,player_name text,is_admin boolean not null default false,created_at timestamptz not null
);
create table public.x1_sessions (
  token_hash text primary key,account_id uuid not null references public.x1_accounts(id) on delete cascade,expires_at timestamptz not null
);
create index x1_sessions_expiry on public.x1_sessions(expires_at);
create table public.x1_invites (
  group_id uuid primary key references public.x1_groups(id) on delete cascade,token_hash text not null unique,
  expires_at timestamptz not null,uses integer not null default 0,max_uses integer not null default 20,revoked boolean not null default false
);
create table public.x1_group_accounts (
  group_id uuid not null,account_id uuid not null references public.x1_accounts(id) on delete cascade,tag text not null,
  primary key(group_id,account_id),foreign key(group_id,tag) references public.x1_members(group_id,tag) on delete cascade
);
create table public.x1_auth_limits (key text primary key,count integer not null,expires_at timestamptz not null);
create index x1_auth_limits_expiry on public.x1_auth_limits(expires_at);
alter table public.x1_accounts enable row level security;
alter table public.x1_sessions enable row level security;
alter table public.x1_invites enable row level security;
alter table public.x1_group_accounts enable row level security;
alter table public.x1_auth_limits enable row level security;
revoke all on public.x1_accounts,public.x1_sessions,public.x1_invites,public.x1_group_accounts,public.x1_auth_limits from public,anon,authenticated;
grant select,insert,update,delete on public.x1_accounts,public.x1_sessions,public.x1_invites,public.x1_group_accounts,public.x1_auth_limits to service_role;

create function public.x1_create_account(p_data jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare make_admin boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  make_admin := coalesce((p_data->>'localBootstrap')::boolean,false) and not exists(select 1 from public.x1_accounts);
  insert into public.x1_accounts(id,email,password_hash,display_name,age,photo,photo_version,is_admin,created_at)
    values((p_data->>'id')::uuid,p_data->>'email',p_data->>'passwordHash',p_data->>'name',(p_data->>'age')::integer,
      p_data->>'photo',p_data->>'photoVersion',make_admin,(p_data->>'now')::timestamptz);
  return (p_data->>'id')::uuid;
end $$;

create function public.x1_auth_limit(p_key text,p_limit integer,p_now timestamptz,p_expires_at timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare attempts integer;
begin
  delete from public.x1_auth_limits where expires_at<=p_now;
  insert into public.x1_auth_limits values(p_key,1,p_expires_at)
    on conflict(key) do update set count=public.x1_auth_limits.count+1 returning count into attempts;
  return attempts<=p_limit;
end $$;

create function public.x1_rotate_invite(p_group_id uuid,p_hash text,p_expires_at timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  perform 1 from public.x1_groups where id=p_group_id for update;
  if not found then raise exception 'group_not_found' using errcode='P0002'; end if;
  insert into public.x1_invites(group_id,token_hash,expires_at) values(p_group_id,p_hash,p_expires_at)
    on conflict(group_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,uses=0,revoked=false;
end $$;

create function public.x1_join_invite(p_hash text,p_account_id uuid,p_player jsonb,p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare invitation public.x1_invites%rowtype; account public.x1_accounts%rowtype; already_member boolean; added integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  select * into invitation from public.x1_invites where token_hash=p_hash for update;
  if not found or invitation.revoked or invitation.expires_at<=p_now or invitation.uses>=invitation.max_uses then raise exception 'invite_invalid'; end if;
  select * into account from public.x1_accounts where id=p_account_id for update;
  if not found then raise exception 'account_missing'; end if;
  if account.player_tag is not null and account.player_tag<>p_player->>'tag' then raise exception 'tag_changed'; end if;
  if exists(select 1 from public.x1_accounts where player_tag=p_player->>'tag' and id<>p_account_id) then raise exception 'tag_taken'; end if;
  already_member := exists(select 1 from public.x1_members where group_id=invitation.group_id and tag=p_player->>'tag');
  if not already_member and (select count(*) from public.x1_members where group_id=invitation.group_id)>=20 then raise exception 'member_limit'; end if;
  insert into public.x1_players(tag,name) values(p_player->>'tag',p_player->>'name') on conflict(tag) do update set name=excluded.name;
  insert into public.x1_members(group_id,tag) values(invitation.group_id,p_player->>'tag') on conflict do nothing;
  update public.x1_accounts set player_tag=p_player->>'tag',player_name=p_player->>'name' where id=p_account_id;
  insert into public.x1_group_accounts values(invitation.group_id,p_account_id,p_player->>'tag') on conflict do nothing;
  get diagnostics added = row_count;
  if added>0 then update public.x1_invites set uses=uses+1 where group_id=invitation.group_id; end if;
  insert into public.x1_group_battles(group_id,battle_id)
    select invitation.group_id,b.id from public.x1_battles b
    join public.x1_members l on l.tag=b.left_tag and l.group_id=invitation.group_id
    join public.x1_members r on r.tag=b.right_tag and r.group_id=invitation.group_id on conflict do nothing;
  return jsonb_build_object('groupId',invitation.group_id,'joined',added>0);
end $$;

revoke all on function public.x1_create_account(jsonb),public.x1_auth_limit(text,integer,timestamptz,timestamptz),
  public.x1_rotate_invite(uuid,text,timestamptz),public.x1_join_invite(text,uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.x1_create_account(jsonb),public.x1_auth_limit(text,integer,timestamptz,timestamptz),
  public.x1_rotate_invite(uuid,text,timestamptz),public.x1_join_invite(text,uuid,jsonb,timestamptz) to service_role;
-- Grupos vazios podem ser preenchidos pelos convites.
create or replace function public.x1_create_group(p_id uuid,p_name text,p_players jsonb,p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(7243819021);
  if jsonb_array_length(p_players) not between 0 and 20 then raise exception 'invalid_members'; end if;
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
commit;
