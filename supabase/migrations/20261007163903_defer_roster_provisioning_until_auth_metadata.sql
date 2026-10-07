begin;

-- GoTrue's adminUserCreate inserts auth.users, then updates app_metadata in the
-- SAME transaction. The immediate INSERT trigger saw no trusted role/token and
-- rejected every API-created account. Validate the FINAL row at commit instead.
-- The endpoint, roster checks, roles, grants and password policy are unchanged.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  provisioned auth.users%rowtype; requested_role text;
  registration_id uuid; rut_value text; identity jsonb; name_value text;
  join_value date:=current_date; supervisor_value uuid; manager_value uuid;
begin
  select * into provisioned from auth.users where id=new.id;
  if not found then return new; end if;
  requested_role:=coalesce(provisioned.raw_app_meta_data->>'role','seller');
  if provisioned.raw_app_meta_data ? 'roster_registration' then
    registration_id:=(provisioned.raw_app_meta_data->>'roster_registration')::uuid;
    rut_value:=provisioned.raw_app_meta_data->>'roster_rut';
    perform pg_advisory_xact_lock(hashtextextended('registration:'||rut_value,0));
    perform 1 from private.registration_claims where rut=rut_value and request_id=registration_id
      and expires_at>clock_timestamp() and claimed_at is null for update;
    if not found then raise exception 'Registration reservation is not valid'; end if;
    identity:=private.registration_identity(rut_value);
    if identity is null or identity->>'role' is distinct from requested_role
      or lower(provisioned.email) is distinct from rut_value||'@pdr.internal' then
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
    update private.registration_claims set claimed_at=clock_timestamp()
      where rut=rut_value and request_id=registration_id;
  else
    -- Preserve server-admin provisioning. A client cannot set app_metadata.
    -- Missing or untrusted metadata still aborts the entire Auth transaction.
    if not (provisioned.raw_app_meta_data ? 'role')
      or requested_role not in ('seller','coordinator','sales_manager','commercial_manager','sales_director','audiovisual','admin') then
      raise exception 'Registration requires server provisioning';
    end if;
    rut_value:=nullif(lower(regexp_replace(coalesce(provisioned.raw_user_meta_data->>'rut',''),'[^0-9kK]','','g')),'');
    name_value:=coalesce(nullif(trim(provisioned.raw_user_meta_data->>'name'),''),split_part(provisioned.email,'@',1));
  end if;
  insert into public.profiles(id,full_name,email,rut,role,must_change_password,join_date,supervisor_id,sales_manager_id)
  values(provisioned.id,name_value,lower(provisioned.email),rut_value,requested_role,
    coalesce((provisioned.raw_app_meta_data->>'must_change_password')::boolean,false),join_value,supervisor_value,manager_value);
  if requested_role='seller' then insert into public.executive_metrics(user_id) values(provisioned.id); end if;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public,anon,authenticated,service_role;

drop trigger on_auth_user_created on auth.users;
create constraint trigger on_auth_user_created after insert on auth.users
  deferrable initially deferred for each row execute function private.handle_new_user();

insert into supabase_migrations.schema_migrations(version,name)
values('20261007163903','defer_roster_provisioning_until_auth_metadata')
on conflict(version) do nothing;

commit;
