-- Read-only verification: never execute TRUNCATE, not even as a denial test.
begin read only;
do $$begin
 if has_table_privilege('anon','public.news_sections','TRUNCATE')
 or has_table_privilege('authenticated','public.news_sections','TRUNCATE')
 then raise exception 'Client TRUNCATE grant remains';end if;
 if not (select relrowsecurity from pg_class where oid='public.news_sections'::regclass)
 then raise exception 'News RLS disabled';end if;
 if exists(select 1 from (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'))p(privilege)
 where not has_table_privilege('authenticated','public.news_sections',p.privilege))
 then raise exception 'Normal authenticated news grants missing';end if;
 if has_table_privilege('anon','public.news_sections','SELECT')
 then raise exception 'Anonymous news access granted';end if;
end $$;

select set_config('request.jwt.claims',(select jsonb_build_object('sub',id,'role','authenticated')::text
 from public.profiles where role='admin' and active limit 1),true);
set local role authenticated;
do $$begin
 if not public.session_access_allowed() or not private.can_edit_news()
 then raise exception 'Administrator news editing blocked';end if;
 perform 1 from public.news_sections limit 1;
end $$;
reset role;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',id,'role','authenticated')::text
 from public.profiles where role='audiovisual' and active limit 1),true);
set local role authenticated;
do $$begin
 if not public.session_access_allowed() or not private.can_edit_news()
 then raise exception 'Audiovisual news editing blocked';end if;
 if private.can_access_commercial() then raise exception 'Audiovisual commercial access widened';end if;
 perform 1 from public.news_sections limit 1;
end $$;
reset role;
select jsonb_build_object('result','PASS: client TRUNCATE denied; normal CRUD grants, RLS, Admin/Audiovisual news access retained',
 'anon_truncate',has_table_privilege('anon','public.news_sections','TRUNCATE'),
 'authenticated_truncate',has_table_privilege('authenticated','public.news_sections','TRUNCATE'),
 'rls',(select relrowsecurity from pg_class where oid='public.news_sections'::regclass))as verification;
rollback;
