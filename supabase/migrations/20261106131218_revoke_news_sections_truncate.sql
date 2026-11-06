begin;

-- TRUNCATE bypasses RLS. Client roles need only the existing row operations;
-- do not change news policies, authenticated CRUD grants or stored content.
do $$
declare before_dml jsonb;after_dml jsonb;before_policies jsonb;after_policies jsonb;
begin
 select jsonb_object_agg(r.role||':'||p.privilege,has_table_privilege(r.role,'public.news_sections',p.privilege))
 into before_dml from (values('anon'),('authenticated'),('service_role'))r(role)
 cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'))p(privilege);
 select jsonb_agg(to_jsonb(p) order by policyname) into before_policies
 from pg_policies p where schemaname='public' and tablename='news_sections';

 revoke truncate on table public.news_sections from public,anon,authenticated;

 if has_table_privilege('anon','public.news_sections','TRUNCATE')
 or has_table_privilege('authenticated','public.news_sections','TRUNCATE')
 then raise exception 'Client TRUNCATE privilege remains; review inherited grants';end if;
 if not (select relrowsecurity from pg_class where oid='public.news_sections'::regclass)
 then raise exception 'News sections must remain protected by RLS';end if;

 select jsonb_object_agg(r.role||':'||p.privilege,has_table_privilege(r.role,'public.news_sections',p.privilege))
 into after_dml from (values('anon'),('authenticated'),('service_role'))r(role)
 cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'))p(privilege);
 select jsonb_agg(to_jsonb(p) order by policyname) into after_policies
 from pg_policies p where schemaname='public' and tablename='news_sections';
 if before_dml is distinct from after_dml or before_policies is distinct from after_policies
 then raise exception 'Normal news permissions or policies changed; rolled back';end if;
end $$;

commit;
