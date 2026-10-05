begin;

-- Keep editor write access unchanged while avoiding an extra permissive SELECT
-- policy evaluation on every news section read.
drop policy if exists news_sections_edit on public.news_sections;
create policy news_sections_edit_insert on public.news_sections
 for insert to authenticated
 with check ((select private.can_edit_news()));
create policy news_sections_edit_update on public.news_sections
 for update to authenticated
 using ((select private.can_edit_news()))
 with check ((select private.can_edit_news()));
create policy news_sections_edit_delete on public.news_sections
 for delete to authenticated
 using ((select private.can_edit_news()));

-- The ALL policy already grants administrators identical SELECT access.
drop policy if exists registration_controls_admin_read on public.registration_controls;

insert into supabase_migrations.schema_migrations(version,name)
values('20261005160000','consolidate_duplicate_policies')
on conflict(version) do nothing;

commit;
