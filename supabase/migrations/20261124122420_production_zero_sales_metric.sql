-- The workbook distinguishes the zero-sales status from its business-count column.
do $$
declare
  definition text := pg_get_functiondef('private.valid_worker_metrics(jsonb)'::regprocedure);
  insertion text := '  elsif item.key in (''smad'',';
begin
  if private.valid_worker_metrics('{"zeroSales":0}'::jsonb) then return; end if;
  if strpos(definition, insertion) = 0 then
    raise exception 'No se encontró la lista de métricas del trabajador';
  end if;
  execute replace(definition, insertion,
    '  elsif item.key = ''zeroSales'' then
   if item.val not in (''0''::jsonb, ''1''::jsonb) then return false; end if;
' || insertion);
  if not private.valid_worker_metrics('{"zeroSales":1}'::jsonb)
     or private.valid_worker_metrics('{"zeroSales":2}'::jsonb)
     or private.valid_worker_metrics('{"zeroSales":"1"}'::jsonb) then
    raise exception 'Validación incorrecta de cero ventas';
  end if;
end $$;

