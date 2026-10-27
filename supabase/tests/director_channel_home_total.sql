-- Temporary worker-only figures; no real account or role is changed.
begin;
set constraints auth.on_auth_user_created immediate;
insert into public.commercial_workers(id,rut,name,role,active,status,coordinator_id,manager_id)values
 ('__qa27_m','990027994','QA Manager','sales_manager',true,'active',null,null),
 ('__qa27_c','990027993','QA Coordinator','coordinator',true,'active',null,'__qa27_m'),
 ('__qa27_s','990027991','QA Seller','seller',true,'active','__qa27_c','__qa27_m'),
 ('__qa27_d','990027990','QA Director','sales_director',true,'active',null,null),
 ('__qa27_b','990027989','QA Commercial Manager','commercial_manager',true,'active',null,null);
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)values
 ('00000000-0000-4000-8000-000000000927','990027991@pdr.internal','{"rut":"990027991","name":"QA ADMIN"}','{"role":"admin"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000927","role":"authenticated"}',true);
set local role authenticated;
select public.publish_individual_sheet(
 '{"source":"ranking_annual","filename":"QA.xlsx","sheet_name":"QA","label":"QA","period_start":"2026-01-01","period_end":"2026-12-31"}',
 '[{"worker_id":"__qa27_s","source_row":1,"metrics":{"totalUf":120,"emittedUf":100}},
 {"worker_id":"__qa27_c","source_row":2,"metrics":{"homeAnnualGrossUf":400,"homeAnnualEmittedUf":300}},
 {"worker_id":"__qa27_m","source_row":3,"metrics":{"homeAnnualGrossUf":500,"homeAnnualEmittedUf":450}},
 {"worker_id":"__qa27_d","source_row":4,"metrics":{"homeAnnualGrossUf":1000,"homeAnnualEmittedUf":800}}]');
select public.publish_individual_sheet(
 '{"source":"ranking_monthly","filename":"QA.xlsx","sheet_name":"QA","label":"QA","period_start":"2026-10-01","period_end":"2026-10-31"}',
 '[{"worker_id":"__qa27_s","source_row":1,"metrics":{"totalUf":25,"emittedUf":10}}]');
do $$declare r jsonb;d jsonb;b jsonb;begin
 r:=public.sales_scope_totals(null)->'scope';
 if (r->>'annualGross')::numeric<>1000 or (r->>'annualEmitted')::numeric<>800 then raise exception 'Explicit channel total was ignored or double counted';end if;
 d:=public.sales_scope_totals('__qa27_d');b:=public.sales_scope_totals('__qa27_b');
 if d is distinct from b or d->'scope' is distinct from r then raise exception 'Director and Commercial Manager differ';end if;
 if (r->>'monthlyGross')::numeric<>25 then raise exception 'Monthly scope changed';end if;
 if (public.sales_scope_totals('__qa27_m')->'scope'->>'annualGross')::numeric<>500 then raise exception 'Manager must retain own table row';end if;
 if (public.sales_scope_totals('__qa27_c')->'scope'->>'annualGross')::numeric<>400 then raise exception 'Coordinator must retain own table row';end if;
end $$;
reset role;
update public.profiles set role='seller',rut='990027991' where id='00000000-0000-4000-8000-000000000927';
set local role authenticated;
do $$begin
 if (public.sales_scope_totals(null)->'scope'->>'annualGross')::numeric<>120 then raise exception 'Seller unexpectedly sees channel total';end if;
 begin perform public.sales_scope_totals('__qa27_d');raise exception 'Foreign scope allowed';exception when others then if SQLERRM='Foreign scope allowed' then raise;end if;end;
end $$;
reset role;
select 'PASS: explicit director row, same channel view for both leaders/Admin, separate unit/coordinator totals, unchanged monthly and seller permissions' as result;
rollback;
