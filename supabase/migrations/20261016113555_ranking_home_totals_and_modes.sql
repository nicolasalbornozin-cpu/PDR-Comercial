begin;
-- Names survive subsequent roster upserts; no change to access/status/role.
alter table public.commercial_workers add column team_name text
 check(team_name is null or length(trim(team_name)) between 2 and 80);

-- Extend the existing strict aggregate whitelist, without accepting arbitrary
-- Excel fields, nested objects, contracts or customer data.
do $$declare definition text;begin
 definition:=pg_get_functiondef('private.valid_worker_metrics(jsonb)'::regprocedure);
 if strpos(definition,'''notEmittedUf'',''totalUf''')=0 then raise exception 'Review metric validator';end if;
 definition:=replace(definition,'''notEmittedUf'',''totalUf''','''notEmittedUf'',''totalUf'',''homeAnnualGrossUf'',''homeAnnualEmittedUf''');
 execute definition;
end $$;

create function private.sheet_ranking_v2(p_period text,p_mode text,p_target text) returns jsonb
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
 if p_period is null or p_period not in ('annual','monthly') or p_mode is null or p_mode not in ('executives','teams') then raise exception 'Ranking inválido';end if;
 if not exists(select 1 from public.current_sheet_uploads c join public.sheet_metrics m on m.upload_id=c.upload_id
 where c.source='ranking_'||p_period and c.goal_slot='current' and m.metrics?'totalUf') then return '[]'::jsonb;end if;
 with sellers as (
  select w.id,w.ranking_id,w.name,w.display_name,w.coordinator_id,w.manager_id,w.status,
   coalesce((m.metrics->>'totalUf')::numeric,0) as uf,coalesce((m.metrics->>'emittedUf')::numeric,0) as emitted
  from public.commercial_workers w
  left join public.current_sheet_uploads c on c.source='ranking_'||p_period and c.goal_slot='current'
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
   coalesce(sum(s.uf),0),coalesce(sum(s.emitted),0),
   (w.id=target_id or w.id=me.coordinator_id),'team'::text
  from public.commercial_workers w left join sellers s on s.coordinator_id=w.id
  where p_mode='teams' and w.role='coordinator' and w.active and w.status='active'
  and (me.id is null or me.role in ('seller','coordinator','commercial_manager','sales_director')
   or me.role='sales_manager' and w.manager_id=me.id)
  group by w.id,w.ranking_id,w.team_name
 ),ranked as(select *,rank()over(order by uf desc)as position from entities)
 select coalesce(jsonb_agg(jsonb_build_object('userId',ranking_id,'name',name,'displayName',display_name,
  'entityType',entity_type,'teamName',team_name,'value',uf,'emittedValue',emitted,'notEmittedValue',greatest(uf-emitted,0),
  'position',position,'teamId',ranking_id,'avatar','','isCurrentUser',coalesce(is_current,false)) order by position,name),'[]'::jsonb)
 into result from ranked;
 return result;
end $$;
revoke all on function private.sheet_ranking_v2(text,text,text) from public,anon;
grant execute on function private.sheet_ranking_v2(text,text,text) to authenticated;
create function public.individual_sheet_ranking_v2(p_period text,p_mode text,p_target text default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.sheet_ranking_v2(p_period,p_mode,p_target)$$;
revoke all on function public.individual_sheet_ranking_v2(text,text,text) from public,anon;
grant execute on function public.individual_sheet_ranking_v2(text,text,text) to authenticated;
-- Keep the original ranking endpoint intact for phones not yet updated.

create or replace function private.sales_scope_totals(p_target text) returns jsonb
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
 with home as (
  select w.id,w.role,(m.metrics->>'homeAnnualGrossUf')::numeric as gross,
   (m.metrics->>'homeAnnualEmittedUf')::numeric as emitted
  from public.current_sheet_uploads c join public.sheet_metrics m on m.upload_id=c.upload_id
  join public.commercial_workers w on w.id=m.worker_id
  where c.source='ranking_annual' and c.goal_slot='current'
   and m.metrics?'homeAnnualGrossUf' and m.metrics?'homeAnnualEmittedUf'
 ),amounts as (
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
  select s.id,jsonb_build_object('annualGross',coalesce(h.gross,sum(a.annual_gross),0),
   'annualEmitted',coalesce(h.emitted,sum(a.annual_emitted),0),'monthlyGross',coalesce(sum(a.monthly_gross),0),
   'monthlyEmitted',coalesce(sum(a.monthly_emitted),0))as totals
  from scopes s left join amounts a on (s.role='coordinator' and a.coordinator_id=s.id) or (s.role='sales_manager' and a.manager_id=s.id)
  left join home h on h.id=s.id group by s.id,h.gross,h.emitted
 ),channel as (
  -- Sum the jefaturas once, never both jefaturas and their coordinators.
  select sum(gross)as gross,sum(emitted)as emitted from home where role='sales_manager'
  having count(*)>0 and not exists(select 1 from public.commercial_workers w where w.role='sales_manager' and w.active and w.status='active'
   and not exists(select 1 from home h where h.id=w.id))
 )select jsonb_build_object('scope',jsonb_build_object(
  'annualGross',coalesce(case when me.role in ('coordinator','sales_manager') then (select (totals->>'annualGross')::numeric from groups where id=me.id)
    when me.id is null or me.role in ('commercial_manager','sales_director') then (select gross from channel) end,sum(annual_gross),0),
  'annualEmitted',coalesce(case when me.role in ('coordinator','sales_manager') then (select (totals->>'annualEmitted')::numeric from groups where id=me.id)
    when me.id is null or me.role in ('commercial_manager','sales_director') then (select emitted from channel) end,sum(annual_emitted),0),
  'monthlyGross',coalesce(sum(monthly_gross),0),'monthlyEmitted',coalesce(sum(monthly_emitted),0)),
  'groups',coalesce((select jsonb_object_agg(id,totals)from groups),'{}'::jsonb))into result from amounts;
 return result;
end $$;
notify pgrst,'reload schema';
commit;
