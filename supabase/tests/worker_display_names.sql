begin;
-- This rolls back all fixture changes. Confirmed labels are independent of
-- raw imported names and cannot enable a detached/absent worker.
do $$declare w public.commercial_workers;old_status text;old_active boolean;before_accounts bigint;definition text;begin
 select * into strict w from public.commercial_workers where role='seller' and active and status='active' order by id limit 1;
 before_accounts:=(select count(*)from auth.users);
 insert into private.worker_display_names(rut,display_name)values(w.rut,'Nombre Verificado')on conflict(rut)do update set display_name=excluded.display_name;
 update public.commercial_workers set name='APELLIDO SEGUNDO NOMBRE'where id=w.id;
 if(select display_name from public.commercial_workers where id=w.id)is distinct from 'Nombre Verificado'then raise exception 'Display correction lost on roster update';end if;
 if(select active from public.commercial_workers where id=w.id)is distinct from w.active or(select status from public.commercial_workers where id=w.id)is distinct from w.status then raise exception 'Name correction changed access';end if;
 if(select count(*)from auth.users)<>before_accounts then raise exception 'Name correction created an account';end if;
 if has_table_privilege('anon','private.worker_display_names','select')or has_table_privilege('authenticated','private.worker_display_names','select')or has_table_privilege('authenticated','private.worker_display_names','update')then raise exception 'Private name registry exposed';end if;
 definition:=pg_get_functiondef('private.sheet_ranking(text,text)'::regprocedure);
 if strpos(definition,'''displayName''')=0 or strpos(definition,'w.ranking_id')=0 or strpos(definition,'private.sheet_access()')=0 then raise exception 'Ranking labels/opaque IDs/access guard lost';end if;
end $$;
rollback;
