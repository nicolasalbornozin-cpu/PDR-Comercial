import {searchName, SheetRecord, SheetMetrics} from '../services/individualSheetParser';

interface ScopeWorker {id:string;name:string;display_name?:string|null;aliases?:string[];role:string}
interface UploadRow {worker_id:string;source_row:number;metrics:SheetMetrics}

export function matchHomeTotal(row: SheetRecord, workers: ScopeWorker[]): ScopeWorker[] {
  const key = (name:unknown) => searchName(name).replace(/^manuelo\b/, 'manuel').replace(/\bguissela\b/g,'guisela');
  const tokens = key(row.name).split(' ');
  if (tokens.length < 2) return [];
  const current = workers.filter(w => w.role === row.role && [w.name,w.display_name,...(w.aliases??[])].some(name => {
    const words = new Set(key(name).split(' '));
    return tokens.every(token => words.has(token));
  }));
  // A historical coordinator may now be a seller. Retain the labelled metric
  // against an exact identity without ever changing their current roster role.
  return current.length ? current : workers.filter(w => row.role==='coordinator' && [w.name,...(w.aliases??[])].some(name=>key(name)===key(row.name)));
}

export function mergeHomeTotals(records: UploadRow[], totals: SheetRecord[] | undefined, workers: ScopeWorker[]): UploadRow[] {
  const merged = new Map(records.map(row => [row.worker_id,{...row,metrics:{...row.metrics}}]));
  const seen = new Set<string>();
  for (const row of totals??[]) {
    const found = matchHomeTotal(row, workers);
    if (found.length !== 1) throw Error(`Totales de Inicio: no hay una identidad única en dotación para ${row.name}.`);
    const id = found[0].id;
    if (seen.has(id)) throw Error(`Totales de Inicio: dos filas corresponden a ${row.name}.`);
    seen.add(id);
    const previous = merged.get(id);
    merged.set(id,{worker_id:id,source_row:previous?.source_row??row.row,metrics:{...previous?.metrics,...row.values}});
  }
  return [...merged.values()];
}
