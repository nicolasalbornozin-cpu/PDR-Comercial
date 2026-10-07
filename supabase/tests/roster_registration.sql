-- Run after the new migration, inside the same BEGIN/ROLLBACK transaction.
-- Synthetic fixtures only: no passwords, sessions or persistent accounts.
-- Legacy cases supply final metadata on INSERT; flush immediately for assertions.
set constraints auth.on_auth_user_created immediate;
insert into public.commercial_workers(id,rut,name,role,active,status) values
 ('__reg_qa_seller','990000010','Registro QA Vendedor','seller',true,'active'),
 ('__reg_qa_coord','990000029','Registro QA Coordinador','coordinator',true,'active'),
 ('__reg_qa_manager','990000037','Registro QA Jefe','sales_manager',true,'active'),
 ('__reg_qa_blocked','990000045','Registro QA Inactivo','seller',false,'detached'),
 ('__reg_qa_leave','990000053','Registro QA Licencia','seller',true,'medical_leave'),
 ('__reg_qa_vacation','990000061','Registro QA Vacaciones','seller',true,'vacation');
insert into public.registration_controls(rut,enabled,audiovisual_name,updated_by)
select '990000070',true,'Registro QA Audiovisual',id from public.profiles where role='admin' and active limit 1;

do $$
declare result jsonb; token uuid; role_value text; rut_value text; blocked boolean:=false;
begin
 if has_function_privilege('anon','public.reserve_roster_registration(text,uuid,text)','EXECUTE')
   or has_function_privilege('authenticated','public.reserve_roster_registration(text,uuid,text)','EXECUTE')
   or has_function_privilege('anon','public.release_roster_registration(text,uuid)','EXECUTE')
   or has_function_privilege('authenticated','public.release_roster_registration(text,uuid)','EXECUTE') then
   raise exception 'Private registration RPC is exposed';
 end if;
 if has_table_privilege('anon','public.registration_controls','SELECT') then raise exception 'Controls exposed'; end if;
 if private.registration_identity('990000045') is not null
   or private.registration_identity('990000053') is not null
   or private.registration_identity('990000061') is not null
   or private.registration_identity('000000000') is not null then raise exception 'Invalid roster accepted'; end if;
 for rut_value,role_value in select * from (values ('990000010','seller'),('990000029','coordinator'),('990000037','sales_manager'),('990000070','audiovisual')) as cases(rut,role) loop
   token:=gen_random_uuid();
   result:=public.reserve_roster_registration(rut_value,token,repeat('a',64));
   if result->>'ok' is distinct from 'true' or result->>'role' is distinct from role_value then raise exception 'Wrong reservation: %',result; end if;
   insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
   values(gen_random_uuid(),rut_value||'@pdr.internal','{"name":"Forged name","role":"admin","rut":"forged"}',
     jsonb_build_object('role',role_value,'roster_registration',token,'roster_rut',rut_value));
   if not exists(select 1 from public.profiles where rut=rut_value and role=role_value and full_name like 'Registro QA%') then raise exception 'Wrong profile provisioning'; end if;
   if (select claimed_at is null from private.registration_claims where rut=rut_value) then raise exception 'Claim not consumed'; end if;
   result:=public.reserve_roster_registration(rut_value,gen_random_uuid(),repeat('b',64));
   if result->>'status' is distinct from '409' then raise exception 'Duplicate accepted: %',result; end if;
 end loop;
 -- Existing blocked account cannot be registered anew or unblocked by this path.
 update public.profiles set active=false where rut='990000010';
 result:=public.reserve_roster_registration('990000010',gen_random_uuid(),repeat('c',64));
 if result->>'status' is distinct from '403' then raise exception 'Blocked account accepted'; end if;
 update public.profiles set active=true where rut='990000010';
 -- Expiration and disabled eligibility are checked again by the Auth trigger.
 insert into private.registration_claims(rut,request_id,expires_at) values('990000053',gen_random_uuid(),now()-interval '1 minute');
 begin
   insert into auth.users(id,email,raw_app_meta_data)
   select gen_random_uuid(),rut||'@pdr.internal',jsonb_build_object('role','seller','roster_registration',request_id,'roster_rut',rut)
   from private.registration_claims where rut='990000053';
 exception when others then blocked:=true;
 end;
 if not blocked then raise exception 'Expired reservation accepted'; end if;
 blocked:=false;
 begin
   insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
   values(gen_random_uuid(),'990000088@pdr.internal','{"rut":"990000010","role":"admin"}','{"provider":"email"}');
 exception when others then blocked:=true;
 end;
 if not blocked then raise exception 'Unrestricted client signUp bypassed roster'; end if;
 -- Per-RUT throttle, even for an unknown RUT.
 for i in 1..6 loop result:=public.reserve_roster_registration('990000099',gen_random_uuid(),md5(i::text)||md5(i::text)); end loop;
 if result->>'status' is distinct from '429' then raise exception 'Missing RUT throttle: %',result; end if;
end;
$$;
set local role service_role;
select public.reserve_roster_registration('990000053',gen_random_uuid(),repeat('f',64)) as blocked_from_service_role;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where rut='990000010'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare blocked boolean:=false;
begin
 if (select count(*) from public.registration_controls)<>0 then raise exception 'Seller reads registration controls'; end if;
 if public.admin_registration_roster()<>'[]'::jsonb then raise exception 'Seller reads administrator roster'; end if;
 begin
  insert into public.registration_controls(rut,enabled,audiovisual_name,updated_by)
  values('990000099',true,'Unauthorized role',auth.uid());
 exception when insufficient_privilege then blocked:=true;
 end;
 if not blocked then raise exception 'Seller can enable Audiovisual'; end if;
end;
$$;
reset role;
select 'PASS: roster roles, authoritative names, one-time registration, disabled account, expiration, rate limit and private grants' as verification;
