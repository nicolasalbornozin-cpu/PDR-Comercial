begin;
-- Split admin writes from SELECT: the read policies already include active admins.
-- Same authorization predicates, without duplicate permissive SELECT policies.
drop policy workers_admin on public.commercial_workers;
create policy workers_admin_insert on public.commercial_workers for insert to authenticated with check((select private.is_admin()));
create policy workers_admin_update on public.commercial_workers for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy workers_admin_delete on public.commercial_workers for delete to authenticated using((select private.is_admin()));
drop policy uploads_admin on public.sheet_uploads;
create policy uploads_admin_insert on public.sheet_uploads for insert to authenticated with check((select private.is_admin()));
create policy uploads_admin_update on public.sheet_uploads for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy uploads_admin_delete on public.sheet_uploads for delete to authenticated using((select private.is_admin()));
drop policy metrics_admin on public.sheet_metrics;
create policy metrics_admin_insert on public.sheet_metrics for insert to authenticated with check((select private.is_admin()));
create policy metrics_admin_update on public.sheet_metrics for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy metrics_admin_delete on public.sheet_metrics for delete to authenticated using((select private.is_admin()));
drop policy current_admin on public.current_sheet_uploads;
create policy current_admin_insert on public.current_sheet_uploads for insert to authenticated with check((select private.is_admin()));
create policy current_admin_update on public.current_sheet_uploads for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy current_admin_delete on public.current_sheet_uploads for delete to authenticated using((select private.is_admin()));
commit;
