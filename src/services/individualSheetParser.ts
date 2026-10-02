import type { WorkBook } from 'xlsx';
import { isValidRut, normalizeRut } from '../utils/rut';

export const sheetSources = {
  category: { label: 'Catego', sheet: 'Carga Catego' },
  production_sellers: { label: 'Producción · vendedores', sheet: 'Resumen Vendedores' },
  production_coordinators: { label: 'Producción · coordinadores', sheet: 'Resumen Coordinadores' },
  senior: { label: 'Senior y anulaciones', sheet: 'CARGA Senior' },
  titanes: { label: 'Mora TITANES · Manuel Olmedo', sheet: 'Carga Titanes' },
  rbh: { label: 'Mora RBH · Rodolfo', sheet: 'Carga RBH' },
  msc: { label: 'Mora MSC · Mauricio', sheet: 'Carga MSC' },
  sauce: { label: 'Riesgo Sauce', sheet: 'Carga Sauce' },
  ranking_monthly: { label: 'Ranking mensual · ventas totales', sheet: 'Septiembre Comercial 26' },
  ranking_annual: { label: 'Ranking anual · ventas totales', sheet: 'BASE ANUAL' },
} as const;
export type SheetSource = keyof typeof sheetSources;
export type SheetMetrics = Record<string, string | number>;
export interface SheetRecord { rut?: string; name: string; role: 'seller' | 'coordinator'; values: SheetMetrics; row: number }
export interface SheetImport { source: SheetSource; sheet: string; records: SheetRecord[]; errors: string[]; warnings: string[]; rules: { label: string; uf: number; smad: number; prize: number }[] }
export function searchName(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\([^)]*\)/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function text(value: unknown): string { return String(value ?? '').trim().replace(/\s+/g, ' '); }
function number(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const s = text(value).replace(/\s/g, '').replace(/UF|\$|%/gi, '');
  if (!s || !/^-?[\d.,]+$/.test(s)) return undefined;
  const n = Number(s.includes(',') && s.includes('.') ? (s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')) : s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}
function date(value: unknown): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && value > 20000 && value < 100000) return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  const s = text(value); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return undefined;
}

const sheetAliases: Partial<Record<SheetSource, string[]>> = {
  sauce: ['Carga Sauce', 'Carga sause', 'Ranking Sauce Riesgo'],
};

// Only aggregate worker results are published; no operation or client rows are uploaded.
export function parseIndividualSheet(book: WorkBook, source: SheetSource, period?: {start:string;end:string}): SheetImport {
  if (source === 'ranking_annual' || source === 'ranking_monthly') return parseCantoRanking(book,source,period);
  const expectedSheets = sheetAliases[source] ?? [sheetSources[source].sheet];
  const sheet = expectedSheets.map(expected => book.SheetNames.find(n => searchName(n) === searchName(expected))).find(Boolean);
  const result: SheetImport = { source, sheet: sheet ?? sheetSources[source].sheet, records: [], errors: [], warnings: [], rules: [] };
  if (!sheet) { result.errors.push(`Falta la hoja «${result.sheet}».`); return result; }
  const ws = book.Sheets[sheet];
  const cells = Object.entries(ws).filter(([a]) => /^[A-Z]+\d+$/.test(a));
  const maxRow = cells.reduce((max, [a]) => Math.max(max, Number(a.replace(/\D/g, ''))), 1);
  if (maxRow > 100000) { result.errors.push('La hoja excede 100.000 filas.'); return result; }
  const get = (c: string, r: number, optional = false): unknown => {
    const cell = ws[`${c}${r}`];
    if (cell?.t === 'e') { (optional ? result.warnings : result.errors).push(`${sheet}!${c}${r}: error de Excel; dato pendiente, no se convierte en cero.`); return undefined; }
    if (cell?.f && cell.v === undefined) result.errors.push(`${sheet}!${c}${r}: fórmula sin resultado guardado.`);
    return cell?.v;
  };
  const numeric = (values: SheetMetrics, key: string, col: string, r: number, required = true) => {
    const raw = get(col, r, !required); const n = number(raw);
    if (n === undefined) { if (required) result.errors.push(`${sheet}!${col}${r}: falta un número válido para ${key}.`); }
    else values[key] = n;
  };
  const header = (col: string, expected: string[]) => {
    for (let r = 1; r <= 30; r++) if (expected.includes(searchName(ws[`${col}${r}`]?.v))) return r;
    result.errors.push(`No se reconoce el encabezado ${col} de «${sheet}». Conserva las columnas originales.`); return -1;
  };
  const debt = ['titanes', 'rbh', 'msc'].includes(source);
  // Several source versions retain old headings while moving actual data.
  const debtRutCol = ['L', 'M', 'N'].find(c => debt && Array.from({ length: Math.min(maxRow - 1, 12) }, (_, i) => i + 2)
    .filter(r => isValidRut(normalizeRut(ws[`${c}${r}`]?.v))).length >= 2) ?? 'L';
  const debtNameCol = String.fromCharCode(debtRutCol.charCodeAt(0) + 1);
  const shiftedDebt = debt && debtRutCol !== 'L';
  const shiftedCoordinator = source === 'production_coordinators' && Array.from({ length: 10 }, (_, i) => i + 3)
    .some(r => text(ws[`A${r}`]?.v) && searchName(ws[`A${r}`]?.v) === searchName(ws[`B${r}`]?.v) && number(ws[`C${r}`]?.v) === undefined && number(ws[`D${r}`]?.v) !== undefined);
  const sauceLoad = source === 'sauce' && searchName(sheet).startsWith('carga sau');
  const first = source === 'category' ? header('G', ['ejecutivo']) : source === 'senior' ? header('D', ['rut vendedor'])
    : source === 'production_sellers' ? header('A', ['rut vendedor']) : source === 'production_coordinators' ? header('A', ['coordinador'])
    : debt ? header('L', ['rut']) : source === 'sauce' ? header(sauceLoad ? 'B' : 'A', ['rut agente']) : header('A', ['puesto']);
  if (first < 0) return result;
  const seen = new Set<string>(); const aggregated = new Map<string, SheetRecord>(); const contracts = new Map<string, string>();
  const seniorEmission = new Map<string, number>();
  const seniorCancellation = new Map<string, number>();
  if (source === 'senior') {
    const summaryName = book.SheetNames.find(n => searchName(n) === 'resumen senior');
    const summary = summaryName ? book.Sheets[summaryName] : undefined;
    if (summary) {
      const summaryLast = Object.keys(summary).filter(a => /^[A-Z]+\d+$/.test(a)).reduce((max, a) => Math.max(max, Number(a.replace(/\D/g, ''))), 1);
      const summaryColumn = (pattern: RegExp) => Object.keys(summary).find(a => /^[A-Z]+3$/.test(a) && pattern.test(searchName(summary[a]?.v)))?.replace(/3$/, '');
      const emissionColumn = summaryColumn(/^emision/);
      const cancellationColumn = summaryColumn(/^anulacion/);
      for (let r = 4; r <= summaryLast; r++) {
        const rut = normalizeRut(summary[`E${r}`]?.v);
        const emitted = emissionColumn ? number(summary[`${emissionColumn}${r}`]?.v) : undefined;
        if (rut && emitted !== undefined && emitted >= 0) seniorEmission.set(rut, emitted);
        const cancellation = cancellationColumn ? number(summary[`${cancellationColumn}${r}`]?.v) : undefined;
        if (rut && cancellation !== undefined && cancellation >= 0) seniorCancellation.set(rut, cancellation);
      }
      result.warnings.push('Senior: se prioriza UF Emitida de CARGA Senior; el resumen por RUT solo respalda formatos anteriores.');
    } else {
      result.warnings.push('Senior no incluye Resumen Senior; el desglose emitido/sin emitir quedará sin dato.');
    }
  }
  for (let r = first + 1; r <= maxRow; r++) {
    const rowDebtRutCol = debt ? ['L','M','N'].find(c=>isValidRut(normalizeRut(ws[`${c}${r}`]?.v))) ?? debtRutCol : debtRutCol;
    const rowDebtNameCol=String.fromCharCode(rowDebtRutCol.charCodeAt(0)+1);
    const nameCol = source === 'category' ? 'G' : source === 'senior' ? 'C' : source === 'production_coordinators' ? 'A' : debt ? rowDebtNameCol : source === 'sauce' && sauceLoad ? 'C' : source.startsWith('ranking_') ? 'C' : 'B';
    const name = text(get(nameCol, r, true));
    if (!name || /^(total|no vigente|\*|0$)/i.test(name)) continue;
    const rutCol = source === 'category' || source === 'production_coordinators' ? null : source === 'senior' ? 'D' : debt ? rowDebtRutCol : source === 'sauce' && sauceLoad ? 'B' : source.startsWith('ranking_') ? 'B' : 'A';
    const rut = rutCol ? normalizeRut(text(get(rutCol, r))) : undefined;
    if (rutCol && (!rut || !isValidRut(rut))) { result.errors.push(`${sheet}, fila ${r}: RUT inválido de ${name}.`); continue; }
    const values: SheetMetrics = {};
    if (source === 'category') {
      numeric(values, 'smad', 'H', r); numeric(values, 'uf', 'I', r); numeric(values, 'prize', 'K', r, false);
      values.level = text(get('J', r)); values.remaining = text(get('L', r));
      const smadRemaining = /(?:Y\s+)?(\d+)\s*SMAD\b/i.exec(String(values.remaining));
      values.smadRemaining = smadRemaining ? Number(smadRemaining[1]) : 0;
      const emitted = number(get('M', r, true));
      if (emitted === undefined) result.errors.push(`${sheet}!M${r}: falta UF bruta emitida válida.`);
      else {
        values.emittedUf = emitted;
        values.notEmittedUf = Math.max(Number(values.uf ?? 0) - emitted, 0);
      }
    } else if (source === 'senior') {
      const reference = /Resumen Senior'?!\$?([A-Z]+)\$?(\d+)/i.exec(ws[`M${r}`]?.f ?? '');
      const summary = book.Sheets['Resumen Senior'];
      if (reference && summary && searchName(summary[`${reference[1]}3`]?.v) !== 'anulacion') result.errors.push(`${sheet}!M${r}: Anulaciones no apunta a la columna titulada Anulación de Resumen Senior.`);
      numeric(values, 'smad', 'E', r); numeric(values, 'rest', 'F', r); numeric(values, 'ssff', 'G', r);
      numeric(values, 'tenureMonths', 'H', r, false); numeric(values, 'uf', 'I', r);
      const cancellation = number(get('M', r, true));
      if (cancellation !== undefined) values.cancellationUf = cancellation;
      else if (rut && seniorCancellation.has(rut)) {
        values.cancellationUf = seniorCancellation.get(rut)!;
        result.warnings.push(`${sheet}!M${r}: enlace inválido; Anulación se recuperó de Resumen Senior por RUT.`);
      } else result.errors.push(`${sheet}!M${r}: falta Anulación válida y no se pudo recuperar por RUT.`);
      const requirements = text(get('J', r, true));
      values.level = text(get('K', r, true)) || 'Pendiente de corregir en Excel'; values.potentialLevel = requirements; values.remaining = text(get('L', r));
      const missing = (label: string) => Number(new RegExp(`FALTA(?:N)?\\s+(\\d+)\\s+${label}\\b`, 'i').exec(requirements)?.[1] ?? 0);
      values.smadRemaining = missing('SMAD');
      const directEmission = searchName(ws[`N${first}`]?.v) === 'uf emitida';
      const emitted = directEmission ? number(get('N', r, true)) : rut ? seniorEmission.get(rut) : undefined;
      if (directEmission && emitted === undefined) result.errors.push(`${sheet}!N${r}: falta UF emitida válida.`);
      if (searchName(ws[`O${first}`]?.v).startsWith('smad')) numeric(values, 'emittedSmad', 'O', r, false);
      if (searchName(ws[`P${first}`]?.v).includes('emision')) values.emittedLevel = text(get('P', r, true));
      if (emitted !== undefined) {
        values.emittedUf = emitted;
        values.notEmittedUf = Math.max(Number(values.uf ?? 0) - emitted, 0);
      }
    } else if (source === 'production_sellers' || source === 'production_coordinators') {
      const coord = source === 'production_coordinators';
      numeric(values, 'uf', coord ? shiftedCoordinator ? 'D' : 'C' : 'J', r); numeric(values, 'businesses', coord ? shiftedCoordinator ? 'E' : 'D' : 'K', r);
      numeric(values, 'productivity', coord ? shiftedCoordinator ? 'H' : 'G' : 'P', r);
      if (coord) { numeric(values, 'headcount', shiftedCoordinator ? 'G' : 'F', r); numeric(values, 'teamProduction', 'O', r); }
      else values.employmentStatus = text(get('F', r));
      const last = date(get(coord ? shiftedCoordinator ? 'J' : 'I' : 'L', r, true)); if (last) values.lastSaleDate = last;
      const days = get(coord ? shiftedCoordinator ? 'L' : 'K' : 'N', r); if (number(days) !== undefined) values.daysWithoutSale = number(days)!;
      else if (text(days)) values.daysWithoutSaleText = text(days);
    } else if (debt) {
      const contract = text(get('B', r));
      if (!contract) { result.errors.push(`${sheet}, fila ${r}: falta contrato para evitar duplicados.`); continue; }
      const status = searchName(get(rowDebtRutCol === 'L' ? 'G' : 'H', r));
      const fingerprint = JSON.stringify([rut,number(get('E',r)),text(get('F',r)),status]);
      if (contracts.has(contract)) { if (contracts.get(contract) !== fingerprint) result.errors.push(`${sheet}, fila ${r}: contrato repetido con valores distintos.`); continue; }
      contracts.set(contract, fingerprint);
      const a = aggregated.get(rut!) ?? { rut, name, role: 'seller' as const, row: r, values: { debtSales: 0, debtUf: 0, debtInstallments: 0, debtUf08: 0, debtSales08: 0 } };
      if (status === 'mora') {
        const uf = number(get('E', r)); if (uf === undefined || uf < 0) { result.errors.push(`${sheet}!E${r}: UF inválida.`); continue; }
        a.values.debtSales = Number(a.values.debtSales) + 1; a.values.debtUf = Number(a.values.debtUf) + uf;
        const q = number(get('F',r));
        if (/^0\s*[-–]\s*8\s*%?$/.test(text(get('F',r)))) {
          a.values.debtUf08 = Number(a.values.debtUf08) + uf; a.values.debtSales08 = Number(a.values.debtSales08) + 1;
        } else if (q === undefined || q < 0 || !Number.isInteger(q)) result.errors.push(`${sheet}!F${r}: cuotas morosas inválidas.`);
        else a.values.debtInstallments = Number(a.values.debtInstallments) + q;
      }
      aggregated.set(rut!, a); continue;
    } else if (source === 'sauce') {
      const column = sauceLoad ? 'E' : searchName(ws[`G${first}`]?.v).startsWith('actualizado') ? 'G' : 'D';
      numeric(values, 'risk', column, r, column === 'D');
      if (typeof values.risk === 'number' && /%/.test(ws[`${column}${r}`]?.z ?? '') && values.risk <= 1) values.risk *= 100;
      if (Number(values.risk) < 0 || Number(values.risk) > 100) result.errors.push(`${sheet}!${column}${r}: riesgo fuera de 0–100%.`);
    } else {
      numeric(values, 'position', 'A', r); numeric(values, 'emittedUf', 'F', r); numeric(values, 'businesses', 'G', r);
    }
    const id = rut ?? searchName(name);
    if (seen.has(id)) {
      const previous=result.records.find(record=>(record.rut??searchName(record.name))===id);
      if(source==='production_sellers'&&previous&&['uf','businesses','productivity'].every(key=>previous.values[key]===values[key])){
        if(String(values.lastSaleDate??'')>String(previous.values.lastSaleDate??'')){
          for(const key of ['lastSaleDate','daysWithoutSale','daysWithoutSaleText']){delete previous.values[key];if(values[key]!==undefined)previous.values[key]=values[key];}
        }
        result.warnings.push(`${sheet}, fila ${r}: mismo RUT y resultados financieros; se conserva una persona y su fecha de venta más reciente.`);
      }else result.errors.push(`${sheet}, fila ${r}: trabajador repetido con resultados distintos.`);
      continue;
    }
    seen.add(id); result.records.push({ rut, name, role: source === 'production_coordinators' ? 'coordinator' : 'seller', values, row: r });
  }
  if (debt) {
    result.records = [...aggregated.values()];
    result.warnings.push('Se agrupa por RUT. No se suben contratos, compromisos ni fechas de clientes. UF 0–8% es un único total.');
    if (shiftedDebt) result.warnings.push(`Formato detectado: RUT en ${debtRutCol}, vendedor en ${debtNameCol} y mora en H; grupo 0–8% en F.`);
  }
  if (source === 'category') {
    result.warnings.push('Catego: UF bruta emitida se toma directamente de la columna M de Carga Catego; sin emitir es UF bruta menos UF emitida, con mínimo cero.');
    for (let r = 1; r < first; r++) {
      const uf = number(get('C',r)), smad = number(get('E',r)), prize = number(get('F',r));
      if (uf !== undefined && smad !== undefined && prize !== undefined) result.rules.push({ label: text(get('B',r)).replace(/^[^A-Za-zÁÉÍÓÚÑ]+/u,''), uf, smad, prize });
    }
  }
  if (!result.records.length) result.errors.push('No hay trabajadores válidos en la hoja seleccionada.');
  if (source === 'sauce') result.warnings.push(sauceLoad ? 'Riesgo Sauce tomado de PORC RIESGO (columna E) de Carga Sauce.' : `Riesgo tomado de ${searchName(ws[`G${first}`]?.v).startsWith('actualizado') ? 'G' : 'D'} del formato anterior.`);
  if (source.startsWith('production_')) result.warnings.push('Se conserva la productividad calculada en el Excel. Sus UF históricas no se convierten en ventas emitidas anuales.');
  return result;
}

// Canto supplies date, seller and UF. TRIO alone supplies emission status.
// Canto can have several UF movements for an operation (e.g. an increase).
// They all contribute to total UF. The TRIO join never multiplies these rows.
function parseCantoRanking(book: WorkBook, source: 'ranking_annual'|'ranking_monthly', period?: {start:string;end:string}): SheetImport {
  const expected=source==='ranking_annual'?['BASE ANUAL']:['Septiembre Comercial 26','BASE ANUAL'];
  const sheet=expected.map(name=>book.SheetNames.find(n=>searchName(n)===searchName(name))).find(Boolean);
  const result:SheetImport={source,sheet:sheet??sheetSources[source].sheet,records:[],errors:[],warnings:[],rules:[]};
  if(!sheet){result.errors.push(`Falta la base de canto «${result.sheet}».`);return result;}
  if(!period||!/^\d{4}-\d{2}-\d{2}$/.test(period.start)||!/^\d{4}-\d{2}-\d{2}$/.test(period.end)||period.end<period.start){result.errors.push('Indica las fechas del ranking antes de seleccionar el archivo.');return result;}
  const trioName=book.SheetNames.find(n=>searchName(n)==='trio');
  if(!trioName){result.errors.push('Falta TRIO para obtener la emisión por operación.');return result;}
  const ws=book.Sheets[sheet],trio=book.Sheets[trioName];
  const columns=(s:WorkBook['Sheets'][string])=>Object.fromEntries(Object.entries(s).filter(([a])=>/^[A-Z]+1$/.test(a)).map(([a,cell])=>[searchName(cell.v),a.replace(/1$/,'')]));
  const cantoCols=columns(ws),trioCols=columns(trio);
  if(!['fecha canto','rut vendedor','vendedor','uf','n operacion','unidad negocio'].every(h=>cantoCols[h])||!['u neg','num ope','estado'].every(h=>trioCols[h])){result.errors.push('No se reconoce el formato de Canto o TRIO. Conserva sus encabezados originales.');return result;}
  const lastRow=(s:WorkBook['Sheets'][string])=>Object.keys(s).filter(a=>/^[A-Z]+\d+$/.test(a)).reduce((last,a)=>Math.max(last,Number(a.replace(/\D/g,''))),1);
  const cantoLast=lastRow(ws),trioLast=lastRow(trio);
  if(cantoLast>100000||trioLast>100000){result.errors.push('La base excede 100.000 filas.');return result;}
  const cell=(s:WorkBook['Sheets'][string],col:string,r:number)=>{const c=s[`${col}${r}`];if(c?.t==='e'||c?.f&&c.v===undefined){result.errors.push(`Fila ${r}, ${col}: fórmula sin resultado válido.`);return undefined;}return c?.v;};
  const states=new Map<string,Set<string>>();
  for(let r=2;r<=trioLast;r++){
    const op=text(cell(trio,trioCols['num ope'],r)),status=searchName(cell(trio,trioCols.estado,r));
    if(!op)continue;
    const known=states.get(op)??new Set<string>();known.add(status);states.set(op,known);
  }
  const operations=new Set<string>(),workers=new Map<string,SheetRecord>();let missing=0;
  for(let r=2;r<=cantoLast;r++){
    if(searchName(cell(ws,cantoCols['unidad negocio'],r))!=='lpsa')continue;
    const day=date(cell(ws,cantoCols['fecha canto'],r));
    if(!day){result.errors.push(`${sheet}, fila ${r}: fecha de canto inválida.`);continue;}
    if(day<period.start||day>period.end)continue;
    const rut=normalizeRut(cell(ws,cantoCols['rut vendedor'],r)),name=text(cell(ws,cantoCols.vendedor,r)),uf=number(cell(ws,cantoCols.uf,r)),op=text(cell(ws,cantoCols['n operacion'],r));
    if(!isValidRut(rut)&&searchName(ws[`${cantoCols.estado??'T'}${r}`]?.v)!=='vigente'){result.warnings.push(`${sheet}, fila ${r}: sin RUT y fuera de dotación vigente; se omite.`);continue;}
    if(!isValidRut(rut)||!name||uf===undefined||!op){result.errors.push(`${sheet}, fila ${r}: falta RUT, vendedor, UF u operación válida.`);continue;}
    const concreteOperation=/^\d+$/.test(op);
    const operationKey=concreteOperation?`${rut}:${op}`:`row:${r}`;
    const operationStates=concreteOperation?states.get(op):undefined;
    if(operationStates&&operationStates.size>1){result.errors.push(`TRIO: operación ${op} con estados contradictorios.`);continue;}
    const worker=workers.get(rut)??{rut,name,role:'seller',row:r,values:{totalUf:0,emittedUf:0,notEmittedUf:0,businesses:0}};
    worker.values.totalUf=Number(worker.values.totalUf)+uf;if(!operations.has(operationKey))worker.values.businesses=Number(worker.values.businesses)+1;
    operations.add(operationKey);
    if(operationStates?.has('emitido')||operationStates?.has('emitida'))worker.values.emittedUf=Number(worker.values.emittedUf)+uf;
    if(!operationStates)missing++;
    workers.set(rut,worker);
  }
  result.records=[...workers.values()].sort((a,b)=>Number(b.values.totalUf)-Number(a.values.totalUf)||a.name.localeCompare(b.name,'es'));
  for(const record of result.records){record.values.notEmittedUf=Math.max(Number(record.values.totalUf)-Number(record.values.emittedUf),0);record.values.position=1+result.records.filter(other=>Number(other.values.totalUf)>Number(record.values.totalUf)).length;}
  result.warnings.push(`Ranking por UF totales LPSA del ${period.start} al ${period.end}. Se cruza operación con TRIO; dotación vigente controla quién aparece y agrega vendedores sin ventas.`);
  if(missing)result.warnings.push(`${missing} operaciones no están en TRIO: cuentan en el total, no como emitidas.`);
  if(!result.records.length)result.errors.push('No hay ventas LPSA para este período.');
  return result;
}
