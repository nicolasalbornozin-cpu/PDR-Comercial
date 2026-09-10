-- Run as postgres in SQL Editor. All fixtures and profile changes roll back.
begin;
create temporary table access_results(test text,passed boolean);
grant select,insert on access_results to authenticated,anon;
create function pg_temp.check_access(ok boolean,label text) returns void language plpgsql as $$
begin
 if not coalesce(ok,false) then raise exception 'FAILED: %',label; end if;
 insert into access_results values(label,true);
end $$;
select pg_temp.check_access((select count(*)=4 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('commercial_workers','sheet_uploads','sheet_metrics','current_sheet_uploads') and c.relrowsecurity),'Four tables protected by RLS');
select pg_temp.check_access(not has_table_privilege('authenticated','public.commercial_workers','TRUNCATE'),'No authenticated TRUNCATE');
select pg_temp.check_access(not has_table_privilege('anon','public.commercial_workers','SELECT'),'No anonymous roster access');
select pg_temp.check_access(not has_function_privilege('anon','public.individual_sheet_ranking(text,text)','EXECUTE'),'No anonymous ranking');
insert into public.commercial_workers(id,rut,name,role,active,status,coordinator_id,manager_id) values
 ('qa-seller','qa1','QA Seller','seller',true,'active','qa-coord','qa-chief'),
 ('qa-peer','qa2','QA Peer','seller',true,'active','qa-coord','qa-chief'),
 ('qa-other','qa3','QA Other','seller',true,'active','qa-other-coord','qa-other-chief'),
 ('qa-coord','qa4','QA Coordinator','coordinator',true,'active',null,'qa-chief'),
 ('qa-chief','qa5','QA Chief','sales_manager',true,'active',null,null);
-- Numeric RUT keys for auth normalization. These are disposable test rows only.
update public.commercial_workers set rut=case id when 'qa-seller' then '99999001' when 'qa-peer' then '99999002' when 'qa-other' then '99999003' when 'qa-coord' then '99999004' else '99999005' end where id like 'qa-%';
select set_config('request.jwt.claim.sub','574c9a51-23b8-4874-bd5e-e94545205018',true);
set local role authenticated;
select pg_temp.check_access(private.is_admin(),'Existing administrator recognized');
select pg_temp.check_access((select count(*)=5 from public.commercial_workers where id like 'qa-%'),'Administrator sees all test workers');
select pg_temp.check_access((select count(*)=1 from public.search_commercial_workers('QA Seller','seller')),'Administrator name search');
select public.publish_individual_sheet('{"source":"ranking_annual","filename":"QA","sheet_name":"QA","label":"QA","period_start":"2026-01-01","period_end":"2026-12-31"}', '[{"worker_id":"qa-seller","metrics":{"emittedUf":120},"source_row":1},{"worker_id":"qa-peer","metrics":{"emittedUf":80},"source_row":2},{"worker_id":"qa-other","metrics":{"emittedUf":40},"source_row":3}]');
select pg_temp.check_access((select count(*)=3 from public.current_worker_metrics where worker_id like 'qa-%'),'Atomic publish visible');
reset role;
update public.profiles set role='seller',rut='99999001' where id='574c9a51-23b8-4874-bd5e-e94545205018';
set local role authenticated;
select pg_temp.check_access((select count(*)=1 from public.commercial_workers),'Seller sees only self');
select pg_temp.check_access((select count(*)=1 from public.current_worker_metrics),'Seller metrics scope');
select pg_temp.check_access((select count(*)=0 from public.search_commercial_workers('QA','seller')),'Seller cannot use admin search');
select pg_temp.check_access((select count(*)=3 from jsonb_array_elements(public.individual_sheet_ranking('annual',null)) e where e->>'userId' like 'qa-%'),'Seller sees restricted general ranking');
select pg_temp.check_access(not exists(select 1 from jsonb_array_elements(public.individual_sheet_ranking('annual',null)) e where e ? 'rut' or e ? 'metrics' or e ? 'debtUf'),'Ranking omits private details');
with changed as(update public.commercial_workers set name='Forbidden' where id='qa-seller' returning id) select pg_temp.check_access((select count(*)=0 from changed),'Seller cannot update roster');
with changed as(delete from public.sheet_metrics where worker_id='qa-seller' returning worker_id) select pg_temp.check_access((select count(*)=0 from changed),'Seller cannot delete metrics');
do $$begin
 begin
  insert into public.commercial_workers(id,name,role,status) values('qa-injected','QA','seller','active');
  raise exception 'FAILED: seller inserted roster';
 exception when insufficient_privilege then insert into access_results values('Seller insert denied',true); end;
 begin
  perform public.publish_individual_sheet('{}','[]');
  raise exception 'FAILED: seller published';
 exception when raise_exception then if SQLERRM<>'No autorizado' then raise; end if; insert into access_results values('Seller publication denied',true); end;
 begin
  perform public.individual_sheet_ranking('annual','qa-other');
  raise exception 'FAILED: seller impersonated';
 exception when raise_exception then if SQLERRM<>'No autorizado' then raise; end if; insert into access_results values('Seller impersonation denied',true); end;
end $$;
reset role;
update public.profiles set role='coordinator',rut='99999004' where id='574c9a51-23b8-4874-bd5e-e94545205018';
set local role authenticated;
select pg_temp.check_access((select count(*)=3 from public.commercial_workers),'Coordinator self plus own sellers');
select pg_temp.check_access((select count(*)=2 from public.current_worker_metrics),'Coordinator own team metrics');
reset role;
update public.profiles set role='sales_manager',rut='99999005' where id='574c9a51-23b8-4874-bd5e-e94545205018';
set local role authenticated;
select pg_temp.check_access((select count(*)=4 from public.commercial_workers),'Chief own scope only');
select pg_temp.check_access((select count(*)=2 from public.current_worker_metrics),'Chief metrics scope');
select pg_temp.check_access(jsonb_array_length(public.individual_sheet_ranking('annual',null))=1,'Chief own coordinators ranking');
reset role;
update public.commercial_workers set active=false,status='vacation' where id='qa-chief';
set local role authenticated;
select pg_temp.check_access((select count(*)=0 from public.commercial_workers),'Inactive workforce denied');
select pg_temp.check_access((select count(*)=0 from public.current_worker_metrics),'Inactive metrics denied');
reset role;
select test,passed from access_results order by test;
rollback;
