import type {WorkBook} from 'xlsx';
import type {SheetImport,SheetMetrics,SheetRecord} from './individualSheetParser';
import {isValidRut,normalizeRut} from '../utils/rut';

const key=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const name=(value:unknown)=>String(value??'').replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim();
function date(value:unknown):string|undefined{
 if(typeof value==='number'&&value>20000&&value<100000)return new Date(Date.UTC(1899,11,30)+value*86400000).toISOString().slice(0,10);
 if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);
 const text=String(value??'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;
 return undefined;
}
// A full workforce snapshot, never the FINIQUITADOS tab or HR free-text fields.
export function parseDotacion(book:WorkBook):SheetImport{
 const candidates=book.SheetNames.filter(n=>['dotacion','dotacion vig'].includes(key(n)));
 const sheet=candidates.find(n=>key(n)==='dotacion')??candidates[0];
 const result:SheetImport={source:'dotacion',sheet:sheet??'Dotacion',records:[],errors:[],warnings:[],rules:[]};
 if(!sheet){result.errors.push('Falta la hoja Dotacion o DOTACION VIG.');return result;}
 const ws=book.Sheets[sheet];
 const header=Array.from({length:30},(_,i)=>i+1).find(r=>key(ws[`A${r}`]?.v)==='rut'&&key(ws[`B${r}`]?.v)==='nombre');
 if(!header||key(ws[`E${header}`]?.v)!=='estado'||!['rut sup','rut supervisor'].includes(key(ws[`F${header}`]?.v))||key(ws[`H${header}`]?.v)!=='rut jv'||key(ws[`J${header}`]?.v)!=='nombre centro costo'){
  result.errors.push('Dotacion debe conservar las columnas RUT, Nombre, fechas, Estado, Rut Sup., coordinador, Rut JV, jefe y Nombre Centro Costo.');return result;
 }
 const last=Object.keys(ws).filter(a=>/^A\d+$/.test(a)).reduce((a,c)=>Math.max(a,Number(c.slice(1))),header);
 if(last>10000){result.errors.push('La dotación excede 10.000 filas.');return result;}
 const seen=new Set<string>();
 for(let r=header+1;r<=last;r++){
  if(!ws[`A${r}`]?.v&&!ws[`B${r}`]?.v)continue;
  const get=(c:string)=>{const cell=ws[`${c}${r}`];if(cell?.t==='e'||cell?.f&&cell.v===undefined)result.errors.push(`${sheet}!${c}${r}: dato sin resultado válido.`);return cell?.v;};
  const rut=normalizeRut(get('A')),person=name(get('B')),rawRole=key(get('J')),rawStatus=key(get('E'));
  const role:SheetRecord['role']|undefined=rawRole.includes('coordinador')?'coordinator':rawRole.includes('vendedor')?'seller':rawRole.includes('jefe')?'sales_manager':undefined;
  if(!isValidRut(rut)||!person||!role){result.errors.push(`${sheet}, fila ${r}: RUT, nombre o cargo inválido.`);continue;}
  if(seen.has(rut)){result.errors.push(`${sheet}, fila ${r}: RUT repetido.`);continue;}seen.add(rut);
  const status=rawStatus==='vigente'?'active':rawStatus.includes('licen')?'medical_leave':rawStatus.includes('vacacion')?'vacation':['finiquitado','desvinculado','no vigente'].includes(rawStatus)?'detached':undefined;
  if(!status){result.errors.push(`${sheet}, fila ${r}: estado no reconocido; no se habilitará por defecto.`);continue;}
  const values:SheetMetrics={status};
  for(const [col,field]of [['C','birth_date'],['D','join_date']]as const){const raw=get(col),parsed=date(raw);if(parsed)values[field]=parsed;else if(raw!==undefined&&raw!==null&&raw!=='')result.errors.push(`${sheet}!${col}${r}: fecha inválida.`);}
  for(const [col,field]of [['F','coordinator_rut'],['H','manager_rut']]as const){const raw=get(col);if(raw!==undefined&&raw!==null&&raw!==''){const parent=normalizeRut(raw);if(!isValidRut(parent))result.errors.push(`${sheet}!${col}${r}: RUT de jefatura inválido.`);else values[field]=parent;}}
  result.records.push({rut,name:person,role,values,row:r});
 }
 if(!result.records.length)result.errors.push('La dotación está vacía: no se puede publicar.');
 const byRut=new Map(result.records.map(r=>[r.rut,r]));
 for(const row of result.records){
  const coordinator=row.values.coordinator_rut,manager=row.values.manager_rut;
  if(row.role==='seller'&&(!coordinator||byRut.get(String(coordinator))?.role!=='coordinator'))result.errors.push(`Fila ${row.row}: coordinador ausente de la nómina.`);
  if(row.role!=='sales_manager'&&(!manager||byRut.get(String(manager))?.role!=='sales_manager'))result.errors.push(`Fila ${row.row}: jefe de ventas ausente de la nómina.`);
 }
 result.warnings.push('Nómina completa: las personas ausentes, con licencia o vacaciones quedan sin acceso. Se conservan las tres excepciones autorizadas y los administradores. No se cargan causas ni detalles de licencias.');
 return result;
}
