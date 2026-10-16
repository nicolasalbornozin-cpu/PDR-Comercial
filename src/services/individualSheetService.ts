import {supabase} from './supabase';
import {searchName,SheetImport,SheetMetrics,SheetSource} from './individualSheetParser';
import {DashboardData,EmploymentStatus,MetricSnapshot,User,UserRole} from '@/types';
import {normalizeRut} from '@/utils/rut';
import {categoryProgress,GoalRule,seniorProgress} from '@/utils/goalProgress';
import {canonicalCancellationRows} from '@/utils/cancellationRows';
import {mergeHomeTotals} from '@/utils/rankingHomeTotals';

export interface WorkerRow {
 id:string;rut:string|null;name:string;display_name?:string|null;aliases:string[];role:Exclude<UserRole,'admin'|'audiovisual'>;active:boolean;status:EmploymentStatus;
 coordinator_id:string|null;manager_id:string|null;birth_date:string|null;join_date:string|null;
}
interface MetricRow {id:string;worker_id:string;source:SheetSource;metrics:SheetMetrics;label:string;period_start:string;period_end:string;published_at:string;sheet_name:string;goal_slot?:'current'|'previous';senior_status:'open'|'closed'|null;rules:GoalRule[]}
function workerMatcher(workers:WorkerRow[]){
 const byRut=new Map<string,WorkerRow[]>(),byName=new Map<string,WorkerRow[]>();
 const add=(map:Map<string,WorkerRow[]>,key:string,w:WorkerRow)=>map.set(key,[...(map.get(key)??[]),w]);
 for(const w of workers){if(w.rut)add(byRut,w.rut,w);for(const name of new Set([w.name,w.display_name,...(w.aliases??[])].filter(Boolean).map(searchName)))add(byName,w.role+':'+name,w);}
 return (row:{rut?:string;role:string;name:string})=>(row.rut?byRut.get(row.rut):byName.get(row.role+':'+searchName(row.name)))??[];
}
export function remainingUfTarget(uf:number|undefined,remaining:unknown):number|undefined {
 if(uf===undefined)return undefined;
 const text=String(remaining??'');
 if(/tramo m[aá]ximo/i.test(text))return Math.max(uf,0);
 const match=/faltan\s+([\d]+(?:[.,]\d+)*)\s*UF\b/i.exec(text);
 if(!match)return undefined;
 const value=match[1].includes(',')?match[1].replaceAll('.','').replace(',','.'):match[1];
 const missing=Number(value);
 return Number.isFinite(missing)?Math.round((Math.max(uf,0)+missing)*100)/100:undefined;
}
export function workerUser(w:WorkerRow):User {
 return {id:String(w.id??''),rut:String(w.rut??''),name:String(w.name??''),displayName:w.display_name??undefined,role:w.role,active:w.active,employmentStatus:w.status,teamId:String(w.coordinator_id??''),supervisorId:String(w.coordinator_id??''),salesManagerId:String(w.manager_id??''),avatar:'',email:'',joinDate:String(w.join_date??''),birthDate:w.birth_date?String(w.birth_date):undefined,mustChangePassword:false};
}
async function allRows<T>(table:string):Promise<T[]> {
 if(!supabase)throw Error('Supabase no está configurado.');
 const rows:T[]=[];
 for(let start=0;;start+=500){let query=supabase.from(table).select('*').order(table==='active_worker_metrics'?'worker_id':'id');if(table==='active_worker_metrics')query=query.order('source').order('id');const r=await query.range(start,start+499);if(r.error)throw Error(r.error.message);rows.push(...r.data as T[]);if(r.data.length<500)return rows;}
}
function goalFields(source:'category'|'senior',v:SheetMetrics,seniorOpen:boolean,rules:GoalRule[]=[]):Partial<MetricSnapshot>{
 const num=(k:string)=>typeof v[k]==='number'?v[k] as number:undefined;
 if(source==='category'){
  const progress=categoryProgress(num('uf'),num('smad'),rules);
  return {category:String(v.level),categoryUf:num('uf'),categoryRemaining:String(v.remaining),categoryTargetUf:remainingUfTarget(num('uf'),v.remaining),estimatedPrizeClp:num('prize'),emittedUf:num('emittedUf'),notEmittedUf:num('notEmittedUf'),categoryEmittedUf:num('emittedUf'),categoryNotEmittedUf:num('notEmittedUf'),smadCount:num('smad'),smadRemaining:num('smadRemaining'),...progress,categorySmadCount:num('smad'),categorySmadRemaining:progress.smadRemaining??num('smadRemaining')};
 }
 const requirements=String(v.potentialLevel??'');
 const missing=(label:string)=>Number(new RegExp(`FALTA(?:N)?\\s+(\\d+)\\s+${label}\\b`,'i').exec(requirements)?.[1]??0);
 return {cancellationUf:num('cancellationUf'),smadCount:num('smad'),smadRemaining:num('smadRemaining')??missing('SMAD'),seniorSmadCount:num('smad'),seniorSmadRemaining:num('smadRemaining')??missing('SMAD'),restCount:num('rest'),restRemaining:missing('DESCANSO'),ssffCount:num('ssff'),ssffRemaining:missing('SSFF'),tenureMonths:num('tenureMonths'),seniorStatus:seniorOpen?'open':'closed',eligibleTotalUf:num('uf'),emittedUf:num('emittedUf'),notEmittedUf:num('notEmittedUf'),seniorEmittedUf:num('emittedUf'),seniorNotEmittedUf:num('notEmittedUf'),seniorLevel:String(v.level),seniorRemaining:String(v.remaining),seniorTargetUf:remainingUfTarget(num('uf'),v.remaining),...seniorProgress(num('uf'),num('smad'),num('rest'),num('ssff'),rules)};
}
export const individualSheetService={
 async publishBundle(items:{parsed:SheetImport;filename:string;label:string;start:string;end:string}[]){
  if(!supabase)throw Error('Supabase no está configurado.');
  const workers=await allRows<WorkerRow>('commercial_workers');const match=workerMatcher(workers);const skipped:string[]=[];
  const imports=items.map(({parsed,filename,label,start,end})=>{
   if(parsed.errors.length)throw Error('Corrige los errores antes de publicar.');
   let records=parsed.records.flatMap(row=>{
    const found=match(row);
    if(found.length===0){skipped.push(row.name);return [];}
    if(found.length!==1)throw Error(`Identidad ambigua: ${row.name}.`);
    return [{worker_id:found[0].id,source_row:row.row,metrics:row.values}];
   });
   if(parsed.source==='ranking_annual')records=mergeHomeTotals(records,parsed.homeTotals,workers);
   if(parsed.source==='cancellations'){
    records=canonicalCancellationRows(records);
    const present=new Set(records.map(r=>r.worker_id));
    for(const w of workers.filter(w=>w.role==='seller'&&w.active&&w.status==='active'&&!present.has(w.id)))records.push({worker_id:w.id,source_row:1,metrics:{cancellationUf:0}});
   }
   return {upload:{source:parsed.source,filename,sheet_name:parsed.sheet,label,period_start:start,period_end:end,rules:parsed.rules,goal_slot:'current'},records};
  });
  const result=await supabase.rpc('publish_sheet_bundle',{p_imports:imports});if(result.error)throw Error(result.error.message);
  return {published:imports.reduce((n,i)=>n+i.records.length,0),skipped};
 },
 async search(query:string,role:string):Promise<WorkerRow[]>{
  if(!supabase)throw Error('Conecta Supabase para ver trabajadores reales.');
  const r=await supabase.rpc('search_commercial_workers',{p_query:query,p_role:role});if(r.error)throw Error(r.error.message);return r.data??[];
 },
 async setDisplayLabel(id:string,label:string){
  if(!supabase)throw Error('Supabase no está configurado.');
  const clean=label.trim();if(!clean||clean.length>120)throw Error('El nombre debe tener entre 1 y 120 caracteres.');
  const r=await supabase.from('platform_settings').upsert({id,label:clean});if(r.error)throw Error(r.error.message);
 },
 async publish(parsed:SheetImport,filename:string,label:string,start:string,end:string,status?:'open'|'closed',goalSlot:'current'|'previous'='current'){
  if(!supabase)throw Error('Supabase no está configurado.');
  if(parsed.errors.length)throw Error('Corrige los errores del archivo antes de publicar.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)throw Error('Revisa las fechas del período.');
  if(parsed.source==='dotacion'){
   const records=parsed.records.map(row=>({rut:row.rut,name:row.name,role:row.role,status:row.values.status,birth_date:row.values.birth_date??null,join_date:row.values.join_date??null,coordinator_rut:row.values.coordinator_rut??null,manager_rut:row.values.manager_rut??null}));
   const r=await supabase.rpc('publish_dotacion',{p_upload:{filename,sheet_name:parsed.sheet,label,period_start:start,period_end:end},p_records:records});
   if(r.error)throw Error(r.error.message);return {id:r.data as string,published:records.length,skipped:[] as string[]};
  }
  const workers=await allRows<WorkerRow>('commercial_workers');
  const match=workerMatcher(workers);
  const skipped:string[]=[];
  let records=parsed.records.flatMap(row=>{
   const found=match(row);
   if(found.length===0&&['category','sauce','cancellations','ranking_annual','ranking_monthly','senior'].includes(parsed.source)){skipped.push(row.name);return [];}
   if(found.length!==1)throw Error(`No hay una identidad única en dotación para ${row.name}. Revisa su RUT o nombre antes de cargar.`);
   return [{worker_id:found[0].id,metrics:row.values,source_row:row.row}];
  });
  if(parsed.source==='ranking_annual')records=mergeHomeTotals(records,parsed.homeTotals,workers);
  // These are complete debt reports for one jefatura. Absence means no debt,
  // not an unknown value; keep active sellers with zero contracts visible.
  const debtManagerRut:Partial<Record<SheetSource,string>>={titanes:'10368000k',rbh:'124603005',msc:'83624663'};
  const manager=workers.find(w=>w.role==='sales_manager'&&w.rut===debtManagerRut[parsed.source]);
  if(manager){const included=new Set(records.map(r=>r.worker_id));for(const w of workers){if(w.role==='seller'&&w.active&&w.status==='active'&&w.manager_id===manager.id&&!included.has(w.id))records.push({worker_id:w.id,source_row:1,metrics:{debtSales:0,debtUf:0,debtInstallments:0,debtUf08:0,debtSales08:0}});}}
  if(!records.length)throw Error('No hay trabajadores de esta hoja en la dotación de la plataforma.');
  const r=await supabase.rpc('publish_individual_sheet',{p_upload:{source:parsed.source,filename,sheet_name:parsed.sheet,label,period_start:start,period_end:end,senior_status:parsed.source==='senior'?status:null,rules:parsed.rules,goal_slot:goalSlot},p_records:records});
  if(r.error)throw Error(r.error.message);return {id:r.data as string,published:records.length,skipped};
 },
 async dashboard(user:User):Promise<DashboardData>{
  const [allWorkers,allMetrics,settings,count]=await Promise.all([allRows<WorkerRow>('commercial_workers'),allRows<MetricRow>('active_worker_metrics'),allRows<{id:string;label:string}>('platform_settings'),supabase?.rpc('ranking_executive_count')]);
  if(count?.error)throw Error(count.error.message);
  const displayLabels=Object.fromEntries(settings.filter(s=>s.id&&s.label).map(s=>[s.id,s.label]));
  const self=allWorkers.find(w=>w.id===user.id||w.rut===normalizeRut(user.rut));
  if(user.role!=='admin'&&(!self||!self.active||self.status!=='active'))throw Error('Error 444');
  const totals=await supabase?.rpc('sales_scope_totals',{p_target:user.role==='admin'?null:self?.id??null});if(totals?.error)throw Error(totals.error.message);
  const workers=allWorkers.filter(w=>w.active&&w.status==='active'&&(user.role==='admin'||self?.role==='commercial_manager'||self?.role==='sales_director'||w.id===self?.id||self?.role==='coordinator'&&w.coordinator_id===self.id||self?.role==='sales_manager'&&w.manager_id===self.id));
  const ids=new Set(workers.map(w=>w.id));
  // Keep the authenticated UUID as the UI's own key, while roster joins use stable worker IDs.
  const uiId=(id:string|null)=>id===self?.id?user.id:id??'';
  const rows=allMetrics.filter(m=>ids.has(m.worker_id));
  const latest:DashboardData['latestByUser']={},annual:Record<string,number>={},monthly:Record<string,number>={},annualTotal:Record<string,number>={},monthlyTotal:Record<string,number>={},snapshots:MetricSnapshot[]=[];
  const senior=rows.find(m=>m.source==='senior'&&m.goal_slot!=='previous');
  const seniorOpen=Boolean(senior&&senior.senior_status==='open');
  for(const [index,row]of rows.entries()){
   const id=uiId(row.worker_id),v=row.metrics;
   const m:Partial<MetricSnapshot>={};
   const num=(k:string)=>typeof v[k]==='number'?v[k] as number:undefined;
   if(row.source==='category')Object.assign(m,goalFields('category',v,seniorOpen,row.rules),{categoryLabel:displayLabels[`category_${row.goal_slot??'current'}`]??row.label});
   if(row.source==='senior'){
    // Preserve uploaded Q3 figures as historical, never silently erase or relabel them as Q4.
    Object.assign(m,goalFields('senior',v,row.senior_status==='open',row.rules),{seniorLabel:displayLabels[`senior_${row.goal_slot??'current'}`]??row.label});
   }
   if(row.source.startsWith('production_')){m.productivity=num('productivity');m.productionUf=num('uf');if(!rows.some(r=>r.worker_id===row.worker_id&&r.source==='cancellations')){m.lastSaleDate=typeof v.lastSaleDate==='string'?v.lastSaleDate:undefined;m.daysWithoutSaleText=typeof v.daysWithoutSaleText==='string'?v.daysWithoutSaleText:undefined;} }
   if(row.source==='cancellations'){m.annualCancellationUf=num('cancellationUf');m.lastSaleDate=typeof v.lastSaleDate==='string'?v.lastSaleDate:undefined;m.daysWithoutSaleText=typeof v.daysWithoutSaleText==='string'?v.daysWithoutSaleText:undefined;}
   if(['titanes','rbh','msc'].includes(row.source)){m.debtInstallmentsCount=num('debtInstallments');m.debtUf08=num('debtUf08');m.debtSalesCount=num('debtSales');m.delinquentClientsCount=num('debtSales');}
   if(row.source==='sauce')m.sauceRisk=num('risk');
   if(row.source==='ranking_annual'){annual[id]=num('emittedUf')??0;if(num('totalUf')!==undefined)annualTotal[id]=num('totalUf')!;m.rankingPosition=num('position');}
   if(row.source==='ranking_monthly'){monthly[id]=num('emittedUf')??0;if(num('totalUf')!==undefined){monthlyTotal[id]=num('totalUf')!;m.monthlyTotalUf=num('totalUf');}m.businessCount=num('businesses');}
   const snap:MetricSnapshot={id:index,batchId:row.id,userId:id,goalSlot:row.source==='category'||row.source==='senior'?row.goal_slot??'current':undefined,kind:row.source==='category'?'category':row.source==='senior'?'senior':row.source==='sauce'?'sauce':row.source.startsWith('ranking_')?'ranking':'commercial',periodStart:row.period_start,periodEnd:row.period_end,sourceName:row.sheet_name,publishedAt:row.published_at,...m};
   snapshots.push(snap);
   if(row.goal_slot==='previous')continue;
   const merged={...latest[id],...Object.fromEntries(Object.entries(m).filter(([,value])=>value!==undefined))};
   if(['titanes','rbh','msc'].includes(row.source))for(const key of ['debtInstallmentsCount','debtUf08','debtSalesCount','delinquentClientsCount'] as const){if(m[key]!==undefined)merged[key]=(latest[id]?.[key]??0)+m[key]!;}
   latest[id]=merged;
  }
  // Explicit campaign rollover requested by the administrator. These are display placeholders,
  // not fabricated database imports. The first new upload replaces them automatically.
  for(const w of workers.filter(w=>w.role==='seller')){
   const id=uiId(w.id);
   for(const kind of ['category','senior'] as const){
    const current=rows.find(r=>r.worker_id===w.id&&r.source===kind&&r.goal_slot!=='previous');
    if(current)continue;
    const fields:Partial<MetricSnapshot>=kind==='category'
      ?{categoryLabel:displayLabels.category_current??'Catego vigente',category:'Sin categoría',categoryUf:0,emittedUf:0,notEmittedUf:0,smadCount:0,smadRemaining:undefined,categoryEmittedUf:0,categoryNotEmittedUf:0,categorySmadCount:0,categorySmadRemaining:undefined,categoryTargetUf:undefined,categoryRemaining:'Pendiente de cargar el nuevo período y sus tramos'}
      :{seniorLabel:displayLabels.senior_current??'Senior vigente',seniorLevel:'Sin carga vigente',eligibleTotalUf:undefined,seniorEmittedUf:undefined,seniorNotEmittedUf:undefined,seniorSmadCount:undefined,seniorSmadRemaining:undefined,seniorTargetUf:undefined,seniorRemaining:'Pendiente de cargar el período vigente y sus condiciones'};
    const marker='';
    snapshots.push({id:snapshots.length,batchId:`pending-${kind}`,userId:id,goalSlot:'current',kind,periodStart:marker,periodEnd:marker,sourceName:'Sin carga vigente',publishedAt:marker,goalPending:true,...fields});
    latest[id]={...latest[id],...fields};
   }
  }
  if(self&&Object.keys(annualTotal).length&&supabase){const ranking=await supabase.rpc('individual_sheet_ranking',{p_period:'annual',p_target:user.role==='admin'?null:self.id});if(ranking.error)throw Error(ranking.error.message);const own=ranking.data?.find((entry:{isCurrentUser:boolean})=>entry.isCurrentUser);if(own)latest[user.id]={...latest[user.id],rankingPosition:own.position};}
  return {profiles:workers.map(w=>({...workerUser(w),id:uiId(w.id),supervisorId:uiId(w.coordinator_id),salesManagerId:uiId(w.manager_id)})),snapshots,latestByUser:latest,annualEmittedUfByUser:annual,monthlyEmittedUfByUser:monthly,annualTotalUfByUser:annualTotal,monthlyTotalUfByUser:monthlyTotal,periodLabel:displayLabels.monthly_ranking??rows.find(r=>r.source==='ranking_monthly')?.label??'Cargas independientes',seniorOpen,displayLabels,rankingExecutiveCount:typeof count?.data==='number'?count.data:undefined,scopeSalesTotals:totals?.data?.scope,salesTotalsByScope:Object.fromEntries(Object.entries(totals?.data?.groups??{}).map(([id,value])=>[uiId(id),value])) as DashboardData['salesTotalsByScope']};
 }
};
