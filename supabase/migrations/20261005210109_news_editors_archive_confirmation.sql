begin;

-- Returning the archived article is necessary to confirm an UPDATE succeeded.
-- Readers still see only active articles; existing restrictive staff checks stay.
alter policy news_articles_authenticated_read on public.news_articles
  using (active or (select private.can_edit_news()));

insert into supabase_migrations.schema_migrations(version, name)
values ('20261005210109', 'news_editors_archive_confirmation')
on conflict (version) do nothing;

commit;
