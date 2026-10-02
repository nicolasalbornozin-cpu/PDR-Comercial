begin;

-- This does not enable Supabase's unrestricted signUp. Account creation remains
-- server-only, with a dotación gate and a one-time reservation per RUT.
create table public.registration_controls (
  rut text primary key check (rut ~ '^[0-9]{7,8}[0-9k]$'),
  enabled boolean not null default true,
  audiovisual_name text check (audiovisual_name is null or length(trim(audiovisual_name)) between 3 and 120),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);
create index registration_controls_author_idx on public.registration_controls(updated_by);
alter table public.registration_controls enable row level security;
revoke all on public.registration_controls from public,anon,authenticated;
grant select,insert,update,delete on public.registration_controls to authenticated;
grant all on public.registration_controls to service_role;
-- The registration service only reads the authoritative roster. No client or
-- anonymous grants are expanded by this server-only permission.
grant select on public.commercial_workers,public.profiles to service_role;
create policy registration_controls_admin_read on public.registration_controls for select to authenticated
  using ((select private.is_admin()));
create policy registration_controls_admin_write on public.registration_controls for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()) and updated_by=(select auth.uid()));

create table private.registration_claims (
  rut text primary key,
  request_id uuid not null unique,
  expires_at timestamptz not null,
  claimed_at timestamptz
);
create table private.registration_limits (
  key text primary key,
  window_start timestamptz not null,
  attempts integer not null check (attempts>0)
);
create index registration_limits_window_idx on private.registration_limits(window_start);
alter table private.registration_claims enable row level security;
alter table private.registration_limits enable row level security;
revoke all on private.registration_claims,private.registration_limits from public,anon,authenticated;
grant usage on schema private to service_role;
grant all on private.registration_claims,private.registration_limits to service_role;

