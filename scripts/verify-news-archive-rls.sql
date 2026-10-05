-- Live verification uses a transaction and rolls back every data change.
begin;
select set_config('news_test.editor', (
  select id::text from public.profiles
  where role = 'admin' and active and employment_status = 'active' limit 1
), true);
select set_config('news_test.reader', (
  select p.id::text from public.profiles p
  join public.commercial_workers w on w.rut = lower(regexp_replace(p.rut, '[^0-9kK]', '', 'g'))
  where p.role = 'seller' and p.active and p.employment_status = 'active'
    and w.active and w.status = 'active' limit 1
), true);
select set_config('news_test.article', (select id::text from public.news_articles where active order by id limit 1), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('news_test.editor'), true);
do $$ declare archived boolean; begin
  update public.news_articles set active = false
    where id = current_setting('news_test.article')::bigint returning active into archived;
  if archived is distinct from false then raise exception 'Editor did not archive the article'; end if;
  if not exists(select 1 from public.news_articles where id = current_setting('news_test.article')::bigint) then
    raise exception 'Editor cannot confirm archive';
  end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('news_test.reader'), true);
do $$ declare changed bigint; begin
  if exists(select 1 from public.news_articles where id = current_setting('news_test.article')::bigint) then
    raise exception 'Reader can see archived news';
  end if;
  update public.news_articles set active = true where id = current_setting('news_test.article')::bigint;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Reader could change an archived article'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('news_test.editor'), true);
do $$ begin
  if not exists(select 1 from public.news_articles where id = current_setting('news_test.article')::bigint and not active) then
    raise exception 'Denied reader write modified the archive';
  end if;
end $$;
select 'PASS: editor archives and confirms; reader cannot view or modify archive; all data changes rolled back' as result;
rollback;
