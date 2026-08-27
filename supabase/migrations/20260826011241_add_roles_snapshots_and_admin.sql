begin;

-- Roles y jerarquía ---------------------------------------------------------

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%';

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end;
$$;

update public.profiles set role = 'seller' where role = 'executive';

alter table public.profiles
  alter column role set default 'seller',
  add constraint profiles_role_check
    check (role in ('seller', 'coordinator', 'sales_manager', 'admin')),
  add column must_change_password boolean not null default false;

alter table public.teams
  add column coordinator_id uuid references public.profiles(id) on delete set null;

create index teams_coordinator_id_idx on public.teams(coordinator_id);
create index profiles_role_active_idx on public.profiles(role, active);

-- Lotes de fotos agregadas -------------------------------------------------

create table public.upload_batches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'commercial', 'senior', 'category', 'delinquency', 'salesforce', 'ranking'
  )),
  period_start date not null,
  period_end date not null,
  source_name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'failed', 'superseded')),
  row_count integer not null default 0 check (row_count >= 0),
  validation_summary jsonb not null default '{}'::jsonb,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table public.metric_snapshots (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.upload_batches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  production_uf numeric(14, 2) check (production_uf >= 0),
  gross_uf numeric(14, 2) check (gross_uf >= 0),
  sepultura_uf numeric(14, 2) check (sepultura_uf >= 0),
  ssff_uf numeric(14, 2) check (ssff_uf >= 0),
  cinerario_uf numeric(14, 2) check (cinerario_uf >= 0),
  ssaa_uf numeric(14, 2) check (ssaa_uf >= 0),
  emitted_uf numeric(14, 2) check (emitted_uf >= 0),
  not_emitted_uf numeric(14, 2) check (not_emitted_uf >= 0),
  not_uploaded_uf numeric(14, 2) check (not_uploaded_uf >= 0),
  cancellation_uf numeric(14, 2) check (cancellation_uf >= 0),
  quarter_total_uf numeric(14, 2) check (quarter_total_uf >= 0),
  eligible_total_uf numeric(14, 2) check (eligible_total_uf >= 0),
  business_count integer check (business_count >= 0),
  smad_count integer check (smad_count >= 0),
  rest_count integer check (rest_count >= 0),
  ssff_count integer check (ssff_count >= 0),
  delinquent_clients_count integer check (delinquent_clients_count >= 0),
  delinquency_rate numeric(5, 2) check (delinquency_rate between 0 and 100),
  salesforce_records integer check (salesforce_records >= 0),
  tenure_months numeric(8, 2) check (tenure_months >= 0),
  ranking_position integer check (ranking_position > 0),
  category text,
  senior_level text,
  estimated_prize_clp integer check (estimated_prize_clp >= 0),
  created_at timestamptz not null default now(),
  unique (batch_id, user_id)
);

create index upload_batches_kind_status_published_idx
  on public.upload_batches(kind, status, published_at desc);
create index upload_batches_uploaded_by_idx on public.upload_batches(uploaded_by);
create index metric_snapshots_user_batch_idx on public.metric_snapshots(user_id, batch_id);
create index metric_snapshots_batch_id_idx on public.metric_snapshots(batch_id);

create table public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'dismissed')),
  request_count integer not null default 1 check (request_count > 0),
  requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index password_reset_requests_one_pending_idx
  on public.password_reset_requests(user_id)
  where status = 'pending';
create index password_reset_requests_status_requested_idx
  on public.password_reset_requests(status, last_requested_at desc);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_admin_created_idx
  on public.admin_audit_logs(admin_id, created_at desc);
create index admin_audit_logs_target_user_idx
  on public.admin_audit_logs(target_user_id);

-- Reglas comerciales versionadas ------------------------------------------

create table public.category_tiers (
  code text primary key,
  label text not null,
  min_uf numeric(14, 2) not null check (min_uf >= 0),
  max_uf numeric(14, 2) check (max_uf >= min_uf),
  smad_required integer not null check (smad_required >= 0),
  prize_clp integer not null check (prize_clp >= 0),
  sort_order integer not null unique
);

