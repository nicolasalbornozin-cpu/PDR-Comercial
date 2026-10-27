begin;
-- Preserve all existing authentication, scope checks, grants and monthly logic.
-- The uploaded director row is an explicit channel total, not a fourth unit.
do $$
declare definition text;old_channel text := $old$ ),channel as (
  -- Sum the jefaturas once, never both jefaturas and their coordinators.
  select sum(gross)as gross,sum(emitted)as emitted from home where role='sales_manager'
  having count(*)>0 and not exists(select 1 from public.commercial_workers w where w.role='sales_manager' and w.active and w.status='active'
   and not exists(select 1 from home h where h.id=w.id))
 )select jsonb_build_object$old$;
new_channel text := $new$ ),channel as (
  -- An explicit Gerente total is authoritative for the entire channel.
  -- Jefe Comercial and Admin share it; never add it to the unit totals.
  select gross,emitted from home where role='sales_director'
  union all
  select gross,emitted from home where role='commercial_manager'
   and not exists(select 1 from home where role='sales_director')
  union all
  select sum(gross)as gross,sum(emitted)as emitted from home where role='sales_manager'
  having count(*)>0 and not exists(select 1 from home where role in ('sales_director','commercial_manager'))
   and not exists(select 1 from public.commercial_workers w where w.role='sales_manager' and w.active and w.status='active'
    and not exists(select 1 from home h where h.id=w.id))
 )select jsonb_build_object$new$;
begin
 definition:=pg_get_functiondef('private.sales_scope_totals(text)'::regprocedure);
 if strpos(definition,old_channel)=0 then raise exception 'Review the current sales scope function before changing channel totals';end if;
 execute replace(definition,old_channel,new_channel);
end $$;
notify pgrst,'reload schema';
commit;
