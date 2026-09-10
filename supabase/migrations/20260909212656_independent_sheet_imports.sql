begin;

-- Roster identities are not login accounts. Only administrators can maintain them.
create table public.commercial_workers (
 id text primary key, rut text unique, name text not null, aliases text[] not null default '{}',
 role text not null check(role in ('seller','coordinator','sales_manager')),
 active boolean not null default false,
 status text not null check(status in ('active','detached','medical_leave','vacation')),
 coordinator_id text, manager_id text, birth_date date, join_date date,
 updated_at timestamptz not null default now()
);
create index commercial_workers_coordinator_idx on public.commercial_workers(coordinator_id);
create index commercial_workers_manager_idx on public.commercial_workers(manager_id);
create table public.sheet_uploads (
 id uuid primary key default gen_random_uuid(),
 source text not null check(source in ('category','production_sellers','production_coordinators','senior','titanes','rbh','msc','sauce','ranking_monthly','ranking_annual')),
 filename text not null, sheet_name text not null, label text not null,
 period_start date not null, period_end date not null check(period_end>=period_start),
 senior_status text check(senior_status in ('open','closed')),
 rules jsonb not null default '[]'::jsonb check(jsonb_typeof(rules)='array'),
 published_at timestamptz not null default now(),
 published_by uuid not null references public.profiles(id),
 unique(id,source)
);
create index sheet_uploads_author_idx on public.sheet_uploads(published_by);
create table public.sheet_metrics (
 upload_id uuid not null references public.sheet_uploads(id),
 worker_id text not null references public.commercial_workers(id),
 metrics jsonb not null check(jsonb_typeof(metrics)='object'), source_row integer not null check(source_row>0),
 primary key(upload_id,worker_id)
);
create index sheet_metrics_worker_idx on public.sheet_metrics(worker_id);
create table public.current_sheet_uploads (
 source text primary key, upload_id uuid not null,
 foreign key(upload_id,source) references public.sheet_uploads(id,source)
);
create index current_sheet_uploads_upload_idx on public.current_sheet_uploads(upload_id,source);

-- Internal lookup must bypass roster RLS to avoid recursive policies. It checks
-- the authenticated profile and authoritative (admin-managed) workforce status.
create function private.sheet_worker_allowed(target_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.profiles p
  left join public.commercial_workers me on me.rut=lower(regexp_replace(p.rut,'[^0-9kK]','','g'))
  join public.commercial_workers target on target.id=target_id
  where p.id=(select auth.uid()) and p.active
   and (p.role='admin' or (me.active and me.status='active' and target.active and target.status='active'
    and (target.id=me.id or (me.role='coordinator' and target.coordinator_id=me.id)
         or (me.role='sales_manager' and target.manager_id=me.id))))
 );
$$;
revoke all on function private.sheet_worker_allowed(text) from public,anon;
grant execute on function private.sheet_worker_allowed(text) to authenticated;
create function private.sheet_access() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p left join public.commercial_workers w
 on w.rut=lower(regexp_replace(p.rut,'[^0-9kK]','','g'))
 where p.id=(select auth.uid()) and p.active and (p.role='admin' or (w.active and w.status='active')));
$$;
revoke all on function private.sheet_access() from public,anon;
grant execute on function private.sheet_access() to authenticated;

alter table public.commercial_workers enable row level security;
alter table public.sheet_uploads enable row level security;
alter table public.sheet_metrics enable row level security;
alter table public.current_sheet_uploads enable row level security;
revoke all on public.commercial_workers,public.sheet_uploads,public.sheet_metrics,public.current_sheet_uploads from public,anon,authenticated;
grant select,insert,update,delete on public.commercial_workers,public.sheet_uploads,public.sheet_metrics,public.current_sheet_uploads to authenticated;
create policy workers_read on public.commercial_workers for select to authenticated using(private.sheet_worker_allowed(id));
create policy workers_admin on public.commercial_workers for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy uploads_read on public.sheet_uploads for select to authenticated using((select private.sheet_access()));
create policy uploads_admin on public.sheet_uploads for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy metrics_read on public.sheet_metrics for select to authenticated using(private.sheet_worker_allowed(worker_id));
create policy metrics_admin on public.sheet_metrics for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy current_read on public.current_sheet_uploads for select to authenticated using((select private.sheet_access()));
create policy current_admin on public.current_sheet_uploads for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));

create view public.current_worker_metrics with(security_invoker=true) as
 select m.worker_id,m.metrics,m.source_row,u.* from public.sheet_metrics m
 join public.sheet_uploads u on u.id=m.upload_id
 join public.current_sheet_uploads c on c.upload_id=u.id and c.source=u.source;
revoke all on public.current_worker_metrics from public,anon,authenticated;
grant select on public.current_worker_metrics to authenticated;

