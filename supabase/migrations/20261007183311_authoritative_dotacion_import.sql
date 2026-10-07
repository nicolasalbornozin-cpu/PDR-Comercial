begin;

-- Full roster imports are separate from metric uploads. Keep private snapshots
-- for recovery; only the minimal worker identity/status/hierarchy is accepted.
create table private.dotacion_uploads (
 id uuid primary key default gen_random_uuid(), filename text not null,
 sheet_name text not null, label text not null, period_start date not null,
 period_end date not null check(period_end>=period_start), records jsonb not null,
 previous_workers jsonb not null, published_at timestamptz not null default now(),
 published_by uuid not null references public.profiles(id)
);
alter table private.dotacion_uploads enable row level security;
revoke all on private.dotacion_uploads from public,anon,authenticated,service_role;

create function private.roster_exception(p_rut text,p_role text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce((p_rut,p_role) in (('199584146','commercial_manager'),
 ('122608751','sales_director'),('185413950','audiovisual')),false);
$$;
revoke all on function private.roster_exception(text,text) from public,anon,authenticated;

-- Evaluate current server records, not stale JWT claims. This gate applies even
-- to an already-issued session and does not disclose anybody else's identity.
create function private.session_access_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p
 left join public.commercial_workers w on w.rut=lower(regexp_replace(p.rut,'[^0-9kK]','','g'))
 left join public.registration_controls c on c.rut=lower(regexp_replace(p.rut,'[^0-9kK]','','g'))
 where p.id=(select auth.uid()) and p.active and p.employment_status='active'
 and (p.role='admin' or (coalesce(c.enabled,true) and
 (private.roster_exception(lower(regexp_replace(p.rut,'[^0-9kK]','','g')),p.role)
 or (p.role in ('seller','coordinator','sales_manager') and w.role=p.role and w.active and w.status='active')))));
$$;
revoke all on function private.session_access_allowed() from public,anon;
grant execute on function private.session_access_allowed() to authenticated;
create function public.session_access_allowed() returns boolean
language sql stable security invoker set search_path='' as $$select private.session_access_allowed()$$;
revoke all on function public.session_access_allowed() from public,anon;
grant execute on function public.session_access_allowed() to authenticated;

create or replace function private.can_access_commercial() returns boolean
language sql stable security definer set search_path='' as $$
 select private.session_access_allowed() and exists(select 1 from public.profiles
 where id=(select auth.uid()) and role in ('seller','coordinator','sales_manager','commercial_manager','sales_director','admin'));
$$;
create or replace function private.sheet_access() returns boolean
language sql stable security definer set search_path='' as $$select private.can_access_commercial()$$;
create or replace function private.can_read_news() returns boolean
language sql stable security definer set search_path='' as $$select private.session_access_allowed()$$;
create or replace function private.can_edit_news() returns boolean
language sql stable security definer set search_path='' as $$
 select private.session_access_allowed() and exists(select 1 from public.profiles
 where id=(select auth.uid()) and role in ('admin','audiovisual'));
$$;

create function private.publish_dotacion(p_upload jsonb,p_records jsonb) returns uuid
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
 return new_id;
end;
$$;
revoke all on function private.publish_dotacion(jsonb,jsonb) from public,anon;
grant execute on function private.publish_dotacion(jsonb,jsonb) to authenticated;
create function public.publish_dotacion(p_upload jsonb,p_records jsonb) returns uuid
language sql security invoker set search_path='' as $$select private.publish_dotacion(p_upload,p_records)$$;
revoke all on function public.publish_dotacion(jsonb,jsonb) from public,anon;
grant execute on function public.publish_dotacion(jsonb,jsonb) to authenticated;
commit;
