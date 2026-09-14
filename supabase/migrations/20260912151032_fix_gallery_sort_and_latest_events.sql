begin;

alter table public.gallery_images
  alter column sort_order type bigint
  using sort_order::bigint;

insert into public.news_articles
  (title, summary, body, category, featured, active, published_at, event_month, sort_order)
select
  'Últimos eventos',
  'Revisa las actividades más recientes de nuestros equipos.',
  'En este espacio compartiremos fotografías y una breve descripción de los últimos eventos de Parque del Recuerdo.',
  'Eventos recientes',
  false,
  true,
  now(),
  date_trunc('month', timezone('America/Santiago', now()))::date,
  35
where not exists (
  select 1
  from public.news_articles
  where lower(title) = lower('Últimos eventos')
);

create or replace function public.publish_individual_sheet(p_upload jsonb,p_records jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare new_id uuid; n integer;
begin
 if not coalesce(private.is_admin(),false) then raise exception 'No autorizado'; end if;
 if jsonb_typeof(p_records) is distinct from 'array' then raise exception 'Filas inválidas'; end if;
 if jsonb_array_length(p_records) not between 1 and 10000 then raise exception 'Filas inválidas'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('sheet:'||(p_upload->>'source')));
 if exists(select 1 from jsonb_array_elements(p_records) x where jsonb_typeof(x->'metrics') is distinct from 'object'
    or length((x->'metrics')::text)>10000) then raise exception 'Métricas inválidas'; end if;
 if exists(select 1 from jsonb_array_elements(p_records) x, jsonb_object_keys(x->'metrics') k where k not in
 ('smad','smadRemaining','uf','prize','level','remaining','rest','ssff','tenureMonths','cancellationUf','potentialLevel',
 'businesses','productivity','headcount','teamProduction','employmentStatus','lastSaleDate','daysWithoutSale','daysWithoutSaleText',
 'debtSales','debtUf','debtInstallments','debtUf08','debtSales08','risk','position','emittedUf','notEmittedUf'))
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

commit;
