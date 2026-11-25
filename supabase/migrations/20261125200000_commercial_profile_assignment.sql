begin;

create function private.commercial_profile_assignment(p_preview_worker_id text)
returns table (team_name text, coordinator_name text, coordinator_display_name text)
language sql stable security definer set search_path = '' as $$
  select case when w.role = 'coordinator' then w.team_name else c.team_name end,
         c.name, c.display_name
  from public.profiles p
  join public.commercial_workers w on w.id = p_preview_worker_id or
    (p_preview_worker_id is null and w.rut = lower(regexp_replace(p.rut, '[^0-9kK]', '', 'g')))
  left join public.commercial_workers c on c.id = w.coordinator_id and w.role = 'seller' and c.role = 'coordinator'
  where p.id = (select auth.uid())
    and p.active and p.employment_status = 'active'
    and w.active and w.status = 'active'
    and w.role in ('seller', 'coordinator')
    and ((p_preview_worker_id is not null and p.role = 'admin')
      or (p_preview_worker_id is null and p.role = w.role));
$$;

revoke all on function private.commercial_profile_assignment(text) from public, anon;
grant execute on function private.commercial_profile_assignment(text) to authenticated;

create function public.commercial_profile_assignment(p_preview_worker_id text default null)
returns table (team_name text, coordinator_name text, coordinator_display_name text)
language sql stable security invoker set search_path = '' as $$
  select * from private.commercial_profile_assignment(p_preview_worker_id);
$$;

revoke all on function public.commercial_profile_assignment(text) from public, anon;
grant execute on function public.commercial_profile_assignment(text) to authenticated;

commit;