create table public.senior_bonus_rules (
  id bigint generated always as identity primary key,
  level text not null,
  total_uf_required numeric(14, 2) not null check (total_uf_required >= 0),
  smad_required integer not null check (smad_required >= 0),
  rest_required integer not null default 0 check (rest_required >= 0),
  ssff_required integer not null default 0 check (ssff_required >= 0),
  prize_clp integer not null check (prize_clp >= 0),
  tenure_rule text not null default 'over_10'
    check (tenure_rule in ('up_to_10', 'over_10')),
  sort_order integer not null unique,
  unique (level, total_uf_required, smad_required, rest_required, ssff_required)
);

insert into public.category_tiers
  (code, label, min_uf, max_uf, smad_required, prize_clp, sort_order)
values
  ('bronze', 'Bronce', 350, 459.99, 1, 50000, 1),
  ('silver', 'Plata', 460, 569.99, 2, 80000, 2),
  ('gold', 'Oro', 570, 719.99, 2, 120000, 3),
  ('platinum', 'Platino', 720, 849.99, 3, 180000, 4),
  ('diamond', 'Diamante', 850, null, 3, 250000, 5);

insert into public.senior_bonus_rules
  (level, total_uf_required, smad_required, rest_required, ssff_required,
   prize_clp, tenure_rule, sort_order)
values
  ('Acompañante Senior', 1350, 10, 0, 0, 0, 'up_to_10', 1),
  ('Senior', 1350, 10, 0, 0, 60000, 'over_10', 2),
  ('Senior Multiproducto', 1500, 10, 0, 0, 90000, 'over_10', 3),
  ('Senior Multiproducto', 1500, 10, 1, 0, 100000, 'over_10', 4),
  ('Senior Multiproducto', 1500, 13, 0, 0, 100000, 'over_10', 5),
  ('Senior Multiproducto', 1500, 13, 2, 0, 120000, 'over_10', 6),
  ('Senior Multiproducto', 1500, 13, 2, 1, 130000, 'over_10', 7),
  ('Super Senior', 1750, 10, 0, 0, 110000, 'over_10', 8),
  ('Super Senior Multiproducto', 1950, 10, 0, 0, 135000, 'over_10', 9),
  ('Super Senior Multiproducto', 1950, 10, 1, 0, 145000, 'over_10', 10),
  ('Super Senior Multiproducto', 1950, 13, 0, 0, 150000, 'over_10', 11),
  ('Super Senior Multiproducto', 1950, 13, 2, 0, 170000, 'over_10', 12),
  ('Super Senior Multiproducto', 1950, 13, 2, 1, 180000, 'over_10', 13);

-- Funciones de autorización. Viven fuera del esquema expuesto. -------------

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
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'admin', false)
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
      and (
        me.role = 'admin'
        or me.team_id = target.id
        or target.coordinator_id = me.id
        or (me.role = 'sales_manager' and target.sales_manager_id = me.id)
      )
  )
$$;

revoke all on function private.current_app_role() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.can_view_profile(uuid) from public, anon, authenticated;
revoke all on function private.can_view_team(bigint) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;
grant execute on function private.can_view_team(bigint) to authenticated;

-- Todo usuario creado por Auth parte como vendedor salvo que una operación
-- administrativa segura defina su rol mediante app_metadata.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := coalesce(new.raw_app_meta_data ->> 'role', 'seller');
begin
  if requested_role not in ('seller', 'coordinator', 'sales_manager', 'admin') then
    requested_role := 'seller';
  end if;

  insert into public.profiles (id, full_name, email, rut, role, must_change_password)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    lower(new.email),
    nullif(lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'rut', ''), '[^0-9kK]', '', 'g')), ''),
    requested_role,
    coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false)
  );

  if requested_role = 'seller' then
    insert into public.executive_metrics (user_id) values (new.id);
  end if;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

-- Vistas seguras de la última foto publicada por tipo y trabajador. --------

create or replace view public.latest_metric_snapshots
with (security_invoker = true)
as
select distinct on (b.kind, m.user_id)
  m.*,
  b.kind,
  b.period_start,
  b.period_end,
  b.source_name,
  b.published_at
