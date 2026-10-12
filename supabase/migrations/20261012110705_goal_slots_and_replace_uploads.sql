begin;
-- This migration does not delete any existing upload or metrics.
create table public.goal_sheet_slots (
 source text not null check(source in ('category','senior')),
 slot text not null check(slot in ('previous','current')),
 upload_id uuid not null,
 primary key(source,slot), unique(upload_id),
 foreign key(upload_id,source) references public.sheet_uploads(id,source)
);
alter table public.goal_sheet_slots enable row level security;
revoke all on public.goal_sheet_slots from public,anon,authenticated;
grant select,insert,update,delete on public.goal_sheet_slots to authenticated;
create policy goal_slots_read on public.goal_sheet_slots for select to authenticated using((select private.sheet_access()));
create policy goal_slots_admin on public.goal_sheet_slots for all to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));
create policy current_session_required on public.goal_sheet_slots as restrictive for all to authenticated
 using((select private.session_access_allowed())) with check((select private.session_access_allowed()));
insert into public.goal_sheet_slots(source,slot,upload_id)
 select source,'previous',upload_id from public.current_sheet_uploads where source in ('category','senior');
create index sheet_uploads_source_idx on public.sheet_uploads(source);
create view public.active_worker_metrics with(security_invoker=true) as
 select m.worker_id,m.metrics,m.source_row,u.*,null::text as goal_slot
 from public.sheet_metrics m join public.sheet_uploads u on u.id=m.upload_id
 join public.current_sheet_uploads c on c.upload_id=u.id and c.source=u.source
 where u.source not in ('category','senior')
 union all
 select m.worker_id,m.metrics,m.source_row,u.*,s.slot as goal_slot
 from public.sheet_metrics m join public.sheet_uploads u on u.id=m.upload_id
 join public.goal_sheet_slots s on s.upload_id=u.id and s.source=u.source;
revoke all on public.active_worker_metrics from public,anon,authenticated;
grant select on public.active_worker_metrics to authenticated;

create or replace function public.publish_individual_sheet(p_upload jsonb,p_records jsonb) returns uuid
language plpgsql set search_path='' as $$
declare new_id uuid;n integer; goal_slot text; other_period public.sheet_uploads;
begin
 if not coalesce(private.is_admin(),false) then raise exception 'No autorizado';end if;
 if jsonb_typeof(p_records) is distinct from 'array' then raise exception 'Filas inválidas';end if;
 if jsonb_array_length(p_records) not between 1 and 10000 then raise exception 'Filas inválidas';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('sheet:'||(p_upload->>'source')));
 if p_upload->>'source' in ('category','senior') then
  goal_slot:=coalesce(p_upload->>'goal_slot','current');
  if goal_slot not in ('previous','current') then raise exception 'Selecciona anterior o vigente';end if;
  select u.* into other_period from public.goal_sheet_slots s join public.sheet_uploads u on u.id=s.upload_id
   where s.source=p_upload->>'source' and s.slot<>goal_slot;
  if other_period.id is not null and
   ((goal_slot='current' and (p_upload->>'period_start')::date<=other_period.period_end)
    or (goal_slot='previous' and (p_upload->>'period_end')::date>=other_period.period_start))
   then raise exception 'El período anterior debe terminar antes del vigente';end if;
 end if;
 if exists(select 1 from jsonb_array_elements(p_records)x where jsonb_typeof(x->'metrics') is distinct from 'object' or length((x->'metrics')::text)>10000) then raise exception 'Métricas inválidas';end if;
 if exists(select 1 from jsonb_array_elements(p_records)x,jsonb_object_keys(x->'metrics')k where k not in
 ('smad','smadRemaining','uf','prize','level','remaining','rest','ssff','tenureMonths','cancellationUf','potentialLevel','emittedSmad','emittedLevel',
 'businesses','productivity','headcount','teamProduction','employmentStatus','lastSaleDate','daysWithoutSale','daysWithoutSaleText',
 'debtSales','debtUf','debtInstallments','debtUf08','debtSales08','risk','position','emittedUf','notEmittedUf','totalUf')) then raise exception 'Columna no permitida';end if;
 insert into public.sheet_uploads(source,filename,sheet_name,label,period_start,period_end,senior_status,rules,published_by)
 values(p_upload->>'source',p_upload->>'filename',p_upload->>'sheet_name',p_upload->>'label',(p_upload->>'period_start')::date,(p_upload->>'period_end')::date,p_upload->>'senior_status',coalesce(p_upload->'rules','[]'::jsonb),(select auth.uid())) returning id into new_id;
 insert into public.sheet_metrics(upload_id,worker_id,metrics,source_row)
 select new_id,x->>'worker_id',x->'metrics',(x->>'source_row')::integer from jsonb_array_elements(p_records)x;
 get diagnostics n=row_count;
 if n<>jsonb_array_length(p_records) then raise exception 'Carga incompleta';end if;
 if goal_slot is not null then
  insert into public.goal_sheet_slots(source,slot,upload_id) values(p_upload->>'source',goal_slot,new_id)
   on conflict(source,slot) do update set upload_id=excluded.upload_id;
  -- Preserve compatibility for installed clients: current if present, otherwise previous.
  insert into public.current_sheet_uploads(source,upload_id)
   select source,upload_id from public.goal_sheet_slots where source=p_upload->>'source'
   order by case slot when 'current' then 0 else 1 end limit 1
   on conflict(source) do update set upload_id=excluded.upload_id;
 else
  insert into public.current_sheet_uploads(source,upload_id) values(p_upload->>'source',new_id)
   on conflict(source) do update set upload_id=excluded.upload_id;
  -- Transactional replacement: any failure restores the previous upload and pointer.
  delete from public.sheet_metrics m using public.sheet_uploads u
   where m.upload_id=u.id and u.source=p_upload->>'source' and u.id<>new_id;
  delete from public.sheet_uploads where source=p_upload->>'source' and id<>new_id;
 end if;
 return new_id;
end $$;


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
 or coalesce(x->>'status','') not in ('active','detached','medical_leave','vacation')) then raise exception 'Trabajador inválido';end if;
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
 -- Retain only the newly published roster payload; identity rows are never deleted.
 delete from private.dotacion_uploads where id<>new_id;
 update private.dotacion_uploads set previous_workers='[]'::jsonb where id=new_id;
 return new_id;
end;
$$;

commit;