-- Internal lookup, not exposed to clients. Administrator-issued Audiovisual
-- eligibility is separate from the commercial roster and cannot grant admin.
create function private.registration_identity(p_rut text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare control public.registration_controls%rowtype; worker public.commercial_workers%rowtype;
begin
  select * into control from public.registration_controls where rut=p_rut;
  if found and not control.enabled then return null; end if;
  if control.audiovisual_name is not null then
    return jsonb_build_object('name',trim(control.audiovisual_name),'role','audiovisual');
  end if;
  select * into worker from public.commercial_workers where rut=p_rut;
  if not found or not worker.active or worker.status<>'active'
    or worker.role not in ('seller','coordinator','sales_manager') then return null; end if;
  return jsonb_build_object('name',worker.name,'role',worker.role,'join_date',worker.join_date,'birth_date',worker.birth_date);
end;
$$;
revoke all on function private.registration_identity(text) from public,anon,authenticated;
grant execute on function private.registration_identity(text) to service_role;

-- Invoker intentionally: the service role has the explicit private-table grants.
-- No unauthenticated RPC can read the roster or reserve/consume a claim.
create function public.reserve_roster_registration(p_rut text,p_request_id uuid,p_ip_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare identity jsonb; existing public.profiles%rowtype; claim private.registration_claims%rowtype;
  limit_key text; max_attempts integer; attempts integer; now_at timestamptz:=clock_timestamp();
begin
  if p_rut !~ '^[0-9]{7,8}[0-9k]$' or p_ip_hash !~ '^[0-9a-f]{64}$' or p_request_id is null then
    return jsonb_build_object('error','Solicitud inválida.','status',400);
  end if;
  delete from private.registration_limits where window_start<now_at-interval '1 day';
  for limit_key,max_attempts in select * from (values ('global',500),('ip:'||p_ip_hash,20),('rut:'||md5(p_rut),5)) as limits(key,maximum) loop
    insert into private.registration_limits as current_limit(key,window_start,attempts)
    values(limit_key,now_at,1)
    on conflict(key) do update set
      window_start=case when current_limit.window_start<now_at-interval '15 minutes' then now_at else current_limit.window_start end,
      attempts=case when current_limit.window_start<now_at-interval '15 minutes' then 1 else least(current_limit.attempts+1,1000000) end
    returning current_limit.attempts into attempts;
    if attempts>max_attempts then return jsonb_build_object('error','Demasiados intentos. Espera 15 minutos antes de volver a intentar.','status',429); end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('registration:'||p_rut,0));
  identity:=private.registration_identity(p_rut);
  if identity is null then return jsonb_build_object('error','Error al comunicar con el servidor','status',403); end if;
  select * into existing from public.profiles where rut=p_rut;
  if found then
    if not existing.active or existing.employment_status<>'active' then
      return jsonb_build_object('error','Error al comunicar con el servidor','status',403);
    end if;
    return jsonb_build_object('error','Ya tienes una cuenta. Inicia sesión o solicita recuperar acceso.','status',409);
  end if;
  select * into claim from private.registration_claims where rut=p_rut for update;
  if found and (claim.claimed_at is not null or claim.expires_at>now_at) then
    return jsonb_build_object('error','Hay un registro en curso. Espera unos minutos o inicia sesión.','status',409);
  end if;
  insert into private.registration_claims(rut,request_id,expires_at) values(p_rut,p_request_id,now_at+interval '5 minutes')
  on conflict(rut) do update set request_id=excluded.request_id,expires_at=excluded.expires_at,claimed_at=null;
  return jsonb_build_object('ok',true,'role',identity->>'role');
end;
$$;
revoke all on function public.reserve_roster_registration(text,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_roster_registration(text,uuid,text) to service_role;

create function public.release_roster_registration(p_rut text,p_request_id uuid) returns void
language sql security invoker set search_path='' as $$
  delete from private.registration_claims where rut=p_rut and request_id=p_request_id and claimed_at is null;
$$;
revoke all on function public.release_roster_registration(text,uuid) from public,anon,authenticated;
grant execute on function public.release_roster_registration(text,uuid) to service_role;

-- Auth's internal insert trigger must bypass RLS to provision its own profile.
-- It has no public EXECUTE grant, no password access, and never trusts user_metadata
-- for a self-registration's name, RUT or role. The reservation is rechecked inside
-- the same Auth transaction: blocking a worker/control during registration aborts it.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  requested_role text:=coalesce(new.raw_app_meta_data->>'role','seller');
  registration_id uuid; rut_value text; identity jsonb; name_value text;
  join_value date:=current_date; supervisor_value uuid; manager_value uuid;
begin
  if new.raw_app_meta_data ? 'roster_registration' then
    registration_id:=(new.raw_app_meta_data->>'roster_registration')::uuid;
    rut_value:=new.raw_app_meta_data->>'roster_rut';
    perform pg_advisory_xact_lock(hashtextextended('registration:'||rut_value,0));
    perform 1 from private.registration_claims where rut=rut_value and request_id=registration_id
      and expires_at>clock_timestamp() and claimed_at is null for update;
    if not found then raise exception 'Registration reservation is not valid'; end if;
    identity:=private.registration_identity(rut_value);
    if identity is null or identity->>'role' is distinct from requested_role
      or lower(new.email) is distinct from rut_value||'@pdr.internal' then
      raise exception 'Registration is not enabled';
    end if;
    name_value:=identity->>'name';
    join_value:=coalesce((identity->>'join_date')::date,current_date);
    select p.id into supervisor_value from public.commercial_workers me
      join public.commercial_workers parent on parent.id=me.coordinator_id
      join public.profiles p on p.rut=parent.rut where me.rut=rut_value;
    select p.id into manager_value from public.commercial_workers me
      join public.commercial_workers parent on parent.id=me.manager_id
      join public.profiles p on p.rut=parent.rut where me.rut=rut_value;
    update private.registration_claims set claimed_at=clock_timestamp() where rut=rut_value and request_id=registration_id;
  else
    -- Existing admin-users supplies immutable app_metadata.role. Client signUp
    -- cannot supply app_metadata and must not bypass the roster endpoint if the
    -- project's global signup setting is accidentally enabled in the future.
    if not (new.raw_app_meta_data ? 'role') or requested_role not in ('seller','coordinator','sales_manager','audiovisual','admin') then
      raise exception 'Registration requires server provisioning';
    end if;
    rut_value:=nullif(lower(regexp_replace(coalesce(new.raw_user_meta_data->>'rut',''),'[^0-9kK]','','g')),'');
    name_value:=coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),split_part(new.email,'@',1));
  end if;
  insert into public.profiles(id,full_name,email,rut,role,must_change_password,join_date,supervisor_id,sales_manager_id)
  values(new.id,name_value,lower(new.email),rut_value,requested_role,
    coalesce((new.raw_app_meta_data->>'must_change_password')::boolean,false),join_value,supervisor_value,manager_value);
  if requested_role='seller' then insert into public.executive_metrics(user_id) values(new.id); end if;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public,anon,authenticated,service_role;

create function public.admin_registration_roster() returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(item order by item->>'name'),'[]'::jsonb) from (
    select jsonb_build_object('rut',w.rut,'name',w.name,'role',w.role,'enabled',coalesce(c.enabled,true),
      'eligible',w.active and w.status='active','registered',p.id is not null,'audiovisual',false) as item
    from public.commercial_workers w left join public.registration_controls c on c.rut=w.rut
    left join public.profiles p on p.rut=w.rut
    where (select private.is_admin()) and w.rut is not null and c.audiovisual_name is null
    union all
    select jsonb_build_object('rut',c.rut,'name',c.audiovisual_name,'role','audiovisual','enabled',c.enabled,
      'eligible',true,'registered',p.id is not null,'audiovisual',true)
    from public.registration_controls c left join public.profiles p on p.rut=c.rut
    where (select private.is_admin()) and c.audiovisual_name is not null
  ) as roster;
$$;
revoke all on function public.admin_registration_roster() from public,anon;
grant execute on function public.admin_registration_roster() to authenticated;

commit;