from public.metric_snapshots m
join public.upload_batches b on b.id = m.batch_id
where b.status = 'published'
order by b.kind, m.user_id, b.published_at desc, m.id desc;

-- Timestamps ----------------------------------------------------------------

create trigger upload_batches_set_updated_at
before update on public.upload_batches
for each row execute function private.set_updated_at();

create or replace function public.publish_upload_batch(target_batch_id uuid)
returns public.upload_batches
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.upload_batches;
begin
  if not private.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into target
  from public.upload_batches
  where id = target_batch_id
  for update;

  if target.id is null then
    raise exception 'Lote no encontrado' using errcode = 'P0002';
  end if;

  if target.status <> 'draft' then
    raise exception 'Solo se puede publicar un lote en borrador';
  end if;

  if not exists (
    select 1 from public.metric_snapshots where batch_id = target_batch_id
  ) then
    raise exception 'El lote no contiene filas válidas';
  end if;

  update public.upload_batches
  set status = 'superseded'
  where kind = target.kind
    and period_start = target.period_start
    and period_end = target.period_end
    and status = 'published'
    and id <> target.id;

  update public.upload_batches
  set status = 'published',
      row_count = (
        select count(*)::integer
        from public.metric_snapshots
        where batch_id = target_batch_id
      ),
      published_at = now()
  where id = target_batch_id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.publish_upload_batch(uuid) from public, anon, authenticated;
grant execute on function public.publish_upload_batch(uuid) to authenticated;

create or replace function public.ranking_leaderboard()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  team_id bigint,
  team_name text,
  value numeric,
  ranking_position integer,
  period_start date,
  period_end date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active = true
  ) then
    return;
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.team_id,
    t.name,
    coalesce(m.production_uf, m.eligible_total_uf, m.quarter_total_uf, 0),
    m.ranking_position,
    b.period_start,
    b.period_end
  from public.upload_batches b
  join public.metric_snapshots m on m.batch_id = b.id
  join public.profiles p on p.id = m.user_id and p.role = 'seller' and p.active = true
  left join public.teams t on t.id = p.team_id
  where b.id = (
    select newest.id
    from public.upload_batches newest
    where newest.kind = 'ranking' and newest.status = 'published'
    order by newest.published_at desc
    limit 1
  )
  order by m.ranking_position nulls last,
           coalesce(m.production_uf, m.eligible_total_uf, m.quarter_total_uf, 0) desc,
           p.full_name;
end;
$$;

revoke all on function public.ranking_leaderboard() from public, anon, authenticated;
grant execute on function public.ranking_leaderboard() to authenticated;

-- Seguridad y permisos ------------------------------------------------------

alter table public.upload_batches enable row level security;
alter table public.metric_snapshots enable row level security;
alter table public.password_reset_requests enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.category_tiers enable row level security;
alter table public.senior_bonus_rules enable row level security;

revoke all on table public.upload_batches from anon, authenticated;
revoke all on table public.metric_snapshots from anon, authenticated;
revoke all on table public.password_reset_requests from anon, authenticated;
revoke all on table public.admin_audit_logs from anon, authenticated;
revoke all on table public.category_tiers from anon, authenticated;
revoke all on table public.senior_bonus_rules from anon, authenticated;
revoke all on table public.latest_metric_snapshots from anon, authenticated;
revoke all on sequence public.metric_snapshots_id_seq from anon, authenticated;
revoke all on sequence public.admin_audit_logs_id_seq from anon, authenticated;
revoke all on sequence public.senior_bonus_rules_id_seq from anon, authenticated;

grant select, insert, update, delete on table public.upload_batches to authenticated;
grant select, insert, update, delete on table public.metric_snapshots to authenticated;
grant select, update on table public.password_reset_requests to authenticated;
grant select on table public.admin_audit_logs to authenticated;
grant select, insert, update, delete on table public.category_tiers to authenticated;
grant select, insert, update, delete on table public.senior_bonus_rules to authenticated;
grant select on table public.latest_metric_snapshots to authenticated;
grant usage, select on sequence public.metric_snapshots_id_seq to authenticated;
grant usage, select on sequence public.senior_bonus_rules_id_seq to authenticated;

