begin;
-- Numeric aggregate requirements only; no arbitrary rule payloads or customer fields.
create or replace function private.valid_goal_rules(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare rule jsonb;k text;n numeric;
begin
 if jsonb_typeof(value) is distinct from 'array' or jsonb_array_length(value)>30 then return false;end if;
 for rule in select jsonb_array_elements(value) loop
  if jsonb_typeof(rule)<>'object' then return false;end if;
  if exists(select 1 from jsonb_object_keys(rule) key where key not in ('label','uf','smad','prize','rest','ssff')) then return false;end if;
  if jsonb_typeof(rule->'label') is distinct from 'string' or length(rule->>'label') not between 1 and 180 then return false;end if;
  foreach k in array array['uf','smad','prize','rest','ssff'] loop
   if k in ('rest','ssff') and not (rule?k) then continue;end if;
   if jsonb_typeof(rule->k) is distinct from 'number' then return false;end if;
   n:=(rule->>k)::numeric;
   if n<0 or n>1000000000000 or (k in ('smad','rest','ssff') and mod(n,1)<>0) then return false;end if;
  end loop;
 end loop;
 return true;
end $$;
revoke all on function private.valid_goal_rules(jsonb) from public,anon;
grant execute on function private.valid_goal_rules(jsonb) to authenticated,service_role;
insert into supabase_migrations.schema_migrations(version,name) values('20261009020022','senior_next_tier_requirements');
commit;
