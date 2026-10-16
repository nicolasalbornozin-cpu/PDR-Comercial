-- Synthetic identities and uploads are always rolled back.
begin;
set constraints auth.on_auth_user_created immediate;
insert into public.commercial_workers(id,rut,name,role,active,status,coordinator_id,manager_id,team_name) values
 ('__qa16_m','990016994','QA Manager','sales_manager',true,'active',null,null,null),
 ('__qa16_c','990016993','QA Coordinator','coordinator',true,'active',null,'__qa16_m','QA ZENIT'),
 ('__qa16_other_c','990016992','QA Other Coordinator','coordinator',true,'active',null,null,'QA OTHER'),
 ('__qa16_s','990016991','QA Seller','seller',true,'active','__qa16_c','__qa16_m',null),
 ('__qa16_o','990016990','QA Other Seller','seller',true,'active','__qa16_other_c',null,null),
 ('__qa16_course','990016989','QA Course','seller',false,'course','__qa16_c','__qa16_m',null),
 ('__qa16_leave','990016988','QA Leave','seller',false,'medical_leave','__qa16_c','__qa16_m',null);
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)values
 ('00000000-0000-4000-8000-000000000916','990016991@pdr.internal','{"rut":"990016991","name":"QA ADMIN"}','{"role":"admin"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000916","role":"authenticated"}',true);
set local role authenticated;
select public.publish_individual_sheet(
 '{"source":"ranking_annual","filename":"QA.xlsx","sheet_name":"QA","label":"QA","period_start":"2026-01-01","period_end":"2026-12-31"}',
 '[{"worker_id":"__qa16_s","source_row":1,"metrics":{"totalUf":120,"emittedUf":100}},
 {"worker_id":"__qa16_o","source_row":2,"metrics":{"totalUf":80,"emittedUf":60}},
 {"worker_id":"__qa16_course","source_row":3,"metrics":{"totalUf":20,"emittedUf":10}},
 {"worker_id":"__qa16_leave","source_row":4,"metrics":{"totalUf":999,"emittedUf":999}},
 {"worker_id":"__qa16_c","source_row":5,"metrics":{"homeAnnualGrossUf":400,"homeAnnualEmittedUf":300}},
 {"worker_id":"__qa16_m","source_row":6,"metrics":{"homeAnnualGrossUf":500,"homeAnnualEmittedUf":450}}]');
select public.publish_individual_sheet(
 '{"source":"ranking_monthly","filename":"QA.xlsx","sheet_name":"QA","label":"QA","period_start":"2026-10-01","period_end":"2026-10-31"}',
 '[{"worker_id":"__qa16_s","source_row":1,"metrics":{"totalUf":25,"emittedUf":10}}]');
do $$declare r jsonb;begin
 r:=public.sales_scope_totals('__qa16_m');
 if r->'scope'->>'annualGross'<>'500' or r->'scope'->>'annualEmitted'<>'450' or r->'scope'->>'monthlyGross'<>'25' then raise exception 'Home table override/monthly separation';end if;
 if r->'groups'->'__qa16_c'->>'annualGross'<>'400' then raise exception 'coordinator Home override';end if;
 r:=public.individual_sheet_ranking_v2('annual','teams','__qa16_m');
 if jsonb_array_length(r)<>1 or r->0->>'teamName'<>'QA ZENIT' or (r->0->>'value')::numeric<>140 then raise exception 'team totals/scope';end if;
 if exists(select 1 from jsonb_array_elements(r)e where e->>'userId' !~ '^[0-9a-f-]{36}$' or e?'rut' or e?'coordinator_id') then raise exception 'identity leak';end if;
 r:=public.individual_sheet_ranking_v2('annual','executives','__qa16_m');
 if jsonb_array_length(r)<>1 or (r->0->>'value')::numeric<>120 then raise exception 'manager executive scope';end if;
 perform public.individual_sheet_ranking('annual','__qa16_m');
 if has_function_privilege('anon','public.individual_sheet_ranking_v2(text,text,text)','execute') then raise exception 'anonymous access';end if;
end $$;
reset role;
update public.profiles set role='coordinator',rut='990016993' where id='00000000-0000-4000-8000-000000000916';
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.individual_sheet_ranking_v2('annual','executives',null);
 if jsonb_array_length(r)<>1 or (r->0->>'value')::numeric<>120 then raise exception 'coordinator own sellers only';end if;
 begin perform public.individual_sheet_ranking_v2('annual','executives','__qa16_other_c');raise exception 'target bypass';exception when others then if SQLERRM='target bypass' then raise;end if;end;
 begin perform public.publish_individual_sheet('{}','[]');raise exception 'write bypass';exception when others then if SQLERRM='write bypass' then raise;end if;end;
end $$;
reset role;
update public.profiles set role='seller',rut='990016991' where id='00000000-0000-4000-8000-000000000916';
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.individual_sheet_ranking_v2('annual','teams',null);
 if not exists(select 1 from jsonb_array_elements(r)e where e->>'teamName'='QA ZENIT' and (e->>'isCurrentUser')::boolean) then raise exception 'seller own team marker';end if;
 if (public.sales_scope_totals(null)->'scope'->>'annualGross')::numeric<>120 then raise exception 'seller unchanged';end if;
 begin perform public.individual_sheet_ranking_v2('annual','invalid',null);raise exception 'invalid mode accepted';exception when others then if SQLERRM='invalid mode accepted' then raise;end if;end;
end $$;
reset role;
update public.commercial_workers set active=false,status='medical_leave' where id='__qa16_s';
set local role authenticated;
do $$begin
 begin perform public.individual_sheet_ranking_v2('annual','teams',null);raise exception 'blocked access bypass';exception when others then if SQLERRM='blocked access bypass' then raise;end if;end;
end $$;
reset role;
select 'PASS: Home annual overrides, net ranking, monthly unchanged, modes, scope isolation, unique opaque IDs, access restrictions and old endpoint' as result;
rollback;
