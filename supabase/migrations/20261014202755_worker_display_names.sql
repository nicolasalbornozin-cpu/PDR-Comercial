begin;
-- Corrections are keyed by RUT, not the spelling/order supplied by an Excel.
-- This private registry can also retain a correction for a future roster row;
-- it never creates a worker, an authentication account or an access exception.
create table private.worker_display_names (
 rut text primary key check(rut ~ '^[0-9]{7,8}[0-9k]$'),
 display_name text not null check(length(trim(display_name)) between 3 and 180)
);
alter table private.worker_display_names enable row level security;
revoke all on private.worker_display_names from public,anon,authenticated;
alter table public.commercial_workers add column display_name text
 check(display_name is null or length(trim(display_name)) between 3 and 180);

create function private.apply_worker_display_name() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 select d.display_name into new.display_name from private.worker_display_names d where d.rut=new.rut;
 return new;
end $$;
revoke all on function private.apply_worker_display_name() from public,anon,authenticated;
create trigger worker_display_name before insert or update on public.commercial_workers
for each row execute function private.apply_worker_display_name();

create or replace function public.search_commercial_workers(p_query text,p_role text)
returns setof public.commercial_workers language sql stable security invoker set search_path='' as $$
 select w.* from public.commercial_workers w where (select private.is_admin()) and w.active and w.status='active'
 and w.role=p_role and length(trim(p_query))>=2
 and not exists(select 1 from regexp_split_to_table(lower(translate(trim(p_query),'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),'\s+') token
 where position(token in lower(translate(concat_ws(' ',w.name,w.display_name,array_to_string(w.aliases,' ')),'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')))=0)
 order by coalesce(w.display_name,w.name),w.id limit 8;
$$;
-- Preserve all scope/session checks and opaque IDs in the existing ranking.
do $$declare definition text;begin
 definition:=pg_get_functiondef('private.sheet_ranking(text,text)'::regprocedure);
 if strpos(definition,'''name'',name,''value''')=0 then raise exception 'Review ranking name projection';end if;
 definition:=replace(definition,'''name'',name,''value''','''name'',name,''displayName'',(select w.display_name from public.commercial_workers w where w.id=ranked.id),''value''');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
