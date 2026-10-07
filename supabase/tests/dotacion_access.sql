begin;
set constraints auth.on_auth_user_created immediate;
insert into public.commercial_workers(id,rut,name,role,active,status) values
 ('__dot_manager','990001001','JEFE QA','sales_manager',true,'active'),
 ('__dot_coord','990001010','COORDINADOR QA','coordinator',true,'active'),
 ('__dot_seller','990001028','VENDEDOR QA','seller',true,'active'),
 ('__dot_missing','990001036','AUSENTE QA','seller',true,'active');
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
values ('00000000-0000-4000-8000-000000000771','990001028@pdr.internal','{"rut":"990001028","name":"VENDEDOR QA"}','{"role":"seller"}');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where role='admin' and active limit 1),'role','authenticated')::text,true);
do $$
declare before_count integer;u uuid;rows jsonb;bad boolean:=false;
begin
 select count(*) into before_count from public.sheet_metrics;
 rows:='[{"rut":"990001001","name":"JEFE QA","role":"sales_manager","status":"active"},
 {"rut":"990001010","name":"COORDINADOR QA","role":"coordinator","status":"active","manager_rut":"990001001"},
 {"rut":"990001028","name":"VENDEDOR QA","role":"seller","status":"medical_leave","coordinator_rut":"990001010","manager_rut":"990001001"}]';
 u:=public.publish_dotacion('{"filename":"QA.xls","sheet_name":"Dotacion","label":"QA","period_start":"2026-10-07","period_end":"2026-10-07"}',rows);
 if not exists(select 1 from private.dotacion_uploads where id=u) then raise exception 'Snapshot missing';end if;
 if (select count(*) from public.sheet_metrics)<>before_count then raise exception 'Metrics changed';end if;
 if not exists(select 1 from public.commercial_workers where id='__dot_missing' and not active and status='detached') then raise exception 'Missing worker still active';end if;
 if not exists(select 1 from public.commercial_workers where id='__dot_seller' and not active and status='medical_leave' and coordinator_id='__dot_coord' and manager_id='__dot_manager') then raise exception 'Roster status/hierarchy failed';end if;
 if not exists(select 1 from public.profiles where rut='990001028' and employment_status='medical_leave') then raise exception 'Existing profile unsynced';end if;
 if not exists(select 1 from public.commercial_workers where rut='199584146' and active and role='commercial_manager')
 or not exists(select 1 from public.commercial_workers where rut='122608751' and active and role='sales_director') then raise exception 'Management exceptions blocked';end if;
 if not private.roster_exception('185413950','audiovisual') or private.roster_exception('185413950','admin') then raise exception 'Exception widened';end if;
 begin perform public.publish_dotacion('{"filename":"QA.xls","sheet_name":"Dotacion","label":"QA","period_start":"2026-10-07","period_end":"2026-10-07"}',rows||'[{}]'::jsonb);exception when others then bad:=true;end;
 if not bad then raise exception 'Invalid import accepted';end if;
 if has_function_privilege('anon','public.publish_dotacion(jsonb,jsonb)','EXECUTE')
 or has_table_privilege('authenticated','private.dotacion_uploads','SELECT') then raise exception 'Private upload exposed';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000771","role":"authenticated"}',true);
set local role authenticated;
do $$
declare bad boolean:=false;
begin
 if public.session_access_allowed() or private.can_read_news() or private.can_access_commercial() then raise exception 'Medical leave session accepted';end if;
 if (select count(*) from public.current_worker_metrics)>0 then raise exception 'Medical leave metrics exposed';end if;
 begin perform public.publish_dotacion('{}','[]');exception when others then bad:=true;end;
 if not bad then raise exception 'Seller published roster';end if;
end $$;
reset role;
update public.commercial_workers set active=true,status='active' where id='__dot_seller';
update public.profiles set employment_status='active' where rut='990001028';
do $$begin if not public.session_access_allowed() then raise exception 'Vigente denied';end if;end $$;
update public.commercial_workers set active=false,status='vacation' where id='__dot_seller';
do $$begin if public.session_access_allowed() then raise exception 'Vacation accepted';end if;end $$;
update public.commercial_workers set status='detached' where id='__dot_seller';
do $$begin if public.session_access_allowed() then raise exception 'Absent accepted';end if;end $$;
select 'PASS: authoritative replacement, existing sessions, leave/vacation/absence, exceptions, hierarchy, unchanged metrics, private audit, admin-only publication' as result;
rollback;
