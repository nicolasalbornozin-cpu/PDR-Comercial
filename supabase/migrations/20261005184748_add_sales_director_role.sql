begin;

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('seller','coordinator','sales_manager','commercial_manager','sales_director','admin','audiovisual'));

alter table public.commercial_workers drop constraint commercial_workers_role_check;
alter table public.commercial_workers add constraint commercial_workers_role_check
  check (role in ('seller','coordinator','sales_manager','commercial_manager','sales_director'));

create or replace function private.can_access_commercial() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid())
 and p.active and p.employment_status='active'
 and p.role in ('seller','coordinator','sales_manager','commercial_manager','sales_director','admin'));
$$;

create or replace function private.sheet_access() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p left join public.commercial_workers w
 on w.rut=lower(regexp_replace(p.rut,'[^0-9kK]','','g'))
 where p.id=(select auth.uid()) and p.active and p.employment_status='active'
 and (p.role='admin' or (p.role in ('seller','coordinator','sales_manager','commercial_manager','sales_director')
 and w.active and w.status='active')));
$$;

create or replace function private.sheet_worker_allowed(target_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p
 left join public.commercial_workers me on me.rut=lower(regexp_replace(p.rut,'[^0-9kK]','','g'))
 join public.commercial_workers target on target.id=target_id
 where p.id=(select auth.uid()) and p.active and p.employment_status='active'
 and (p.role='admin' or (p.role in ('seller','coordinator','sales_manager','commercial_manager','sales_director')
 and me.active and me.status='active' and target.active and target.status='active'
 and (me.role in ('commercial_manager','sales_director') or target.id=me.id
 or (me.role='coordinator' and target.coordinator_id=me.id)
 or (me.role='sales_manager' and target.manager_id=me.id)))));
$$;

create or replace function private.can_read_news() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p left join public.commercial_workers w
 on w.rut=lower(regexp_replace(p.rut,'[^0-9kK]','','g'))
 where p.id=(select auth.uid()) and p.active and p.employment_status='active'
 and (p.role in ('admin','audiovisual') or
 (p.role in ('seller','coordinator','sales_manager','commercial_manager','sales_director') and w.active and w.status='active')));
$$;

create or replace function private.registration_identity(p_rut text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare control public.registration_controls%rowtype; worker public.commercial_workers%rowtype;
begin
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

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  requested_role text:=coalesce(new.raw_app_meta_data->>'role','seller');
  registration_id uuid; rut_value text; identity jsonb; name_value text;
  join_value date:=current_date; supervisor_value uuid; manager_value uuid;
begin
  if new.raw_app_meta_data ? 'roster_registration' then
    registration_id:=(new.raw_app_meta_data->>'roster_registration')::uuid;
    rut_value:=new.raw_app_meta_data->>'roster_rut';
    perform pg_advisory_xact_lock(hashtextextended('registration:'||rut_value,0));
    perform 1 from private.registration_claims where rut=rut_value and request_id=registration_id
      and expires_at>clock_timestamp() and claimed_at is null for update;
    if not found then raise exception 'Registration reservation is not valid'; end if;
    identity:=private.registration_identity(rut_value);
    if identity is null or identity->>'role' is distinct from requested_role
      or lower(new.email) is distinct from rut_value||'@pdr.internal' then
      raise exception 'Registration is not enabled';
    end if;
    name_value:=identity->>'name';
    join_value:=coalesce((identity->>'join_date')::date,current_date);
    select p.id into supervisor_value from public.commercial_workers me
      join public.commercial_workers parent on parent.id=me.coordinator_id
      join public.profiles p on p.rut=parent.rut where me.rut=rut_value;
    select p.id into manager_value from public.commercial_workers me
      join public.commercial_workers parent on parent.id=me.manager_id
      join public.profiles p on p.rut=parent.rut where me.rut=rut_value;
    update private.registration_claims set claimed_at=clock_timestamp() where rut=rut_value and request_id=registration_id;
  else
    if not (new.raw_app_meta_data ? 'role')
      or requested_role not in ('seller','coordinator','sales_manager','commercial_manager','sales_director','audiovisual','admin') then
      raise exception 'Registration requires server provisioning';
    end if;
    rut_value:=nullif(lower(regexp_replace(coalesce(new.raw_user_meta_data->>'rut',''),'[^0-9kK]','','g')),'');
    name_value:=coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),split_part(new.email,'@',1));
  end if;
  insert into public.profiles(id,full_name,email,rut,role,must_change_password,join_date,supervisor_id,sales_manager_id)
  values(new.id,name_value,lower(new.email),rut_value,requested_role,
    coalesce((new.raw_app_meta_data->>'must_change_password')::boolean,false),join_value,supervisor_value,manager_value);
  if requested_role='seller' then insert into public.executive_metrics(user_id) values(new.id); end if;
  return new;
