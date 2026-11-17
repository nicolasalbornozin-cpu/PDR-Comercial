begin;
alter table public.sheet_uploads drop constraint goal_slot_source,
 add constraint goal_slot_source check(goal_slot='current' or source in ('category','senior','ranking_monthly'));
alter table public.current_sheet_uploads drop constraint current_slot_source,
 add constraint current_slot_source check(goal_slot='current' or source in ('category','senior','ranking_monthly'));
alter table public.platform_settings drop constraint platform_settings_id_check,
 add constraint platform_settings_id_check check(id in ('monthly_ranking','monthly_ranking_previous','category_current','category_previous','senior_current','senior_previous'));

-- Keep historical monthly data out of the dashboard feed used by installed clients.
create or replace view public.active_worker_metrics with(security_invoker=true) as
 select m.worker_id,m.metrics,m.source_row,u.*
 from public.sheet_metrics m join public.sheet_uploads u on u.id=m.upload_id
 join public.current_sheet_uploads c on c.upload_id=u.id and c.source=u.source and c.goal_slot=u.goal_slot
 where not (c.source='ranking_monthly' and c.goal_slot='previous');

do $$declare definition text;begin
 definition:=pg_get_functiondef('private.valid_worker_metrics(jsonb)'::regprocedure);
 if strpos(definition,'''homeAnnualEmittedUf''')=0 then raise exception 'No se reconoce el validador';end if;
 execute replace(definition,'''homeAnnualEmittedUf''','''homeAnnualEmittedUf'',''homeMonthlyGrossUf'',''homeMonthlyEmittedUf''');

 definition:=pg_get_functiondef('public.publish_individual_sheet(jsonb,jsonb)'::regprocedure);
 if strpos(definition,'p_upload->>''source'' not in (''category'',''senior'')')=0
 or strpos(definition,'u.id<>new_id')=0 or strpos(definition,'and id<>new_id')=0 then
  raise exception 'No se reconoce la función de publicación';
 end if;
 definition:=replace(definition,'p_upload->>''source'' not in (''category'',''senior'')','p_upload->>''source'' not in (''category'',''senior'',''ranking_monthly'')');
 definition:=replace(definition,'u.id<>new_id','u.goal_slot=slot and u.id<>new_id');
 definition:=replace(definition,'and id<>new_id','and goal_slot=slot and id<>new_id');
 execute definition;
end $$;