-- Single transaction. A failed row never publishes a partial import. The previous
-- upload remains recoverable and other sources' pointers are never touched.
create function public.publish_individual_sheet(p_upload jsonb,p_records jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare new_id uuid; n integer;
begin
 if not coalesce(private.is_admin(),false) then raise exception 'No autorizado'; end if;
 if jsonb_typeof(p_records) is distinct from 'array' then raise exception 'Filas inválidas'; end if;
 if jsonb_array_length(p_records) not between 1 and 10000 then raise exception 'Filas inválidas'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('sheet:'||(p_upload->>'source')));
 if exists(select 1 from jsonb_array_elements(p_records) x where jsonb_typeof(x->'metrics') is distinct from 'object'
    or length((x->'metrics')::text)>10000) then raise exception 'Métricas inválidas'; end if;
 -- Prevent accidental raw client data from reaching the API.
 if exists(select 1 from jsonb_array_elements(p_records) x, jsonb_object_keys(x->'metrics') k where k not in
 ('smad','uf','prize','level','remaining','rest','ssff','tenureMonths','cancellationUf','potentialLevel',
 'businesses','productivity','headcount','teamProduction','employmentStatus','lastSaleDate','daysWithoutSale','daysWithoutSaleText',
 'debtSales','debtUf','debtInstallments','debtUf08','debtSales08','risk','position','emittedUf'))
 then raise exception 'Columna no permitida'; end if;
 insert into public.sheet_uploads(source,filename,sheet_name,label,period_start,period_end,senior_status,rules,published_by)
 values(p_upload->>'source',p_upload->>'filename',p_upload->>'sheet_name',p_upload->>'label',
 (p_upload->>'period_start')::date,(p_upload->>'period_end')::date,p_upload->>'senior_status',coalesce(p_upload->'rules','[]'::jsonb),(select auth.uid())) returning id into new_id;
 insert into public.sheet_metrics(upload_id,worker_id,metrics,source_row)
 select new_id,x->>'worker_id',x->'metrics',(x->>'source_row')::integer from jsonb_array_elements(p_records)x;
 get diagnostics n=row_count;
 if n<>jsonb_array_length(p_records) then raise exception 'Carga incompleta'; end if;
 insert into public.current_sheet_uploads(source,upload_id) values(p_upload->>'source',new_id)
 on conflict(source) do update set upload_id=excluded.upload_id;
 return new_id;
end $$;
revoke all on function public.publish_individual_sheet(jsonb,jsonb) from public,anon;
grant execute on function public.publish_individual_sheet(jsonb,jsonb) to authenticated;

create function public.search_commercial_workers(p_query text,p_role text)
returns setof public.commercial_workers language sql stable security invoker set search_path='' as $$
 select w.* from public.commercial_workers w where (select private.is_admin()) and w.active and w.status='active'
 and w.role=p_role and length(trim(p_query))>=2
 and not exists(select 1 from regexp_split_to_table(lower(translate(trim(p_query),'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),'\s+') token
 where position(token in lower(translate(w.name,'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')))=0)
 order by w.name,w.id limit 8;
$$;
revoke all on function public.search_commercial_workers(text,text) from public,anon;
grant execute on function public.search_commercial_workers(text,text) to authenticated;

-- Ranking intentionally exposes only name and emitted UF, never debt/productivity
-- of another team. The internal definer provides this restricted cross-team view.
create function private.sheet_ranking(p_period text,p_target text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.commercial_workers; profile_role text; target_id text; result jsonb;
begin
 if not private.sheet_access() then raise exception 'Error al comunicar con el servidor'; end if;
 select p.role,w.id into profile_role,target_id from public.profiles p left join public.commercial_workers w
 on w.rut=lower(regexp_replace(p.rut,'[^0-9kK]','','g')) where p.id=(select auth.uid());
 if p_target is not null then
  if profile_role<>'admin' and p_target is distinct from target_id then raise exception 'No autorizado'; end if;
  target_id=p_target;
 end if;
 select * into me from public.commercial_workers where id=target_id and active and status='active';
 if me.id is null and profile_role<>'admin' then raise exception 'Error al comunicar con el servidor'; end if;
 if p_period is null or p_period not in ('annual','monthly') then raise exception 'Período inválido'; end if;
 if not exists(select 1 from public.current_sheet_uploads where source='ranking_'||p_period) then return '[]'::jsonb; end if;
 with values_by_seller as (
  select w.id,w.name,w.coordinator_id,w.manager_id,coalesce((m.metrics->>'emittedUf')::numeric,0) as uf
  from public.commercial_workers w
  left join public.current_sheet_uploads c on c.source='ranking_'||p_period
  left join public.sheet_metrics m on m.upload_id=c.upload_id and m.worker_id=w.id
  where w.role='seller' and w.active and w.status='active'
 ), entities as (
  select id,name,uf from values_by_seller where coalesce(me.role,'seller')='seller'
  union all
  select w.id,w.name,coalesce(sum(s.uf),0) from public.commercial_workers w
  left join values_by_seller s on s.coordinator_id=w.id
  where w.active and w.status='active' and w.role='coordinator'
  and (me.role='coordinator' or (me.role='sales_manager' and w.manager_id=me.id)) group by w.id,w.name
 ), ranked as(select *,rank()over(order by uf desc)as position from entities)
 select coalesce(jsonb_agg(jsonb_build_object('userId',id,'name',name,'value',uf,'position',position,'teamId',id,'avatar','','isCurrentUser',id=target_id)order by position,name),'[]'::jsonb) into result from ranked;
 return result;
end $$;
revoke all on function private.sheet_ranking(text,text) from public,anon;
grant execute on function private.sheet_ranking(text,text) to authenticated;
create function public.individual_sheet_ranking(p_period text,p_target text default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.sheet_ranking(p_period,p_target)$$;
revoke all on function public.individual_sheet_ranking(text,text) from public,anon;
grant execute on function public.individual_sheet_ranking(text,text) to authenticated;
commit;
