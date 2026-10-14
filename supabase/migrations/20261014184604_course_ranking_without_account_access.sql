begin;
alter table public.commercial_workers drop constraint commercial_workers_status_check;
alter table public.commercial_workers add constraint commercial_workers_status_check check(status in ('active','detached','medical_leave','vacation','course'));
alter table public.commercial_workers add constraint course_never_active check(status<>'course' or not active);
alter table public.profiles drop constraint profiles_employment_status_check;
alter table public.profiles add constraint profiles_employment_status_check check(employment_status in ('active','detached','medical_leave','vacation','course'));
create or replace function private.publish_dotacion(p_upload jsonb,p_records jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare new_id uuid;author uuid:=(select auth.uid()); before_workers jsonb;
begin
 if author is null or not coalesce(private.is_admin(),false) then raise exception 'No autorizado';end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 10000 then raise exception 'Dotacion vacía o inválida';end if;
 if jsonb_typeof(p_upload) is distinct from 'object' or length(coalesce(p_upload->>'filename','')) not between 1 and 240
 or length(coalesce(p_upload->>'label','')) not between 1 and 240
 or p_upload->>'sheet_name' not in ('Dotacion','Dotación','DOTACION','DOTACION VIG','dotacion')
 or (p_upload->>'period_start')::date is null or (p_upload->>'period_end')::date is null
 or (p_upload->>'period_end')::date<(p_upload->>'period_start')::date then raise exception 'Datos de carga inválidos';end if;
 if exists(select 1 from jsonb_array_elements(p_records)x where jsonb_typeof(x) is distinct from 'object'
 or coalesce(x->>'rut','')!~'^[0-9]{7,8}[0-9k]$' or length(coalesce(trim(x->>'name'),'')) not between 3 and 180
 or coalesce(x->>'role','') not in ('seller','coordinator','sales_manager')
 or coalesce(x->>'status','') not in ('active','detached','medical_leave','vacation','course')) then raise exception 'Trabajador inválido';end if;
 if exists(select 1 from jsonb_array_elements(p_records)x,jsonb_object_keys(x) k where k not in
 ('rut','name','role','status','birth_date','join_date','coordinator_rut','manager_rut')) then raise exception 'Columna no permitida';end if;
 if exists(select 1 from jsonb_array_elements(p_records)x group by x->>'rut' having count(*)>1) then raise exception 'RUT repetido';end if;
 if exists(select 1 from jsonb_array_elements(p_records)x where x->>'role'='seller' and not exists
 (select 1 from jsonb_array_elements(p_records)c where c->>'rut'=x->>'coordinator_rut' and c->>'role'='coordinator'))
 or exists(select 1 from jsonb_array_elements(p_records)x where x->>'role'<>'sales_manager' and not exists
 (select 1 from jsonb_array_elements(p_records)m where m->>'rut'=x->>'manager_rut' and m->>'role'='sales_manager')) then raise exception 'Jefatura ausente de Dotacion';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('dotacion'));
 select coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) into before_workers from public.commercial_workers w;
 -- Preserve stable IDs (notably manager-titanes), metrics, and the two commercial exceptions.
 update public.commercial_workers w set active=false,status='detached',updated_at=now()
 where not private.roster_exception(w.rut,w.role) and not exists
 (select 1 from jsonb_array_elements(p_records)x where x->>'rut'=w.rut);
 insert into public.commercial_workers(id,rut,name,role,active,status,birth_date,join_date)
 select x->>'rut',x->>'rut',trim(x->>'name'),x->>'role',x->>'status'='active',x->>'status',
 nullif(x->>'birth_date','')::date,nullif(x->>'join_date','')::date from jsonb_array_elements(p_records)x
 where x->>'rut' not in ('199584146','122608751','185413950')
 on conflict(rut) do update set
 name=excluded.name,role=excluded.role,active=excluded.active,status=excluded.status,
 birth_date=excluded.birth_date,join_date=excluded.join_date,updated_at=now(),
 aliases=case when public.commercial_workers.name<>excluded.name
 then array(select distinct a from unnest(public.commercial_workers.aliases||array[public.commercial_workers.name])a)
 else public.commercial_workers.aliases end;
 update public.commercial_workers w set
 coordinator_id=case when w.role='seller' then c.id else null end,
 manager_id=m.id
 from jsonb_array_elements(p_records)x
 left join public.commercial_workers c on c.rut=x->>'coordinator_rut'
 left join public.commercial_workers m on m.rut=x->>'manager_rut'
 where w.rut=x->>'rut' and w.rut not in ('199584146','122608751','185413950');
 -- Never change passwords or login IDs; keep administrator manual disabling.
 update public.profiles p set full_name=w.name,role=w.role,employment_status=w.status,
 join_date=coalesce(w.join_date,p.join_date),
 supervisor_id=(select parent.id from public.commercial_workers cw join public.profiles parent on parent.rut=cw.rut where cw.id=w.coordinator_id),
 sales_manager_id=(select parent.id from public.commercial_workers mw join public.profiles parent on parent.rut=mw.rut where mw.id=w.manager_id)
 from public.commercial_workers w where lower(regexp_replace(p.rut,'[^0-9kK]','','g'))=w.rut
 and p.role<>'admin' and not private.roster_exception(w.rut,p.role);
 insert into private.dotacion_uploads(filename,sheet_name,label,period_start,period_end,records,previous_workers,published_by)
 values(p_upload->>'filename',p_upload->>'sheet_name',p_upload->>'label',(p_upload->>'period_start')::date,
 (p_upload->>'period_end')::date,p_records,before_workers,author) returning id into new_id;
 return new_id;
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
  select w.id,w.name,w.coordinator_id,w.manager_id,w.status,coalesce((m.metrics->>'totalUf')::numeric,0)as uf,
  coalesce((m.metrics->>'emittedUf')::numeric,0)as emitted
  from public.commercial_workers w
  left join public.current_sheet_uploads c on c.source='ranking_'||p_period
  left join public.sheet_metrics m on m.upload_id=c.upload_id and m.worker_id=w.id
  where w.role='seller' and ((w.active and w.status='active') or w.status='course')
 ),entities as (
  select id,name,uf,emitted from values_by_seller where coalesce(me.role,'seller')='seller' and status='active'
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


create or replace function private.ranking_executive_count() returns integer language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.commercial_workers where role='seller' and ((active and status='active') or status='course') and (select private.sheet_access());
$$;
-- Internal aggregate endpoint. CURSO never becomes readable as a worker profile
-- or a detailed metric row. A caller may only choose another target if admin.
create function private.sales_scope_totals(p_target text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.commercial_workers;profile_role text;target_id text;result jsonb;
begin
 if not private.sheet_access() then raise exception 'Error 444';end if;
 select p.role,w.id into profile_role,target_id from public.profiles p left join public.commercial_workers w
 on w.rut=lower(regexp_replace(p.rut,'[^0-9kK]','','g')) where p.id=(select auth.uid());
 if p_target is not null then
  if profile_role<>'admin' and p_target is distinct from target_id then raise exception 'No autorizado';end if;
  target_id:=p_target;
 end if;
 select * into me from public.commercial_workers where id=target_id and active and status='active';
 if (me.id is null and profile_role<>'admin') or (p_target is not null and me.id is null) then raise exception 'Error 444';end if;
 with amounts as (
  select w.id,w.coordinator_id,w.manager_id,
   coalesce(sum((m.metrics->>'totalUf')::numeric)filter(where c.source='ranking_annual'),0)as annual_gross,
   coalesce(sum((m.metrics->>'emittedUf')::numeric)filter(where c.source='ranking_annual'),0)as annual_emitted,
   coalesce(sum((m.metrics->>'totalUf')::numeric)filter(where c.source='ranking_monthly'),0)as monthly_gross,
   coalesce(sum((m.metrics->>'emittedUf')::numeric)filter(where c.source='ranking_monthly'),0)as monthly_emitted
  from public.commercial_workers w
  left join public.current_sheet_uploads c on c.source in ('ranking_annual','ranking_monthly') and c.goal_slot='current'
  left join public.sheet_metrics m on m.upload_id=c.upload_id and m.worker_id=w.id
  where w.role='seller' and ((w.active and w.status='active') or w.status='course')
  and (me.id is null or me.role in ('commercial_manager','sales_director') or me.role='seller' and w.id=me.id
   or me.role='coordinator' and w.coordinator_id=me.id or me.role='sales_manager' and w.manager_id=me.id)
  group by w.id,w.coordinator_id,w.manager_id
 ),scopes as (
  select w.id,w.role from public.commercial_workers w where w.role in ('coordinator','sales_manager') and w.active and w.status='active'
  and (me.id is null or me.role in ('commercial_manager','sales_director') or me.role='coordinator' and w.id=me.id
   or me.role='sales_manager' and (w.id=me.id or w.manager_id=me.id))
 ),groups as (
  select s.id,jsonb_build_object('annualGross',coalesce(sum(a.annual_gross),0),'annualEmitted',coalesce(sum(a.annual_emitted),0),
   'monthlyGross',coalesce(sum(a.monthly_gross),0),'monthlyEmitted',coalesce(sum(a.monthly_emitted),0))as totals
  from scopes s left join amounts a on (s.role='coordinator' and a.coordinator_id=s.id) or (s.role='sales_manager' and a.manager_id=s.id) group by s.id
 )select jsonb_build_object('scope',jsonb_build_object('annualGross',coalesce(sum(annual_gross),0),'annualEmitted',coalesce(sum(annual_emitted),0),
  'monthlyGross',coalesce(sum(monthly_gross),0),'monthlyEmitted',coalesce(sum(monthly_emitted),0)),
  'groups',coalesce((select jsonb_object_agg(id,totals)from groups),'{}'::jsonb)) into result from amounts;
 return result;
end $$;
revoke all on function private.sales_scope_totals(text) from public,anon;
grant execute on function private.sales_scope_totals(text) to authenticated;
create function public.sales_scope_totals(p_target text default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.sales_scope_totals(p_target)$$;
revoke all on function public.sales_scope_totals(text) from public,anon;
grant execute on function public.sales_scope_totals(text) to authenticated;

commit;