end;
$$;

create or replace function private.sheet_ranking(p_period text,p_target text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.commercial_workers;profile_role text;target_id text;result jsonb;
begin
 if not private.sheet_access() then raise exception 'Error al comunicar con el servidor';end if;
 select p.role,w.id into profile_role,target_id from public.profiles p left join public.commercial_workers w
 on w.rut=lower(regexp_replace(p.rut,'[^0-9kK]','','g')) where p.id=(select auth.uid());
 if p_target is not null then
  if profile_role<>'admin' and p_target is distinct from target_id then raise exception 'No autorizado';end if;
  target_id=p_target;
 end if;
 select * into me from public.commercial_workers where id=target_id and active and status='active';
 if me.id is null and profile_role<>'admin' then raise exception 'Error al comunicar con el servidor';end if;
 if p_period is null or p_period not in ('annual','monthly') then raise exception 'Período inválido';end if;
 if not exists(select 1 from public.current_sheet_uploads c join public.sheet_metrics m on m.upload_id=c.upload_id
 where c.source='ranking_'||p_period and m.metrics ? 'totalUf') then return '[]'::jsonb;end if;
 with values_by_seller as (
  select w.id,w.name,w.coordinator_id,w.manager_id,coalesce((m.metrics->>'totalUf')::numeric,0)as uf,
  coalesce((m.metrics->>'emittedUf')::numeric,0)as emitted
  from public.commercial_workers w
  left join public.current_sheet_uploads c on c.source='ranking_'||p_period
  left join public.sheet_metrics m on m.upload_id=c.upload_id and m.worker_id=w.id
  where w.role='seller' and w.active and w.status='active'
 ),entities as (
  select id,name,uf,emitted from values_by_seller where coalesce(me.role,'seller')='seller'
  union all
  select w.id,w.name,coalesce(sum(s.uf),0),coalesce(sum(s.emitted),0) from public.commercial_workers w
  left join values_by_seller s on s.coordinator_id=w.id
  where w.active and w.status='active' and w.role='coordinator'
  and (me.role='coordinator' or (me.role='sales_manager' and w.manager_id=me.id)) group by w.id,w.name
  union all
  select w.id,w.name,coalesce(sum(s.uf),0),coalesce(sum(s.emitted),0) from public.commercial_workers w
  left join values_by_seller s on s.manager_id=w.id
  where w.active and w.status='active' and w.role='sales_manager'
  and me.role in ('commercial_manager','sales_director') group by w.id,w.name
 ),ranked as(select *,rank()over(order by uf desc)as position from entities)
 select coalesce(jsonb_agg(jsonb_build_object('userId',id,'name',name,'value',uf,'emittedValue',emitted,
 'notEmittedValue',greatest(uf-emitted,0),'position',position,'teamId',id,'avatar','','isCurrentUser',id=target_id)
 order by position,name),'[]'::jsonb)into result from ranked;
 return result;
end $$;

insert into public.commercial_workers
  (id,rut,name,aliases,role,active,status,coordinator_id,manager_id,join_date,birth_date)
values
  ('122608751','122608751','GABRIEL DE LUCA',array['GABRIEL DE LUCA'],'sales_director',true,'active',null,null,current_date,null)
on conflict(id) do update set
  rut=excluded.rut,name=excluded.name,aliases=excluded.aliases,role=excluded.role,
  active=true,status='active',coordinator_id=null,manager_id=null;

commit;
