-- Run after the conditions migration. Every synthetic account is rolled back.
begin;
set constraints auth.on_auth_user_created immediate;
insert into public.commercial_workers(id,rut,name,role,active,status)
 values('__conditions_qa','990001117','Condiciones QA','seller',true,'active');
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
 values('00000000-0000-4000-8000-000000000781','990001117@pdr.internal','{"rut":"990001117","name":"Condiciones QA"}',
 '{"role":"seller","conditions_version":"2026-10-08-uso-v1"}');
do $$begin
 if not exists(select 1 from private.condition_acceptances where user_id='00000000-0000-4000-8000-000000000781' and version='2026-10-08-uso-v1' and accepted_at is not null) then raise exception 'Missing acknowledgement audit';end if;
 if has_table_privilege('anon','private.condition_acceptances','SELECT') or has_table_privilege('authenticated','private.condition_acceptances','INSERT')
 or has_table_privilege('authenticated','private.condition_versions','UPDATE') then raise exception 'Private audit exposed';end if;
 if has_function_privilege('authenticated','public.ranking_leaderboard()','EXECUTE') or has_function_privilege('anon','public.ranking_leaderboard()','EXECUTE') then raise exception 'Legacy ranking bypass exposed';end if;
 if has_table_privilege('authenticated','public.sales','INSERT') or has_table_privilege('authenticated','public.sales','SELECT')
 or has_table_privilege('authenticated','public.delinquency_records','SELECT') then raise exception 'Legacy customer table exposed';end if;
 if private.valid_worker_metrics('{"customer_name":"QA"}') or private.valid_worker_metrics('{"operation":"QA"}') then raise exception 'Customer metrics accepted';end if;
 if not private.valid_worker_metrics('{"debtSales":0,"uf":1}') then raise exception 'Valid aggregates rejected';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000781","role":"authenticated"}',true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin insert into private.condition_acceptances(user_id,version) values(auth.uid(),'2026-10-08-uso-v1');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'User forged acknowledgement';end if;
end $$;
reset role;
select 'PASS: versioned acknowledgement, private audit, aggregate-only fields, legacy RPC/customer table access revoked' as result;
rollback;
