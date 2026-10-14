begin;
-- Preserve main's opaque comparative ranking IDs after adding CURSO totals.
do $$declare definition text;begin
 definition:=pg_get_functiondef('private.sheet_ranking(text,text)'::regprocedure);
 if strpos(definition,'''userId'',id,''name''')=0 or strpos(definition,'''teamId'',id')=0 then
  raise exception 'Review ranking definition before restoring opaque IDs';
 end if;
 definition:=replace(definition,'''userId'',id,''name''','''userId'',(select w.ranking_id from public.commercial_workers w where w.id=ranked.id),''name''');
 definition:=replace(definition,'''teamId'',id','''teamId'',(select w.ranking_id from public.commercial_workers w where w.id=ranked.id)');
 execute definition;
end $$;

-- Installed 1.2 clients read this view. Both old and new clients must see the
-- same explicitly selected current/previous uploads, never the archive.
create or replace view public.active_worker_metrics with(security_invoker=true) as
 select m.worker_id,m.metrics,m.source_row,u.*
 from public.sheet_metrics m join public.sheet_uploads u on u.id=m.upload_id
 join public.current_sheet_uploads c on c.upload_id=u.id and c.source=u.source and c.goal_slot=u.goal_slot;
revoke all on public.active_worker_metrics from public,anon;
grant select on public.active_worker_metrics to authenticated;

insert into public.goal_sheet_slots(source,slot,upload_id)
 select source,goal_slot,upload_id from public.current_sheet_uploads where source in('category','senior')
 on conflict(source,slot)do update set upload_id=excluded.upload_id;
create function private.sync_legacy_goal_slot() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.source in('category','senior') then
  insert into public.goal_sheet_slots(source,slot,upload_id)values(new.source,new.goal_slot,new.upload_id)
   on conflict(source,slot)do update set upload_id=excluded.upload_id;
 end if;
 return new;
end $$;
revoke all on function private.sync_legacy_goal_slot() from public,anon,authenticated;
create trigger sync_legacy_goal_slot after insert or update on public.current_sheet_uploads
 for each row execute function private.sync_legacy_goal_slot();

-- Retain main's replacement policy for non-goal uploads and the single roster.
-- Goal audit history is retained, but is not returned by the active view.
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.publish_individual_sheet(jsonb,jsonb)'::regprocedure);
 if strpos(definition,'return new_id;')=0 then raise exception 'Review individual publisher before restoring replacement policy';end if;
 definition:=replace(definition,'return new_id;',$replacement$
 if p_upload->>'source' not in('category','senior') then
  delete from public.sheet_metrics m using public.sheet_uploads u
   where m.upload_id=u.id and u.source=p_upload->>'source' and u.id<>new_id;
  delete from public.sheet_uploads where source=p_upload->>'source' and id<>new_id;
 end if;
 return new_id;
$replacement$);
 execute definition;
 definition:=pg_get_functiondef('private.publish_dotacion(jsonb,jsonb)'::regprocedure);
 if strpos(definition,'return new_id;')=0 then raise exception 'Review roster publisher before restoring retention policy';end if;
 definition:=replace(definition,'return new_id;',$replacement$
 delete from private.dotacion_uploads where id<>new_id;
 update private.dotacion_uploads set previous_workers='[]'::jsonb where id=new_id;
 return new_id;
$replacement$);
 execute definition;
end $$;
commit;
