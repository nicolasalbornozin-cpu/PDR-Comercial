begin;

-- Protect direct INSERT/UPDATE as well as the upload RPC. No arbitrary JSON,
-- operation IDs, customer columns, arrays or nested objects can enter metrics.
create function private.valid_worker_metrics(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item record;
begin
 if jsonb_typeof(value) is distinct from 'object' or octet_length(value::text)>10000 then return false; end if;
 for item in select key,val from jsonb_each(value) e(key,val) loop
  if item.key in ('level','remaining','potentialLevel','emittedLevel','employmentStatus','lastSaleDate','daysWithoutSaleText') then
   if jsonb_typeof(item.val)<>'string' or length(item.val#>>'{}')>500 then return false; end if;
   if item.key='lastSaleDate' and (item.val#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  elsif item.key in ('smad','smadRemaining','uf','prize','rest','ssff','tenureMonths','cancellationUf','emittedSmad',
   'businesses','productivity','headcount','teamProduction','daysWithoutSale','debtSales','debtUf','debtInstallments',
   'debtUf08','debtSales08','risk','position','emittedUf','notEmittedUf','totalUf') then
   if jsonb_typeof(item.val)<>'number' or abs((item.val#>>'{}')::numeric)>1000000000000 then return false; end if;
   if item.key in ('smad','smadRemaining','rest','ssff','emittedSmad','businesses','headcount','daysWithoutSale','debtSales','debtInstallments','debtSales08','position')
    and ((item.val#>>'{}')::numeric<0 or mod((item.val#>>'{}')::numeric,1)<>0) then return false; end if;
   if item.key='risk' and ((item.val#>>'{}')::numeric<0 or (item.val#>>'{}')::numeric>100) then return false; end if;
  else return false;
  end if;
 end loop;
 return true;
end $$;
revoke all on function private.valid_worker_metrics(jsonb) from public,anon;
grant execute on function private.valid_worker_metrics(jsonb) to authenticated,service_role;
alter table public.sheet_metrics add constraint sheet_metrics_worker_fields_only check(private.valid_worker_metrics(metrics));

create function private.valid_goal_rules(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare rule jsonb;
begin
 if jsonb_typeof(value) is distinct from 'array' or jsonb_array_length(value)>30 then return false; end if;
 for rule in select jsonb_array_elements(value) loop
  if jsonb_typeof(rule)<>'object' then return false; end if;
  if exists(select 1 from jsonb_object_keys(rule) k where k not in ('label','uf','smad','prize')) then return false; end if;
  if jsonb_typeof(rule->'label') is distinct from 'string' or length(rule->>'label')>180 then return false; end if;
  if jsonb_typeof(rule->'uf') is distinct from 'number' or jsonb_typeof(rule->'smad') is distinct from 'number' or jsonb_typeof(rule->'prize') is distinct from 'number' then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function private.valid_goal_rules(jsonb) from public,anon;
grant execute on function private.valid_goal_rules(jsonb) to authenticated,service_role;
alter table public.sheet_uploads add constraint sheet_uploads_goal_fields_only check(private.valid_goal_rules(rules));

-- News is for enabled staff, not any old or disabled authenticated account.
create function private.can_read_news() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p left join public.commercial_workers w
 on w.rut=lower(regexp_replace(p.rut,'[^0-9kK]','','g'))
 where p.id=(select auth.uid()) and p.active and p.employment_status='active'
 and (p.role in ('admin','audiovisual') or (p.role in ('seller','coordinator','sales_manager') and w.active and w.status='active')));
$$;
revoke all on function private.can_read_news() from public,anon;
grant execute on function private.can_read_news() to authenticated;
create policy news_active_staff_only on public.news_articles as restrictive for select to authenticated using((select private.can_read_news()));
create policy gallery_active_staff_only on public.gallery_images as restrictive for select to authenticated using((select private.can_read_news()));
create policy sections_active_staff_only on public.news_sections as restrictive for select to authenticated using((select private.can_read_news()));
create policy news_media_staff_read on storage.objects for select to authenticated
 using(bucket_id='news-media' and (select private.can_read_news()));

-- Files keep their object paths; the app now obtains short-lived signed URLs.
update storage.buckets set public=false where id='news-media';

-- Private operator staging is not an application endpoint. Preserve its
-- worker-only audit history without exposing an administrative import table.
alter table public.operator_import_20261002 set schema private;
revoke all on private.operator_import_20261002 from public,anon,authenticated;

insert into supabase_migrations.schema_migrations(version,name)
values('20261005131718','harden_worker_metrics_and_private_news')
on conflict(version) do nothing;

commit;
