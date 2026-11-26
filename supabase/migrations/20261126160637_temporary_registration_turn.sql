begin;

-- Switching enabled to false reopens ordinary roster registration. Login and recovery
-- never consult this setting.
create table private.registration_rollout (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null,
 coordinator_id text
);
alter table private.registration_rollout enable row level security;
revoke all on private.registration_rollout from public,anon,authenticated;
grant select on private.registration_rollout to service_role;
insert into private.registration_rollout(singleton,enabled,coordinator_id)
values(true,true,(select id from public.commercial_workers where role='coordinator'
 and active and upper(trim(team_name))='FENIX' and upper(name) like 'GATICA %VALERIA%'));

grant execute on function private.roster_exception(text,text) to service_role;
create function private.registration_turn_allowed(p_rut text) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select from private.registration_rollout cfg where cfg.singleton and (
   not cfg.enabled
   or exists(select from public.profiles p where p.rut=p_rut)
   or exists(select from public.registration_controls c where c.rut=p_rut and c.enabled
      and c.audiovisual_name is not null and private.roster_exception(c.rut,'audiovisual'))
   or exists(select from public.commercial_workers w
      left join public.commercial_workers coordinator on coordinator.id=w.coordinator_id and coordinator.role='coordinator'
      where w.rut=p_rut and (w.role='sales_manager' or private.roster_exception(w.rut,w.role)
        or (w.role='coordinator' and (w.id=cfg.coordinator_id or translate(upper(trim(w.team_name)),'É','E')='FENIX'))
        or (w.role='seller' and (coordinator.id=cfg.coordinator_id or translate(upper(trim(coordinator.team_name)),'É','E')='FENIX'))))
 ));
$$;
revoke all on function private.registration_turn_allowed(text) from public,anon,authenticated;
grant execute on function private.registration_turn_allowed(text) to service_role;

-- The first screen only asks whether to continue. It cannot reserve a RUT or write Auth.
create function public.check_registration_turn(p_rut text,p_ip_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare n integer; now_at timestamptz:=clock_timestamp();
begin
 if p_rut is null or p_rut !~ '^[0-9]{7,8}[0-9k]$' or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
   return jsonb_build_object('error','Solicitud inválida.','status',400);
 end if;
 delete from private.registration_limits where key like 'turn:%' and window_start < now_at-interval '1 day';
 insert into private.registration_limits as l(key,window_start,attempts)
 values('turn:'||p_ip_hash,now_at,1) on conflict(key) do update set
   window_start=case when l.window_start<now_at-interval '15 minutes' then now_at else l.window_start end,
   attempts=case when l.window_start<now_at-interval '15 minutes' then 1 else least(l.attempts+1,1000000) end
 returning attempts into n;
 if n>60 then return jsonb_build_object('error','Demasiados intentos. Espera 15 minutos antes de volver a intentar.','status',429); end if;
 if not private.registration_turn_allowed(p_rut) then return jsonb_build_object('error','ups no es tu turno','status',403); end if;
 return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.check_registration_turn(text,text) from public,anon,authenticated;
grant execute on function public.check_registration_turn(text,text) to service_role;

create or replace function public.reserve_roster_registration(p_rut text,p_request_id uuid,p_ip_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare identity jsonb; existing public.profiles%rowtype; claim private.registration_claims%rowtype;
  limit_key text; max_attempts integer; attempts integer; now_at timestamptz:=clock_timestamp();
begin
  if p_rut !~ '^[0-9]{7,8}[0-9k]$' or p_ip_hash !~ '^[0-9a-f]{64}$' or p_request_id is null then
    return jsonb_build_object('error','Solicitud inválida.','status',400);
  end if;
  delete from private.registration_limits where window_start<now_at-interval '1 day';
  for limit_key,max_attempts in select * from (values ('global',500),('ip:'||p_ip_hash,20),('rut:'||md5(p_rut),5)) as limits(key,maximum) loop
    insert into private.registration_limits as current_limit(key,window_start,attempts)
    values(limit_key,now_at,1)
    on conflict(key) do update set
      window_start=case when current_limit.window_start<now_at-interval '15 minutes' then now_at else current_limit.window_start end,
      attempts=case when current_limit.window_start<now_at-interval '15 minutes' then 1 else least(current_limit.attempts+1,1000000) end
    returning current_limit.attempts into attempts;
    if attempts>max_attempts then return jsonb_build_object('error','Demasiados intentos. Espera 15 minutos antes de volver a intentar.','status',429); end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('registration:'||p_rut,0));
  if not private.registration_turn_allowed(p_rut) then
    return jsonb_build_object('error','ups no es tu turno','status',403);
  end if;
  identity:=private.registration_identity(p_rut);
  if identity is null then return jsonb_build_object('error','Error al comunicar con el servidor','status',403); end if;
  select * into existing from public.profiles where rut=p_rut;
  if found then
    if not existing.active or existing.employment_status<>'active' then
      return jsonb_build_object('error','Error al comunicar con el servidor','status',403);
    end if;
    return jsonb_build_object('error','Ya tienes una cuenta. Inicia sesión o solicita recuperar acceso.','status',409);
  end if;
  select * into claim from private.registration_claims where rut=p_rut for update;
  if found and (claim.claimed_at is not null or claim.expires_at>now_at) then
    return jsonb_build_object('error','Hay un registro en curso. Espera unos minutos o inicia sesión.','status',409);
  end if;
  insert into private.registration_claims(rut,request_id,expires_at) values(p_rut,p_request_id,now_at+interval '5 minutes')
  on conflict(rut) do update set request_id=excluded.request_id,expires_at=excluded.expires_at,claimed_at=null;
  return jsonb_build_object('ok',true,'role',identity->>'role');
end;
$$;
revoke all on function public.reserve_roster_registration(text,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_roster_registration(text,uuid,text) to service_role;
create or replace function private.registration_identity(p_rut text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare control public.registration_controls%rowtype; worker public.commercial_workers%rowtype;
begin
  if not private.registration_turn_allowed(p_rut) then return null; end if;
  select * into control from public.registration_controls where rut=p_rut;
  if found and not control.enabled then return null; end if;
  if control.audiovisual_name is not null then
    return jsonb_build_object('name',trim(control.audiovisual_name),'role','audiovisual');
  end if;
  select * into worker from public.commercial_workers where rut=p_rut;
  if not found or not worker.active or worker.status<>'active'
    or worker.role not in ('seller','coordinator','sales_manager','commercial_manager','sales_director') then return null; end if;
  return jsonb_build_object('name',worker.name,'role',worker.role,'join_date',worker.join_date,'birth_date',worker.birth_date);
end;
$$;
commit;