grant all on table public.upload_batches to service_role;
grant all on table public.metric_snapshots to service_role;
grant all on table public.password_reset_requests to service_role;
grant all on table public.admin_audit_logs to service_role;
grant all on table public.category_tiers to service_role;
grant all on table public.senior_bonus_rules to service_role;
grant all on table public.latest_metric_snapshots to service_role;
grant all on sequence public.metric_snapshots_id_seq to service_role;
grant all on sequence public.admin_audit_logs_id_seq to service_role;
grant all on sequence public.senior_bonus_rules_id_seq to service_role;

revoke update (full_name, rut, avatar_url) on table public.profiles from authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

drop policy if exists teams_authenticated_read on public.teams;
drop policy if exists profiles_read_own on public.profiles;
drop policy if exists executive_metrics_read_own on public.executive_metrics;
drop policy if exists goals_read_own on public.goals;
drop policy if exists sales_read_own on public.sales;
drop policy if exists delinquency_records_read_own on public.delinquency_records;

create policy teams_hierarchy_read
on public.teams for select to authenticated
using (private.can_view_team(id));

create policy teams_admin_insert
on public.teams for insert to authenticated
with check (private.is_admin());

create policy teams_admin_update
on public.teams for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy teams_admin_delete
on public.teams for delete to authenticated
using (private.is_admin());

grant insert, update, delete on table public.teams to authenticated;
grant usage, select on sequence public.teams_id_seq to authenticated;

create policy profiles_hierarchy_read
on public.profiles for select to authenticated
using (private.can_view_profile(id));

create policy executive_metrics_hierarchy_read
on public.executive_metrics for select to authenticated
using (private.can_view_profile(user_id));

create policy goals_hierarchy_read
on public.goals for select to authenticated
using (private.can_view_profile(user_id));

create policy sales_hierarchy_read
on public.sales for select to authenticated
using (private.can_view_profile(user_id));

create policy delinquency_records_hierarchy_read
on public.delinquency_records for select to authenticated
using (private.can_view_profile(user_id));

create policy upload_batches_published_or_admin_read
on public.upload_batches for select to authenticated
using (status = 'published' or private.is_admin());

create policy upload_batches_admin_insert
on public.upload_batches for insert to authenticated
with check (private.is_admin() and uploaded_by = (select auth.uid()));

create policy upload_batches_admin_update
on public.upload_batches for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy upload_batches_admin_delete
on public.upload_batches for delete to authenticated
using (private.is_admin());

create policy metric_snapshots_hierarchy_read
on public.metric_snapshots for select to authenticated
using (
  private.is_admin()
  or (
    private.can_view_profile(user_id)
    and exists (
      select 1 from public.upload_batches b
      where b.id = batch_id and b.status = 'published'
    )
  )
);

create policy metric_snapshots_admin_insert
on public.metric_snapshots for insert to authenticated
with check (private.is_admin());

create policy metric_snapshots_admin_update
on public.metric_snapshots for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy metric_snapshots_admin_delete
on public.metric_snapshots for delete to authenticated
using (private.is_admin());

create policy password_reset_requests_admin_read
on public.password_reset_requests for select to authenticated
using (private.is_admin());

create policy password_reset_requests_admin_update
on public.password_reset_requests for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy admin_audit_logs_admin_read
on public.admin_audit_logs for select to authenticated
using (private.is_admin());

create policy category_tiers_authenticated_read
on public.category_tiers for select to authenticated
using (true);

create policy category_tiers_admin_insert
on public.category_tiers for insert to authenticated
with check (private.is_admin());

create policy category_tiers_admin_update
on public.category_tiers for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy category_tiers_admin_delete
on public.category_tiers for delete to authenticated
using (private.is_admin());

create policy senior_bonus_rules_authenticated_read
on public.senior_bonus_rules for select to authenticated
using (true);

create policy senior_bonus_rules_admin_insert
on public.senior_bonus_rules for insert to authenticated
with check (private.is_admin());

create policy senior_bonus_rules_admin_update
on public.senior_bonus_rules for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy senior_bonus_rules_admin_delete
on public.senior_bonus_rules for delete to authenticated
using (private.is_admin());

commit;
