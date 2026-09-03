begin;

-- Dotación y datos personales mínimos para acceso y cumpleaños. ------------

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists employment_status text not null default 'active';

alter table public.profiles drop constraint if exists profiles_employment_status_check;
alter table public.profiles add constraint profiles_employment_status_check
  check (employment_status in ('active', 'detached', 'medical_leave', 'vacation'));

create index if not exists profiles_employment_status_idx
  on public.profiles(employment_status, active);

-- Toda venta es explícitamente emitida o cantada. El valor por defecto
-- mantiene compatibilidad con cargas históricas que ya representaban emisión.
alter table public.sales
  add column if not exists sale_status text not null default 'emitted',
  add column if not exists emitted_at date;

alter table public.sales drop constraint if exists sales_sale_status_check;
alter table public.sales add constraint sales_sale_status_check
  check (sale_status in ('sung', 'emitted', 'cancelled'));

update public.sales
set emitted_at = coalesce(emitted_at, sold_at)
where sale_status = 'emitted';

create index if not exists sales_status_sold_at_idx
  on public.sales(sale_status, sold_at desc);

-- Nuevas fuentes y métricas agregadas, sin datos de clientes. ---------------

alter table public.upload_batches drop constraint if exists upload_batches_kind_check;
alter table public.upload_batches add constraint upload_batches_kind_check
  check (kind in (
    'commercial', 'sales', 'emission', 'senior', 'category',
    'delinquency', 'sauce', 'salesforce', 'ranking'
  ));

alter table public.metric_snapshots
  add column if not exists cancellation_count integer check (cancellation_count >= 0),
  add column if not exists sung_uf numeric(14, 2) check (sung_uf >= 0),
  add column if not exists productivity numeric(8, 2) check (productivity >= 0),
  add column if not exists last_sale_date date,
  add column if not exists debt_installments_count integer check (debt_installments_count >= 0),
  add column if not exists debt_uf_0 numeric(14, 2) check (debt_uf_0 >= 0),
  add column if not exists debt_uf_8 numeric(14, 2) check (debt_uf_8 >= 0),
  add column if not exists senior_status text;

alter table public.metric_snapshots drop constraint if exists metric_snapshots_senior_status_check;
alter table public.metric_snapshots add constraint metric_snapshots_senior_status_check
  check (senior_status is null or senior_status in ('open', 'closed'));

-- Un trabajador fuera de dotación activa no puede consultar información.
create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active = true
    and p.employment_status = 'active'
$$;

create or replace function private.can_view_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles target on target.id = target_user_id
    where me.id = (select auth.uid())
      and me.active = true
      and me.employment_status = 'active'
      and target.active = true
      and target.employment_status = 'active'
      and (
        me.role = 'admin'
        or target.id = me.id
        or (me.role = 'coordinator' and target.supervisor_id = me.id)
        or (me.role = 'sales_manager' and target.sales_manager_id = me.id)
      )
  )
$$;

create or replace function private.can_view_team(target_team_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles me
    join public.teams target on target.id = target_team_id
    where me.id = (select auth.uid())
      and me.active = true
      and me.employment_status = 'active'
      and (
        me.role = 'admin'
        or me.team_id = target.id
        or target.coordinator_id = me.id
        or (me.role = 'sales_manager' and target.sales_manager_id = me.id)
      )
  )
$$;

