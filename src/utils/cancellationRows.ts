import type {SheetMetrics} from '../services/individualSheetParser';
export interface WorkerMetricRow {worker_id:string;source_row:number;metrics:SheetMetrics}
// The source has an annual-cancellation table and a separate last-sale table.
// Names/aliases may resolve to the same roster ID only after the identity join.
export function canonicalCancellationRows(rows:WorkerMetricRow[]):WorkerMetricRow[]{
 const merged=new Map<string,WorkerMetricRow>();
 for(const row of rows){
  const old=merged.get(row.worker_id);
  if(!old){merged.set(row.worker_id,{...row,metrics:{...row.metrics}});continue;}
  const a=Number(old.metrics.cancellationUf??0),b=Number(row.metrics.cancellationUf??0);
  if(a!==0&&b!==0)throw Error('Dos totales de anulaciones para una misma identidad. Revisa la fuente.');
  old.metrics.cancellationUf=a+b;
  const last=[old.metrics.lastSaleDate,row.metrics.lastSaleDate].filter((v):v is string=>typeof v==='string').sort().at(-1);
  if(last){old.metrics.lastSaleDate=last;delete old.metrics.daysWithoutSaleText;}
  else if(row.metrics.daysWithoutSaleText==='Sin ventas'||!old.metrics.daysWithoutSaleText){
   if(row.metrics.daysWithoutSaleText)old.metrics.daysWithoutSaleText=row.metrics.daysWithoutSaleText;
  }
 }
 return [...merged.values()];
}
