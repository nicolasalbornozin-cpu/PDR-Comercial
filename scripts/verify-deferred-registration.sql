-- Synthetic fixtures; no passwords and no persistent accounts. Always ROLLBACK.
begin;
delete from private.registration_limits where key='global';
insert into public.commercial_workers(id,rut,name,role,active,status) values
 ('__deferred_seller','990100010','Registro QA Vendedor','seller',true,'active'),
 ('__deferred_coordinator','990100029','Registro QA Coordinador','coordinator',true,'active'),
 ('__deferred_sales_manager','990100037','Registro QA Jefe','sales_manager',true,'active'),
 ('__deferred_commercial_manager','990100045','Registro QA Comercial','commercial_manager',true,'active'),
 ('__deferred_sales_director','990100053','Registro QA Gerente','sales_director',true,'active');
insert into public.registration_controls(rut,enabled,audiovisual_name,updated_by)
select '990100061',true,'Registro QA Audiovisual',id from public.profiles where role='admin' and active limit 1;

do $$ declare rut_value text; role_value text; token uuid; user_id uuid; reservation jsonb;
begin
  for rut_value,role_value in select * from (values
    ('990100010','seller'),('990100029','coordinator'),('990100037','sales_manager'),
    ('990100045','commercial_manager'),('990100053','sales_director'),('990100061','audiovisual')
  ) as cases(rut,role) loop
    set constraints auth.on_auth_user_created deferred;
    token:=gen_random_uuid(); user_id:=gen_random_uuid();
    reservation:=public.reserve_roster_registration(rut_value,token,repeat('e',64));
    if reservation->>'ok' is distinct from 'true' then raise exception 'Reservation failed: %',reservation; end if;
    -- Match the REAL GoTrue API order: INSERT first, app_metadata UPDATE later.
    insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
    values(user_id,rut_value||'@pdr.internal','{"provider":"email"}',
      '{"name":"Forged name","role":"admin","rut":"forged"}');
    if exists(select 1 from public.profiles where id=user_id) then raise exception 'Provisioning ran before metadata'; end if;
    update auth.users set raw_app_meta_data=jsonb_build_object('role',role_value,
      'roster_registration',token,'roster_rut',rut_value,'must_change_password',false) where id=user_id;
    set constraints auth.on_auth_user_created immediate;
    if not exists(select 1 from public.profiles where id=user_id and rut=rut_value
        and role=role_value and full_name like 'Registro QA%') then raise exception 'Incorrect final profile'; end if;
    if not exists(select 1 from private.registration_claims where rut=rut_value and claimed_at is not null) then
      raise exception 'Claim was not consumed'; end if;
    reservation:=public.reserve_roster_registration(rut_value,gen_random_uuid(),repeat('f',64));
    if reservation->>'status' is distinct from '409' then raise exception 'Second registration allowed'; end if;
  end loop;
end $$;

do $$ declare blocked boolean; user_id uuid; token uuid;
begin
  -- No metadata and forged USER metadata may never authorize a profile.
  blocked:=false;
  begin
    set constraints auth.on_auth_user_created deferred;
    insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
      values(gen_random_uuid(),'990100070@pdr.internal','{"provider":"email"}','{"role":"admin"}');
    set constraints auth.on_auth_user_created immediate;
  exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'Unrestricted signup accepted'; end if;
  -- A supplied role without the exact service-only reservation is denied.
  blocked:=false;
  begin
    set constraints auth.on_auth_user_created deferred;
    user_id:=gen_random_uuid();
    insert into auth.users(id,email) values(user_id,'990100088@pdr.internal');
    update auth.users set raw_app_meta_data=jsonb_build_object('role','seller',
      'roster_registration',gen_random_uuid(),'roster_rut','990100088') where id=user_id;
    set constraints auth.on_auth_user_created immediate;
  exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'Missing reservation accepted'; end if;
  -- A valid token cannot be reused to create a second Auth identity.
  blocked:=false;
  begin
    set constraints auth.on_auth_user_created deferred;
    select request_id into token from private.registration_claims where rut='990100010';
    insert into auth.users(id,email,raw_app_meta_data) values(gen_random_uuid(),'other@pdr.internal',
      jsonb_build_object('role','seller','roster_registration',token,'roster_rut','990100010'));
    set constraints auth.on_auth_user_created immediate;
  exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'Consumed token reused'; end if;
  if has_function_privilege('anon','private.handle_new_user()','EXECUTE')
    or has_function_privilege('authenticated','private.handle_new_user()','EXECUTE') then
    raise exception 'Provisioning exposed to clients'; end if;
end $$;
select 'PASS: real Auth insert/update order; all 6 roles; authoritative identity; one-time activation; forged metadata, missing and reused claims denied' as result;
rollback;
