begin;
-- An admin sees the channel by default, even if their RUT also occurs as an
-- employee in Dotacion. Explicit admin previews keep their selected scope.
do $$declare signature regprocedure;definition text;marker text:='select * into me from public.commercial_workers';begin
 foreach signature in array array['private.sheet_ranking(text,text)'::regprocedure,'private.sales_scope_totals(text)'::regprocedure] loop
  definition:=pg_get_functiondef(signature);
  if strpos(definition,marker)=0 then raise exception 'Review scoped endpoint before updating admin default';end if;
  definition:=replace(definition,marker,'if profile_role=''admin'' and p_target is null then target_id:=null;end if;'||chr(10)||marker);
  execute definition;
 end loop;
end $$;
commit;
