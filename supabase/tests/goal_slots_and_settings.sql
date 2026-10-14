begin;
insert into public.commercial_workers(id,rut,name,role,active,status) values('__slot_qa','990001117','Worker QA','seller',true,'active');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where role='admin' and active limit 1),'role','authenticated')::text,true);
do $$declare current_id uuid;previous_id uuid;replaced_id uuid;denied boolean:=false;begin
 current_id:=public.publish_individual_sheet('{"source":"senior","filename":"QA.xlsx","sheet_name":"CARGA Senior","label":"Q4 QA","period_start":"2026-10-14","period_end":"2026-10-14","goal_slot":"current"}','[{"worker_id":"__slot_qa","source_row":4,"metrics":{"uf":10}}]');
 previous_id:=public.publish_individual_sheet('{"source":"senior","filename":"QA.xlsx","sheet_name":"CARGA Senior","label":"Q3 QA","period_start":"2026-10-13","period_end":"2026-10-13","goal_slot":"previous"}','[{"worker_id":"__slot_qa","source_row":4,"metrics":{"uf":20}}]');
 replaced_id:=public.publish_individual_sheet('{"source":"senior","filename":"QA.xlsx","sheet_name":"CARGA Senior","label":"Q3 revised QA","period_start":"2026-10-13","period_end":"2026-10-13","goal_slot":"previous"}','[{"worker_id":"__slot_qa","source_row":4,"metrics":{"uf":30}}]');
 if (select upload_id from public.current_sheet_uploads where source='senior' and goal_slot='current')<>current_id then raise exception 'Previous overwrote current';end if;
 if (select upload_id from public.current_sheet_uploads where source='senior' and goal_slot='previous')<>replaced_id then raise exception 'Previous replacement failed';end if;
 if (select metrics->>'uf' from public.current_worker_metrics where source='senior' and worker_id='__slot_qa')<>'10' then raise exception 'Current view leaked previous';end if;
 if not exists(select 1 from public.sheet_metrics where upload_id=previous_id) then raise exception 'Audit history lost';end if;
 begin perform public.publish_individual_sheet('{"source":"senior","filename":"QA.xlsx","sheet_name":"CARGA Senior","label":"QA","period_start":"2026-10-14","period_end":"2026-10-14"}','[{"worker_id":"__slot_qa","source_row":4,"metrics":{"customer_name":"QA"}}]');exception when others then denied:=true;end;
 if not denied then raise exception 'Customer payload allowed';end if;
 if has_table_privilege('anon','public.platform_settings','SELECT') or has_function_privilege('anon','public.publish_sheet_bundle(jsonb)','EXECUTE') then raise exception 'Anonymous access widened';end if;
end $$;
-- Simulate a logged-in non-admin. No account or credentials are created.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin insert into public.platform_settings(id,label) values('senior_current','Forged');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Non-admin edited campaign title';end if;
end $$;
reset role;
select 'PASS: independent current/previous replacements, history, minimal metrics and protected labels' as test;
rollback;