-- Última carga autoritativa por vendedor y mes. La emisión prevalece sobre
-- venta diaria y panel comercial; nunca se usa producción bruta.
create or replace function private.emitted_monthly_rows()
returns table (
  user_id uuid,
  month_start date,
  emitted_uf numeric,
  business_count integer,
  cancellation_count integer,
  last_sale_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (m.user_id, date_trunc('month', b.period_end)::date)
    m.user_id,
    date_trunc('month', b.period_end)::date,
    coalesce(m.emitted_uf, 0),
    coalesce(m.business_count, 0),
    coalesce(m.cancellation_count, 0),
    m.last_sale_date
  from public.metric_snapshots m
  join public.upload_batches b on b.id = m.batch_id
  join public.profiles p on p.id = m.user_id
  where b.status = 'published'
    and b.kind in ('emission', 'sales', 'commercial')
    and p.role = 'seller'
    and p.active = true
    and p.employment_status = 'active'
  order by
    m.user_id,
    date_trunc('month', b.period_end)::date,
    case b.kind when 'emission' then 1 when 'sales' then 2 else 3 end,
    b.published_at desc,
    m.id desc
$$;

revoke all on function private.emitted_monthly_rows() from public, anon, authenticated;

create or replace function public.commercial_dashboard_summary()
returns table (
  user_id uuid,
  annual_emitted_uf numeric,
  monthly_emitted_uf numeric,
  last_sale_date date,
  monthly_business_count integer,
  monthly_cancellation_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    coalesce(sum(r.emitted_uf) filter (
      where r.month_start >= date_trunc('year', current_date)::date
        and r.month_start <= date_trunc('month', current_date)::date
    ), 0),
    coalesce(max(r.emitted_uf) filter (
      where r.month_start = date_trunc('month', current_date)::date
    ), 0),
    max(r.last_sale_date),
    coalesce(max(r.business_count) filter (
      where r.month_start = date_trunc('month', current_date)::date
    ), 0)::integer,
    coalesce(max(r.cancellation_count) filter (
      where r.month_start = date_trunc('month', current_date)::date
    ), 0)::integer
  from public.profiles p
  left join private.emitted_monthly_rows() r on r.user_id = p.id
  where p.role = 'seller'
    and p.active = true
    and p.employment_status = 'active'
    and private.can_view_profile(p.id)
  group by p.id
$$;

revoke all on function public.commercial_dashboard_summary() from public, anon, authenticated;
grant execute on function public.commercial_dashboard_summary() to authenticated;

-- Ranking por rol: vendedor contra vendedores, coordinador contra equipos y
-- jefe de ventas únicamente entre las coordinaciones de su jefatura.
create or replace function public.commercial_ranking(period_scope text default 'annual')
returns table (
  entity_id text,
  display_name text,
  avatar_url text,
  team_id bigint,
  team_name text,
  value numeric,
  ranking_position bigint,
  is_current boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.profiles;
begin
  if period_scope not in ('annual', 'monthly') then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  select * into me
  from public.profiles
  where id = (select auth.uid())
    and active = true
    and employment_status = 'active';

  if me.id is null then return; end if;

  if me.role in ('seller', 'admin') then
    return query
    with totals as (
      select
        p.id,
        p.full_name,
        p.avatar_url,
        p.team_id,
        t.name as team_name,
        coalesce(sum(r.emitted_uf) filter (
          where (period_scope = 'annual' and r.month_start >= date_trunc('year', current_date)::date and r.month_start <= date_trunc('month', current_date)::date)
             or (period_scope = 'monthly' and r.month_start = date_trunc('month', current_date)::date)
        ), 0) as total
      from public.profiles p
      left join public.teams t on t.id = p.team_id
      left join private.emitted_monthly_rows() r on r.user_id = p.id
      where p.role = 'seller' and p.active = true and p.employment_status = 'active'
      group by p.id, p.full_name, p.avatar_url, p.team_id, t.name
    )
    select
      totals.id::text,
      totals.full_name,
      totals.avatar_url,
      totals.team_id,
      totals.team_name,
      totals.total,
      row_number() over (order by totals.total desc, totals.full_name),
      totals.id = me.id
    from totals
    order by totals.total desc, totals.full_name;
  else
    return query
    with team_totals as (
      select
        t.id,
        t.name,
        c.avatar_url,
        count(distinct p.id)::integer as sellers,
        coalesce(sum(r.emitted_uf) filter (
          where (period_scope = 'annual' and r.month_start >= date_trunc('year', current_date)::date and r.month_start <= date_trunc('month', current_date)::date)
             or (period_scope = 'monthly' and r.month_start = date_trunc('month', current_date)::date)
        ), 0) as total
      from public.teams t
      left join public.profiles c on c.id = t.coordinator_id
      left join public.profiles p on p.team_id = t.id
        and p.role = 'seller' and p.active = true and p.employment_status = 'active'
      left join private.emitted_monthly_rows() r on r.user_id = p.id
      where me.role = 'coordinator'
         or (me.role = 'sales_manager' and t.sales_manager_id = me.id)
      group by t.id, t.name, c.avatar_url
    )
    select
      team_totals.id::text,
      team_totals.name,
      team_totals.avatar_url,
      team_totals.id,
      team_totals.sellers::text || ' vendedores',
      team_totals.total,
      row_number() over (order by team_totals.total desc, team_totals.name),
      me.role = 'coordinator' and team_totals.id = me.team_id
    from team_totals
    order by team_totals.total desc, team_totals.name;
  end if;
end;
$$;

revoke all on function public.commercial_ranking(text) from public, anon, authenticated;
grant execute on function public.commercial_ranking(text) to authenticated;

commit;
