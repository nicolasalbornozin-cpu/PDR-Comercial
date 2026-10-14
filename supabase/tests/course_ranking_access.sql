begin;
set constraints auth.on_auth_user_created immediate;
insert into public.commercial_workers(id,rut,name,role,active,status,coordinator_id,manager_id) values
 ('__course_coord','990001010','Coordinador QA','coordinator',true,'active',null,'__course_manager'),
 ('__course_manager','990001001','Jefe QA','sales_manager',true,'active',null,null),
 ('__course_worker','990001117','Worker Curso QA','seller',false,'course','__course_coord','__course_manager');
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000783','990001117@pdr.internal','{"rut":"990001117","name":"Worker Curso QA"}','{"role":"seller"}');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where role='admin' and active limit 1),'role','authenticated')::text,true);
do $$declare u uuid;ranking jsonb;totals jsonb;begin
 u:=public.publish_individual_sheet('{"source":"ranking_monthly","filename":"QA.xlsx","sheet_name":"Ranking mensual","label":"QA","period_start":"2026-10-14","period_end":"2026-10-14"}','[{"worker_id":"__course_worker","source_row":3,"metrics":{"totalUf":151,"emittedUf":100}}]');
 ranking:=public.individual_sheet_ranking('monthly','__course_coord');
 if not exists(select 1 from jsonb_array_elements(ranking)r where r->>'userId'='__course_coord' and (r->>'value')::numeric=151) then raise exception 'Course sale missing from coordinator ranking';end if;
 totals:=public.sales_scope_totals('__course_coord');
 if (totals->'scope'->>'monthlyGross')::numeric<>151 then raise exception 'Course sale missing from scoped totals';end if;
 if private.registration_identity('990001117') is not null then raise exception 'Course registration permitted';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000783","role":"authenticated"}',true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 if public.session_access_allowed() then raise exception 'Course session permitted';end if;
 if exists(select 1 from public.current_worker_metrics) then raise exception 'Course read metrics';end if;
 begin perform public.sales_scope_totals();exception when others then denied:=true;end;
 if not denied then raise exception 'Course obtained totals';end if;
end $$;
reset role;
select 'PASS: CURSO sale contributes to scoped ranking and totals; registration, existing session and data access remain blocked' as test;
rollback;
