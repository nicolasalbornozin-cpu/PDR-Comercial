begin;
-- A disabled roster control must also block direct REST/table access with an
-- existing JWT. Restrictive policies intersect the existing per-team policies.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('create policy current_staff_session on public.%I as restrictive for all to authenticated using ((select private.session_access_allowed())) with check ((select private.session_access_allowed()))',t.tablename);
 end loop;
end $$;
-- These legacy definer RPCs are not used by the current app and bypass the
-- current roster gate. Preserve their definitions for operator recovery.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('commercial_ranking','commercial_dashboard_summary') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
-- Worker IDs historically contain RUTs. The comparative ranking must expose
-- random identifiers rather than those IDs, including in its teamId field.
alter table public.commercial_workers add column ranking_id uuid not null default gen_random_uuid() unique;
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
 select coalesce(jsonb_agg(jsonb_build_object('userId',(select w.ranking_id from public.commercial_workers w where w.id=ranked.id),'name',name,'value',uf,'emittedValue',emitted,
 'notEmittedValue',greatest(uf-emitted,0),'position',position,'teamId',(select w.ranking_id from public.commercial_workers w where w.id=ranked.id),'avatar','','isCurrentUser',id=target_id)
 order by position,name),'[]'::jsonb)into result from ranked;
 return result;
end $$;


commit;
