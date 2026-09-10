import {supabase} from './supabase';
import {searchName,SheetImport,SheetMetrics,SheetSource} from './individualSheetParser';
import {DashboardData,EmploymentStatus,MetricSnapshot,User,UserRole} from '@/types';
import {normalizeRut} from '@/utils/rut';

export interface WorkerRow {
 id:string;rut:string|null;name:string;aliases:string[];role:Exclude<UserRole,'admin'>;active:boolean;status:EmploymentStatus;
 coordinator_id:string|null;manager_id:string|null;birth_date:string|null;join_date:string|null;
}
interface MetricRow {id:string;worker_id:string;source:SheetSource;metrics:SheetMetrics;label:string;period_start:string;period_end:string;published_at:string;sheet_name:string;senior_status:'open'|'closed'|null;rules:{label:string;uf:number;smad:number;prize:number}[]}
export function remainingUfTarget(uf:number|undefined,remaining:unknown):number|undefined {
 if(uf===undefined)return undefined;
 const text=String(remaining??'');
 if(/tramo m[aá]ximo/i.test(text))return Math.max(uf,0);
 const match=/faltan\s+([\d]+(?:[.,]\d+)?)\s*UF\b/i.exec(text);
 return match?Math.max(uf,0)+Number(match[1].replace(',','.')):undefined;
}
export function workerUser(w:WorkerRow):User {
 return {id:w.id,rut:w.rut??'',name:w.name,role:w.role,active:w.active,employmentStatus:w.status,teamId:w.coordinator_id??'',supervisorId:w.coordinator_id??'',salesManagerId:w.manager_id??'',avatar:'',email:'',joinDate:w.join_date??'',birthDate:w.birth_date??undefined,mustChangePassword:false};
}
async function allRows<T>(table:string):Promise<T[]> {
 if(!supabase)throw Error('Supabase no está configurado.');
 const rows:T[]=[];
 for(let start=0;;start+=500){let query=supabase.from(table).select('*').order(table==='current_worker_metrics'?'worker_id':'id');if(table==='current_worker_metrics')query=query.order('source');const r=await query.range(start,start+499);if(r.error)throw Error(r.error.message);rows.push(...r.data as T[]);if(r.data.length<500)return rows;}
}
export const individualSheetService={
 async search(query:string,role:string):Promise<WorkerRow[]>{
  if(!supabase)throw Error('Conecta Supabase para ver trabajadores reales.');
  const r=await supabase.rpc('search_commercial_workers',{p_query:query,p_role:role});if(r.error)throw Error(r.error.message);return r.data??[];
 },
 async publish(parsed:SheetImport,filename:string,label:string,start:string,end:string,status?:'open'|'closed'){
  if(!supabase)throw Error('Supabase no está configurado.');
  if(parsed.errors.length)throw Error('Corrige los errores del archivo antes de publicar.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)throw Error('Revisa las fechas del período.');
  const workers=await allRows<WorkerRow>('commercial_workers');
  const records=parsed.records.map(row=>{
   const found=workers.filter(w=>row.rut?w.rut===row.rut:w.role===row.role&&[w.name,...(w.aliases??[])].some(n=>searchName(n)===searchName(row.name)));
   if(found.length!==1)throw Error(`No hay una identidad única en dotación para ${row.name}. Revisa su RUT o nombre antes de cargar.`);
   return {worker_id:found[0].id,metrics:row.values,source_row:row.row};
  });
  const r=await supabase.rpc('publish_individual_sheet',{p_upload:{source:parsed.source,filename,sheet_name:parsed.sheet,label,period_start:start,period_end:end,senior_status:parsed.source==='senior'?status:null,rules:parsed.rules},p_records:records});
  if(r.error)throw Error(r.error.message);return r.data as string;
 },
 async dashboard(user:User):Promise<DashboardData>{
  const [allWorkers,allMetrics]=await Promise.all([allRows<WorkerRow>('commercial_workers'),allRows<MetricRow>('current_worker_metrics')]);
  const self=allWorkers.find(w=>w.id===user.id||w.rut===normalizeRut(user.rut));
  if(user.role!=='admin'&&(!self||!self.active||self.status!=='active'))throw Error('Error al comunicar con el servidor');
  const workers=allWorkers.filter(w=>w.active&&w.status==='active'&&(user.role==='admin'||w.id===self?.id||self?.role==='coordinator'&&w.coordinator_id===self.id||self?.role==='sales_manager'&&w.manager_id===self.id));
  const ids=new Set(workers.map(w=>w.id));
  // Keep the authenticated UUID as the UI's own key, while roster joins use stable worker IDs.
  const uiId=(id:string|null)=>id===self?.id?user.id:id??'';
  const rows=allMetrics.filter(m=>ids.has(m.worker_id));
  const latest:DashboardData['latestByUser']={},annual:Record<string,number>={},monthly:Record<string,number>={},snapshots:MetricSnapshot[]=[];
  const senior=rows.find(m=>m.source==='senior');
  const seniorOpen=Boolean(senior&&senior.senior_status==='open'&&new Date().toLocaleDateString('en-CA',{timeZone:'America/Santiago'})<=senior.period_end);
  for(const [index,row]of rows.entries()){
   const id=uiId(row.worker_id),v=row.metrics;
   const m:Partial<MetricSnapshot>={};
   const num=(k:string)=>typeof v[k]==='number'?v[k] as number:undefined;
   if(row.source==='category'){m.category=String(v.level);m.categoryUf=num('uf');m.categoryRemaining=String(v.remaining);m.categoryTargetUf=remainingUfTarget(num('uf'),v.remaining);m.estimatedPrizeClp=num('prize');m.categoryLabel=row.label;}
   if(row.source==='senior'){
    m.cancellationUf=num('cancellationUf');m.smadCount=num('smad');m.restCount=num('rest');m.ssffCount=num('ssff');m.tenureMonths=num('tenureMonths');m.seniorStatus=seniorOpen?'open':'closed';
    // An open-canto file cannot silently become an emitted-only final result after closing.
    if(seniorOpen||row.senior_status==='closed'){m.eligibleTotalUf=num('uf');m.seniorLevel=String(v.level);m.seniorRemaining=String(v.remaining);m.seniorTargetUf=remainingUfTarget(num('uf'),v.remaining);}
    else{m.seniorRemaining='Pendiente de carga de cierre con ventas emitidas';}
   }
   if(row.source.startsWith('production_')){m.productivity=num('productivity');m.productionUf=num('uf');m.lastSaleDate=typeof v.lastSaleDate==='string'?v.lastSaleDate:undefined;}
   if(['titanes','rbh','msc'].includes(row.source)){m.debtInstallmentsCount=num('debtInstallments');m.debtUf08=num('debtUf08');m.debtSalesCount=num('debtSales');}
   if(row.source==='sauce')m.sauceRisk=num('risk');
   if(row.source==='ranking_annual'){annual[id]=num('emittedUf')??0;m.rankingPosition=num('position');}
   if(row.source==='ranking_monthly'){monthly[id]=num('emittedUf')??0;m.businessCount=num('businesses');}
   const snap:MetricSnapshot={id:index,batchId:row.id,userId:id,kind:row.source==='category'?'category':row.source==='senior'?'senior':row.source==='sauce'?'sauce':row.source.startsWith('ranking_')?'ranking':'commercial',periodStart:row.period_start,periodEnd:row.period_end,sourceName:row.sheet_name,publishedAt:row.published_at,...m};
   snapshots.push(snap);latest[id]={...latest[id],...Object.fromEntries(Object.entries(m).filter(([,value])=>value!==undefined))};
  }
  return {profiles:workers.map(w=>({...workerUser(w),id:uiId(w.id),supervisorId:uiId(w.coordinator_id),salesManagerId:uiId(w.manager_id)})),snapshots,latestByUser:latest,annualEmittedUfByUser:annual,monthlyEmittedUfByUser:monthly,periodLabel:rows.find(r=>r.source==='ranking_monthly')?.label??'Cargas independientes',seniorOpen};
 }
};