create or replace function public.publish_sheet_bundle(p_imports jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item jsonb; upload jsonb; result jsonb:='[]';
begin
 if not coalesce(private.is_admin(),false) then raise exception 'No autorizado';end if;
 if jsonb_typeof(p_imports) is distinct from 'array' or jsonb_array_length(p_imports) not between 2 and 4 then raise exception 'Conjunto inválido';end if;
 if exists(select 1 from jsonb_array_elements(p_imports)i where i->'upload'->>'source' not in ('ranking_monthly','ranking_annual','cancellations','production_sellers','production_coordinators')) then raise exception 'Origen inválido';end if;
 if (select count(distinct (i->'upload'->>'source',coalesce(i->'upload'->>'goal_slot','current'))) from jsonb_array_elements(p_imports)i)<>jsonb_array_length(p_imports) then raise exception 'Destino repetido';end if;
 for item in select value from jsonb_array_elements(p_imports) order by value->'upload'->>'source',value->'upload'->>'goal_slot' loop
  upload:=item->'upload';
  result:=result||jsonb_build_array(public.publish_individual_sheet(upload,item->'records'));
  if upload->>'source'='ranking_monthly' then
   insert into public.platform_settings(id,label) values (
    case when upload->>'goal_slot'='previous' then 'monthly_ranking_previous' else 'monthly_ranking' end,
    upload->>'label'
   ) on conflict(id) do update set label=excluded.label;
  end if;
 end loop;
 return result;
end $$;

create function private.sheet_ranking_v3(p_period text,p_mode text,p_target text,p_slot text) returns jsonb
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
 if profile_role='admin' and p_target is null then target_id:=null;end if;
 select * into me from public.commercial_workers where id=target_id and active and status='active';
 if (me.id is null and profile_role<>'admin') or (p_target is not null and me.id is null) then raise exception 'Error 444';end if;
 if p_period is null or p_period not in ('annual','monthly') or p_mode is null or p_mode not in ('executives','teams','units') or p_slot is null or p_slot not in ('current','previous') or (p_period='annual' and (p_slot<>'current' or p_mode<>'executives')) then raise exception 'Ranking inválido';end if;
 if not exists(select 1 from public.current_sheet_uploads c join public.sheet_metrics m on m.upload_id=c.upload_id
 where c.source='ranking_'||p_period and c.goal_slot=p_slot and m.metrics?'totalUf') then return '[]'::jsonb;end if;
 with published_groups as (
  select m.worker_id,m.metrics from public.current_sheet_uploads c
  join public.sheet_metrics m on m.upload_id=c.upload_id
  where c.source='ranking_'||p_period and c.goal_slot=p_slot and m.metrics?'homeMonthlyGrossUf'
 ), sellers as (
  select w.id,w.ranking_id,w.name,w.display_name,w.coordinator_id,w.manager_id,w.status,
   coalesce((m.metrics->>'totalUf')::numeric,0) as uf,coalesce((m.metrics->>'emittedUf')::numeric,0) as emitted
  from public.commercial_workers w
  left join public.current_sheet_uploads c on c.source='ranking_'||p_period and c.goal_slot=p_slot
  left join public.sheet_metrics m on m.upload_id=c.upload_id and m.worker_id=w.id
  where w.role='seller' and ((w.active and w.status='active') or w.status='course')
 ),entities as (
  select s.id,s.ranking_id,s.name,s.display_name,null::text as team_name,s.uf,s.emitted,
   s.id=target_id as is_current,'executive'::text as entity_type
  from sellers s where p_mode='executives' and s.status='active'
  and (me.id is null or me.role in ('seller','commercial_manager','sales_director')
   or me.role='coordinator' and s.coordinator_id=me.id or me.role='sales_manager' and s.manager_id=me.id)
  union all
  select w.id,w.ranking_id,coalesce(w.team_name,'Equipo sin nombre asignado'),null::text,w.team_name,
   coalesce((g.metrics->>'homeMonthlyGrossUf')::numeric,sum(s.uf),0),
   coalesce((g.metrics->>'homeMonthlyEmittedUf')::numeric,sum(s.emitted),0),
   (w.id=target_id or w.id=me.coordinator_id),'team'::text
  from public.commercial_workers w left join sellers s on s.coordinator_id=w.id
  left join published_groups g on g.worker_id=w.id
  where p_mode='teams' and (
   (w.team_name is not null and exists(select 1 from published_groups))
   or (not exists(select 1 from published_groups) and w.role='coordinator' and w.active and w.status='active')
  )
  and (me.id is null or me.role in ('seller','coordinator','commercial_manager','sales_director')
   or me.role='sales_manager' and w.manager_id=me.id)
  group by w.id,w.ranking_id,w.team_name,g.metrics
  union all
  select w.id,w.ranking_id,u.name,null::text,u.name,
   (g.metrics->>'homeMonthlyGrossUf')::numeric,(g.metrics->>'homeMonthlyEmittedUf')::numeric,
   (w.id=target_id or w.id=me.manager_id),'unit'::text
  from published_groups g join public.commercial_workers w on w.id=g.worker_id
  join (values ('124603005','PIONEROS'),('83624663','MATRIX'),('10368000k','OLIMPO')) u(rut,name) on u.rut=w.rut
  where p_mode='units' and w.role='sales_manager' and w.active and w.status='active'
 ),ranked as(select *,rank()over(order by uf desc)as position from entities)
 select coalesce(jsonb_agg(jsonb_build_object('userId',ranking_id,'name',name,'displayName',display_name,
  'entityType',entity_type,'teamName',team_name,'value',uf,'emittedValue',emitted,'notEmittedValue',greatest(uf-emitted,0),
  'position',position,'teamId',ranking_id,'avatar','','isCurrentUser',coalesce(is_current,false)) order by position,name),'[]'::jsonb)
 into result from ranked;
 return result;
end $$;
revoke all on function private.sheet_ranking_v3(text,text,text,text) from public,anon;
grant execute on function private.sheet_ranking_v3(text,text,text,text) to authenticated;
create function public.individual_sheet_ranking_v3(p_period text,p_mode text,p_target text default null,p_slot text default 'current') returns jsonb
language sql stable security invoker set search_path='' as $$select private.sheet_ranking_v3(p_period,p_mode,p_target,p_slot)$$;
revoke all on function public.individual_sheet_ranking_v3(text,text,text,text) from public,anon;
grant execute on function public.individual_sheet_ranking_v3(text,text,text,text) to authenticated;

-- Apply the same uploaded scopes to Inicio for the current month.
do $$declare definition text;begin
 definition:=pg_get_functiondef('private.sales_scope_totals(text)'::regprocedure);
 if strpos(definition,'),amounts as (')=0 or strpos(definition,'left join home h on h.id=s.id')=0
 or strpos(definition,'''monthlyGross'',coalesce(sum(monthly_gross),0)')=0 then
  raise exception 'No se reconoce la función de totales por alcance';
 end if;
 definition:=replace(definition,'),amounts as (',$month$),monthly_home as (
  select w.id,w.role,(m.metrics->>'homeMonthlyGrossUf')::numeric as gross,
   (m.metrics->>'homeMonthlyEmittedUf')::numeric as emitted
  from public.current_sheet_uploads c join public.sheet_metrics m on m.upload_id=c.upload_id
  join public.commercial_workers w on w.id=m.worker_id
  where c.source='ranking_monthly' and c.goal_slot='current'
   and m.metrics?'homeMonthlyGrossUf' and m.metrics?'homeMonthlyEmittedUf'
 ),monthly_channel as (
  select sum(h.gross) gross,sum(h.emitted) emitted from monthly_home h
  join public.commercial_workers w on w.id=h.id where w.role='sales_manager' and w.active and w.status='active'
  having count(*)=(select count(*) from public.commercial_workers where role='sales_manager' and active and status='active')
 ),amounts as ($month$);
 definition:=replace(definition,'coalesce(sum(a.monthly_gross),0)','coalesce(mh.gross,sum(a.monthly_gross),0)');
 definition:=replace(definition,'coalesce(sum(a.monthly_emitted),0)','coalesce(mh.emitted,sum(a.monthly_emitted),0)');
 definition:=replace(definition,'left join home h on h.id=s.id group by s.id,h.gross,h.emitted',
 'left join home h on h.id=s.id left join monthly_home mh on mh.id=s.id group by s.id,h.gross,h.emitted,mh.gross,mh.emitted');
 definition:=replace(definition,'''monthlyGross'',coalesce(sum(monthly_gross),0),''monthlyEmitted'',coalesce(sum(monthly_emitted),0)',
 $scope$'monthlyGross',coalesce(case when me.role in ('coordinator','sales_manager') then (select (totals->>'monthlyGross')::numeric from groups where id=me.id)
    when me.id is null or me.role in ('commercial_manager','sales_director') then (select gross from monthly_channel) end,sum(monthly_gross),0),
   'monthlyEmitted',coalesce(case when me.role in ('coordinator','sales_manager') then (select (totals->>'monthlyEmitted')::numeric from groups where id=me.id)
    when me.id is null or me.role in ('commercial_manager','sales_director') then (select emitted from monthly_channel) end,sum(monthly_emitted),0)$scope$);
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
