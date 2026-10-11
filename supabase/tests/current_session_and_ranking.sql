-- Run after the migration, as postgres, in a test transaction. Synthetic data only.
begin;
set constraints auth.on_auth_user_created immediate;
insert into public.commercial_workers(id,rut,name,role,active,status,coordinator_id,manager_id) values
 ('__qa_s','990009991','QA Seller','seller',true,'active','__qa_c','__qa_m'),
 ('__qa_o','990009992','QA Other','seller',true,'active',null,null),
 ('__qa_c','990009993','QA Coordinator','coordinator',true,'active',null,'__qa_m'),
 ('__qa_m','990009994','QA Manager','sales_manager',true,'active',null,null);
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000991','990009991@pdr.internal','{"rut":"990009991","name":"QA ADMIN"}','{"role":"admin"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000991","role":"authenticated"}',true);
set local role authenticated;
select public.publish_individual_sheet(
 '{"source":"ranking_annual","filename":"QA.xlsx","sheet_name":"QA","label":"QA","period_start":"2026-01-01","period_end":"2026-12-31"}',
 '[{"worker_id":"__qa_s","metrics":{"totalUf":120,"emittedUf":100},"source_row":1},{"worker_id":"__qa_o","metrics":{"totalUf":80,"emittedUf":60},"source_row":2}]');
reset role;
update public.profiles set role='seller' where id='00000000-0000-4000-8000-000000000991';
set local role authenticated;
do $$ declare r jsonb; begin
 if (select count(*) from public.commercial_workers)<>1 then raise exception 'seller scope';end if;
 if (select count(*) from public.current_worker_metrics)<>1 then raise exception 'seller metrics';end if;
 r:=public.individual_sheet_ranking('annual',null);
 if exists(select 1 from jsonb_array_elements(r)e where e->>'userId' !~ '^[0-9a-f-]{36}$' or e->>'teamId' !~ '^[0-9a-f-]{36}$' or e ? 'rut') then raise exception 'ranking identity leak';end if;
 if not exists(select 1 from jsonb_array_elements(r)e where (e->>'isCurrentUser')::boolean and (e->>'value')::numeric=120) then raise exception 'own ranking missing';end if;
 begin
  perform public.publish_individual_sheet('{}','[]');raise exception 'seller published';
 exception when others then if SQLERRM='seller published' then raise;end if;end;
end $$;
reset role;
update public.profiles set role='coordinator',rut='990009993' where id='00000000-0000-4000-8000-000000000991';
set local role authenticated;
do $$begin if (select count(*) from public.commercial_workers)<>2 then raise exception 'coordinator scope';end if;end$$;
reset role;
update public.profiles set role='sales_manager',rut='990009994' where id='00000000-0000-4000-8000-000000000991';
set local role authenticated;
do $$begin if (select count(*) from public.commercial_workers)<>3 then raise exception 'manager scope';end if;end$$;
reset role;
insert into public.registration_controls(rut,enabled,updated_by) values('990009994',false,'00000000-0000-4000-8000-000000000991');
set local role authenticated;
do $$begin
 if public.session_access_allowed() or (select count(*) from public.profiles)>0 or (select count(*) from public.current_worker_metrics)>0 then raise exception 'disabled access';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='commercial_ranking' and has_function_privilege('authenticated',p.oid,'EXECUTE')) then raise exception 'legacy bypass';end if;
end$$;
reset role;
select 'PASS: upload, team isolation, opaque ranking and disabled sessions' as result;
rollback;
