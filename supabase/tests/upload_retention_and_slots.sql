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

do $$declare first_id uuid;second_id uuid;previous_id uuid;current_id uuid;revised_previous_id uuid;before_count bigint;begin
 if (public.sales_scope_totals()->'scope'->>'annualGross')::numeric<>200 then raise exception 'Admin employee only saw own amount';end if;
 if (public.sales_scope_totals('__qa_s')->'scope'->>'annualGross')::numeric<>120 then raise exception 'Admin preview lost own scope';end if;
 select count(*) into before_count from public.sheet_uploads where source='senior';
 first_id:=public.publish_individual_sheet('{"source":"sauce","filename":"QA.xlsx","sheet_name":"QA","label":"QA","period_start":"2026-10-01","period_end":"2026-10-01"}', '[{"worker_id":"__qa_s","metrics":{"risk":2},"source_row":1}]');
 second_id:=public.publish_individual_sheet('{"source":"sauce","filename":"QA2.xlsx","sheet_name":"QA","label":"QA2","period_start":"2026-10-02","period_end":"2026-10-02"}', '[{"worker_id":"__qa_s","metrics":{"risk":3},"source_row":1}]');
 if exists(select 1 from public.sheet_uploads where id=first_id) or exists(select 1 from public.sheet_metrics where upload_id=first_id) then raise exception 'old source retained';end if;
 if (select count(*) from public.sheet_uploads where source='sauce')<>1 then raise exception 'source not replaced';end if;
 begin
  perform public.publish_individual_sheet('{"source":"sauce","filename":"QA.xlsx","sheet_name":"QA","label":"QA","period_start":"2026-10-03","period_end":"2026-10-03"}', '[{"worker_id":"__nonexistent_worker","metrics":{"risk":4},"source_row":1}]');
  raise exception 'invalid upload succeeded';
 exception when foreign_key_violation then null;end;
 if (select upload_id from public.current_sheet_uploads where source='sauce')<>second_id then raise exception 'failure lost current data';end if;
 -- Only replace synthetic slot pointers in this rollback-only test.
 delete from public.goal_sheet_slots where source='category';
 previous_id:=public.publish_individual_sheet('{"source":"category","goal_slot":"previous","filename":"QA.xlsx","sheet_name":"QA","label":"Anterior QA","period_start":"2026-01-01","period_end":"2026-02-28"}', '[{"worker_id":"__qa_s","metrics":{"uf":100},"source_row":1}]');
 current_id:=public.publish_individual_sheet('{"source":"category","goal_slot":"current","filename":"QA.xlsx","sheet_name":"QA","label":"Vigente QA","period_start":"2026-03-01","period_end":"2026-04-30"}', '[{"worker_id":"__qa_s","metrics":{"uf":200},"source_row":1}]');
 if (select count(*) from public.active_worker_metrics where worker_id='__qa_s' and source='category')<>2 then raise exception 'goal slots missing';end if;
 if not exists(select 1 from public.sheet_uploads where id=previous_id) then raise exception 'previous goal deleted';end if;
 if (select upload_id from public.current_sheet_uploads where source='category' and goal_slot='current')<>current_id then raise exception 'compatibility pointer';end if;
 -- Publication dates can overlap: the explicit slot remains authoritative.
 revised_previous_id:=public.publish_individual_sheet('{"source":"category","goal_slot":"previous","filename":"QA.xlsx","sheet_name":"QA","label":"Revised previous","period_start":"2026-03-01","period_end":"2026-04-01"}', '[{"worker_id":"__qa_s","metrics":{"uf":9},"source_row":1}]');
 if (select upload_id from public.goal_sheet_slots where source='category' and slot='previous')<>revised_previous_id then raise exception 'legacy previous pointer stale';end if;
 if (select upload_id from public.goal_sheet_slots where source='category' and slot='current')<>current_id then raise exception 'previous replaced legacy current';end if;
 if (select count(*) from public.sheet_uploads where source='senior')<>before_count then raise exception 'unrelated source changed';end if;
end$$;

reset role;
update public.profiles set role='seller' where id='00000000-0000-4000-8000-000000000991';
set local role authenticated;
do $$ declare r jsonb; begin
 if (select count(*) from public.commercial_workers)<>1 then raise exception 'seller scope';end if;
 if exists(select 1 from public.active_worker_metrics where worker_id<>'__qa_s') then raise exception 'seller metrics scope';end if;
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
select 'PASS: atomic replacement, rollback, goal slots, team isolation, opaque ranking and disabled sessions' as result;
rollback;
