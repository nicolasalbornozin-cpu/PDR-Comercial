-- Labels supplied by a monthly report belong to its upload, not to the roster.
do $migration$
declare
  validator text := pg_get_functiondef('private.valid_worker_metrics(jsonb)'::regprocedure);
  ranking text := pg_get_functiondef('private.sheet_ranking_v3(text,text,text,text)'::regprocedure);
  team_label constant text := 'coalesce(g.metrics->>''rankingTeamName'',w.team_name)';
begin
  if strpos(validator, '  elsif item.key = ''zeroSales'' then') = 0
     or strpos(ranking, 'coalesce(w.team_name,''Equipo sin nombre asignado''),null::text,w.team_name,') = 0
     or strpos(ranking, 'where p_mode=''teams'' and (') = 0 then
    raise exception 'Las funciones del ranking cambiaron. Revisar antes de migrar.';
  end if;
  execute replace(validator, '  elsif item.key = ''zeroSales'' then', $validation$  elsif item.key = 'rankingTeamName' then
   if jsonb_typeof(item.val) <> 'string' or (item.val#>>'{}') !~ '^[[:alnum:]][[:alnum:] ._-]{0,79}$' then return false; end if;
  elsif item.key = 'zeroSales' then$validation$);

  ranking := replace(ranking, 'coalesce(w.team_name,''Equipo sin nombre asignado''),null::text,w.team_name,',
    'coalesce(' || team_label || ',''Equipo sin nombre asignado''),null::text,' || team_label || ',');
  ranking := replace(ranking, $original$where p_mode='teams' and (
   (w.team_name is not null and exists(select 1 from published_groups))
   or (not exists(select 1 from published_groups) and w.role='coordinator' and w.active and w.status='active')
  )$original$, $replacement$where p_mode='teams' and (
   g.metrics ? 'rankingTeamName'
   or (not exists(select 1 from published_groups where metrics ? 'rankingTeamName') and (
     (w.team_name is not null and exists(select 1 from published_groups))
     or (not exists(select 1 from published_groups) and w.role='coordinator' and w.active and w.status='active')
   ))
  )$replacement$);
  if strpos(ranking, 'published_groups where metrics ? ''rankingTeamName''') = 0 then
    raise exception 'No se reconoció el filtro de equipos.';
  end if;
  execute ranking;
end;
$migration$;
