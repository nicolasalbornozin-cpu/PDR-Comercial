begin;
alter table public.sheet_uploads add column goal_slot text not null default 'current' check(goal_slot in ('current','previous'));
alter table public.sheet_uploads add constraint goal_slot_source check(goal_slot='current' or source in ('category','senior'));
alter table public.sheet_uploads drop constraint sheet_uploads_source_check;
alter table public.sheet_uploads add constraint sheet_uploads_source_check check(source in ('category','production_sellers','production_coordinators','senior','titanes','rbh','msc','sauce','ranking_monthly','ranking_annual','cancellations'));
alter table public.current_sheet_uploads add column goal_slot text not null default 'current' check(goal_slot in ('current','previous'));
alter table public.current_sheet_uploads drop constraint current_sheet_uploads_pkey;
alter table public.current_sheet_uploads add primary key(source,goal_slot);
alter table public.current_sheet_uploads add constraint current_slot_source check(goal_slot='current' or source in ('category','senior'));
alter table public.sheet_uploads add unique(id,source,goal_slot);
alter table public.current_sheet_uploads add foreign key(upload_id,source,goal_slot) references public.sheet_uploads(id,source,goal_slot);
create or replace view public.current_worker_metrics with(security_invoker=true) as
 select m.worker_id,m.metrics,m.source_row,u.* from public.sheet_metrics m
 join public.sheet_uploads u on u.id=m.upload_id
 join public.current_sheet_uploads c on c.upload_id=u.id and c.source=u.source where c.goal_slot='current';

create table public.platform_settings (
 id text primary key check(id in ('monthly_ranking','category_current','category_previous','senior_current','senior_previous')), label text not null check(length(trim(label)) between 1 and 120),
 updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id)
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from public,anon,authenticated;
grant select,insert,update on public.platform_settings to authenticated;
create policy settings_read on public.platform_settings for select to authenticated using((select private.sheet_access()));
create policy settings_admin_insert on public.platform_settings for insert to authenticated with check((select private.is_admin()));
create policy settings_admin_update on public.platform_settings for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
insert into public.platform_settings(id,label) values('monthly_ranking',coalesce((select u.label from public.current_sheet_uploads c join public.sheet_uploads u on u.id=c.upload_id where c.source='ranking_monthly' and c.goal_slot='current'),'Mes comercial vigente'));
create function private.stamp_platform_setting() returns trigger language plpgsql security invoker set search_path='' as $$begin new.updated_at:=clock_timestamp();new.updated_by:=(select auth.uid());return new;end$$;
revoke all on function private.stamp_platform_setting() from public,anon,authenticated;
create trigger platform_setting_stamp before insert or update on public.platform_settings for each row execute function private.stamp_platform_setting();
do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='platform_settings') then alter publication supabase_realtime add table public.platform_settings;end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='current_sheet_uploads') then alter publication supabase_realtime add table public.current_sheet_uploads;end if;
end $$;

create or replace function public.publish_individual_sheet(p_upload jsonb,p_records jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare new_id uuid;n integer;slot text:=coalesce(p_upload->>'goal_slot','current');
begin
 if not coalesce(private.is_admin(),false) then raise exception 'No autorizado';end if;
 if jsonb_typeof(p_upload) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_upload) k where k not in ('source','filename','sheet_name','label','period_start','period_end','senior_status','rules','goal_slot')) then raise exception 'Carga inválida';end if;
 if slot not in ('current','previous') or (slot='previous' and p_upload->>'source' not in ('category','senior')) then raise exception 'Destino inválido';end if;
 if length(coalesce(p_upload->>'label','')) not between 1 and 240 or length(coalesce(p_upload->>'filename','')) not between 1 and 240 or length(coalesce(p_upload->>'sheet_name','')) not between 1 and 100 then raise exception 'Nombre inválido';end if;
 if (p_upload->>'period_start')::date is null or (p_upload->>'period_end')::date is null then raise exception 'Período inválido';end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 10000 then raise exception 'Filas inválidas';end if;
 if exists(select 1 from jsonb_array_elements(p_records)x where not private.valid_worker_metrics(x->'metrics')) then raise exception 'Métricas no permitidas';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('sheet:'||(p_upload->>'source')||':'||slot));
 insert into public.sheet_uploads(source,filename,sheet_name,label,period_start,period_end,senior_status,rules,published_by,goal_slot)
 values(p_upload->>'source',p_upload->>'filename',p_upload->>'sheet_name',p_upload->>'label',(p_upload->>'period_start')::date,(p_upload->>'period_end')::date,p_upload->>'senior_status',coalesce(p_upload->'rules','[]'::jsonb),(select auth.uid()),slot) returning id into new_id;
 insert into public.sheet_metrics(upload_id,worker_id,metrics,source_row)
 select new_id,x->>'worker_id',x->'metrics',(x->>'source_row')::integer from jsonb_array_elements(p_records)x;
 get diagnostics n=row_count;
 if n<>jsonb_array_length(p_records) then raise exception 'Carga incompleta';end if;
 insert into public.current_sheet_uploads(source,upload_id,goal_slot) values(p_upload->>'source',new_id,slot)
 on conflict(source,goal_slot) do update set upload_id=excluded.upload_id;
 return new_id;
end $$;
revoke all on function public.publish_individual_sheet(jsonb,jsonb) from public,anon;
grant execute on function public.publish_individual_sheet(jsonb,jsonb) to authenticated;

-- All files in a ranking/production upload succeed together, or none does.
create function public.publish_sheet_bundle(p_imports jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item jsonb;result jsonb:='[]';
begin
 if not coalesce(private.is_admin(),false) then raise exception 'No autorizado';end if;
 if jsonb_typeof(p_imports) is distinct from 'array' or jsonb_array_length(p_imports) not between 2 and 3 then raise exception 'Conjunto inválido';end if;
 if exists(select 1 from jsonb_array_elements(p_imports)i where i->'upload'->>'source' not in ('ranking_monthly','ranking_annual','cancellations','production_sellers','production_coordinators')) then raise exception 'Origen inválido';end if;
 if (select count(distinct i->'upload'->>'source') from jsonb_array_elements(p_imports)i)<>jsonb_array_length(p_imports) then raise exception 'Origen repetido';end if;
 for item in select * from jsonb_array_elements(p_imports) order by value->'upload'->>'source' loop
 result:=result||jsonb_build_array(public.publish_individual_sheet(item->'upload',item->'records'));
 end loop;
 return result;
end $$;
revoke all on function public.publish_sheet_bundle(jsonb) from public,anon;
grant execute on function public.publish_sheet_bundle(jsonb) to authenticated;

create function private.ranking_executive_count() returns integer language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.commercial_workers where role='seller' and active and status='active' and (select private.sheet_access());
$$;
revoke all on function private.ranking_executive_count() from public,anon;
grant execute on function private.ranking_executive_count() to authenticated;
create function public.ranking_executive_count() returns integer language sql stable security invoker set search_path='' as $$select private.ranking_executive_count()$$;
revoke all on function public.ranking_executive_count() from public,anon;
grant execute on function public.ranking_executive_count() to authenticated;
commit;
