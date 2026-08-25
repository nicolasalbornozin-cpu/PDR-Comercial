begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

create table public.teams (
  id bigint generated always as identity primary key,
  name text not null unique,
  total_uf numeric(14, 2) not null default 0 check (total_uf >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  rut text unique,
  role text not null default 'executive'
    check (role in ('executive', 'coordinator', 'sales_manager')),
  avatar_url text,
  team_id bigint references public.teams(id) on delete set null,
  supervisor_id uuid references public.profiles(id) on delete set null,
  sales_manager_id uuid references public.profiles(id) on delete set null,
  join_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teams
  add column sales_manager_id uuid references public.profiles(id) on delete set null;

create table public.executive_metrics (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  uf_sold numeric(14, 2) not null default 0 check (uf_sold >= 0),
  delinquency_rate numeric(5, 2) not null default 0
    check (delinquency_rate between 0 and 100),
  business_count integer not null default 0 check (business_count >= 0),
  salesforce_records integer not null default 0 check (salesforce_records >= 0),
  ranking_position integer check (ranking_position > 0),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  goal_type text not null,
  start_date date not null,
  end_date date not null,
  metric text not null check (metric in ('uf', 'businesses', 'delinquency')),
  current_value numeric(14, 2) not null default 0 check (current_value >= 0),
  target_value numeric(14, 2) not null check (target_value >= 0),
  unit text not null check (unit in ('UF', '%', 'negocios')),
  level text not null,
  status text not null default 'pending'
    check (status in ('completed', 'in_progress', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.competitions (
  id bigint generated always as identity primary key,
  name text not null,
  competition_type text not null
    check (competition_type in ('category', 'senior', 'monthly', 'custom')),
  start_date date not null,
  end_date date not null,
  metric text not null check (metric in ('uf', 'businesses', 'delinquency')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.ranking_entries (
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.competitions(id) on delete cascade,
  ranking_mode text not null check (ranking_mode in ('sellers', 'teams', 'management')),
  user_id uuid references public.profiles(id) on delete cascade,
  team_id bigint references public.teams(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  subtitle text,
  value numeric(14, 2) not null default 0,
  position integer not null check (position > 0),
  updated_at timestamptz not null default now(),
  unique (competition_id, ranking_mode, position),
  check (user_id is not null or team_id is not null)
);

create table public.sales (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id bigint references public.teams(id) on delete set null,
  sold_at date not null,
  uf_amount numeric(14, 2) not null check (uf_amount >= 0),
  business_count integer not null default 1 check (business_count >= 0),
  salesforce_records integer not null default 0 check (salesforce_records >= 0),
  external_reference text unique,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delinquency_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  rate numeric(5, 2) not null check (rate between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start, period_end),
  check (period_end >= period_start)
);

create table public.news_articles (
  id bigint generated always as identity primary key,
  title text not null,
  summary text not null,
  body text not null,
  image_url text,
  published_at timestamptz not null default now(),
  featured boolean not null default false,
  category text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gallery_images (
  id bigint generated always as identity primary key,
  news_article_id bigint references public.news_articles(id) on delete set null,
  title text not null,
  image_url text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'general',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index profiles_team_id_idx on public.profiles(team_id);
create index profiles_supervisor_id_idx on public.profiles(supervisor_id);
create index profiles_sales_manager_id_idx on public.profiles(sales_manager_id);
create index teams_sales_manager_id_idx on public.teams(sales_manager_id);
create index goals_user_id_idx on public.goals(user_id);
create index goals_period_idx on public.goals(start_date, end_date);
create index competitions_active_period_idx on public.competitions(active, start_date, end_date);
create index ranking_entries_competition_mode_idx
  on public.ranking_entries(competition_id, ranking_mode, position);
create index ranking_entries_user_id_idx on public.ranking_entries(user_id);
create index ranking_entries_team_id_idx on public.ranking_entries(team_id);
create index sales_user_id_sold_at_idx on public.sales(user_id, sold_at desc);
create index sales_team_id_idx on public.sales(team_id);
create index delinquency_records_user_id_idx on public.delinquency_records(user_id);
create index news_articles_active_published_idx
  on public.news_articles(active, published_at desc);
create index gallery_images_news_article_id_idx on public.gallery_images(news_article_id);
create index notifications_user_id_created_idx
  on public.notifications(user_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger teams_set_updated_at
before update on public.teams
for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();
create trigger goals_set_updated_at
before update on public.goals
for each row execute function private.set_updated_at();
create trigger competitions_set_updated_at
before update on public.competitions
for each row execute function private.set_updated_at();
create trigger sales_set_updated_at
before update on public.sales
for each row execute function private.set_updated_at();
create trigger delinquency_records_set_updated_at
before update on public.delinquency_records
for each row execute function private.set_updated_at();
create trigger news_articles_set_updated_at
before update on public.news_articles
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, rut, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    lower(new.email),
    nullif(lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'rut', ''), '[^0-9kK]', '', 'g')), ''),
    'executive'
  );

  insert into public.executive_metrics (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.executive_metrics enable row level security;
alter table public.goals enable row level security;
alter table public.competitions enable row level security;
alter table public.ranking_entries enable row level security;
alter table public.sales enable row level security;
alter table public.delinquency_records enable row level security;
alter table public.news_articles enable row level security;
alter table public.gallery_images enable row level security;
alter table public.notifications enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to authenticated;
grant select on table public.teams to authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, rut, avatar_url) on table public.profiles to authenticated;
grant select on table public.executive_metrics to authenticated;
grant select on table public.goals to authenticated;
grant select on table public.competitions to authenticated;
grant select on table public.ranking_entries to authenticated;
grant select on table public.sales to authenticated;
grant select on table public.delinquency_records to authenticated;
grant select on table public.news_articles to authenticated;
grant select on table public.gallery_images to authenticated;
grant select, update (read_at) on table public.notifications to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

create policy teams_authenticated_read
on public.teams for select to authenticated
using (true);

create policy profiles_read_own
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy executive_metrics_read_own
on public.executive_metrics for select to authenticated
using ((select auth.uid()) = user_id);

create policy goals_read_own
on public.goals for select to authenticated
using ((select auth.uid()) = user_id);

create policy competitions_authenticated_read
on public.competitions for select to authenticated
using (active = true);

create policy ranking_entries_authenticated_read
on public.ranking_entries for select to authenticated
using (true);

create policy sales_read_own
on public.sales for select to authenticated
using ((select auth.uid()) = user_id);

create policy delinquency_records_read_own
on public.delinquency_records for select to authenticated
using ((select auth.uid()) = user_id);

create policy news_articles_authenticated_read
on public.news_articles for select to authenticated
using (active = true);

create policy gallery_images_authenticated_read
on public.gallery_images for select to authenticated
using (active = true);

create policy notifications_read_own
on public.notifications for select to authenticated
using ((select auth.uid()) = user_id);

create policy notifications_update_own
on public.notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

insert into public.teams (name)
values ('Equipo Comercial')
on conflict (name) do nothing;

insert into public.competitions
  (name, competition_type, start_date, end_date, metric, active)
values
  ('Ranking mensual', 'monthly', date_trunc('month', current_date)::date,
   (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'uf', true);

insert into public.news_articles
  (title, summary, body, category, featured, active)
values
  ('Bienvenidos a PDR Comercial',
   'La plataforma comercial ya está conectada a su base de datos segura.',
   'Desde esta aplicación podrás consultar tus ventas, metas, rankings, noticias y reconocimientos. Los datos comerciales serán cargados por el equipo administrador.',
   'Institucional', true, true);

commit;
