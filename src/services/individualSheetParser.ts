import type { WorkBook } from 'xlsx';
import { isValidRut, normalizeRut } from '../utils/rut';
import {parseDotacion} from './dotacionParser';
import type {GoalRule} from '../utils/goalProgress';

export const sheetSources = {
  dotacion: { label: 'Dotacion · nómina y accesos', sheet: 'Dotacion (o DOTACION VIG)' },
  category: { label: 'Catego', sheet: 'Carga Catego' },
  production_sellers: { label: 'Producción · vendedores y coordinadores', sheet: 'produccion vendedores' },
  production_coordinators: { label: 'Producción · coordinadores', sheet: 'produccion coordinadores' },
  senior: { label: 'Senior y anulaciones', sheet: 'CARGA Senior' },
  titanes: { label: 'Mora TITANES · Manuel Olmedo', sheet: 'Carga Titanes' },
  rbh: { label: 'Mora RBH · Rodolfo', sheet: 'Carga RBH' },
  msc: { label: 'Mora MSC · Mauricio', sheet: 'Carga MSC' },
  sauce: { label: 'Riesgo Sauce', sheet: 'Carga Sauce' },
  ranking_monthly: { label: 'Ranking Plataforma · anual y mensual', sheet: 'Ranking del mes + emitido' },
  ranking_annual: { label: 'Ranking anual · ventas totales', sheet: 'BASE ANUAL' },
  cancellations: { label: 'Anulaciones anuales y última venta', sheet: 'anulaciones' },
} as const;
export type SheetSource = keyof typeof sheetSources;
export type SheetMetrics = Record<string, string | number>;
export interface SheetRecord { rut?: string; name: string; role: 'seller' | 'coordinator' | 'sales_manager'; values: SheetMetrics; row: number; summaryFallback?: boolean; teamName?: string }
export interface SheetImport { source: SheetSource; sheet: string; records: SheetRecord[]; homeTotals?: SheetRecord[]; period?: {start:string;end:string}; errors: string[]; warnings: string[]; rules: GoalRule[] }
export interface RankingImport {
  parsed: SheetImport;
  label: string;
  start: string;
  end: string;
  slot: 'current' | 'previous';
}
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
  production_sellers: ['produccion vendedores','Resumen Vendedores'],
  production_coordinators: ['produccion coordinadores','Resumen Coordinadores'],
};

// Only aggregate worker results are published; no operation or client rows are uploaded.
export function parseIndividualSheet(book: WorkBook, source: SheetSource, period?: {start:string;end:string}): SheetImport {
  if (source === 'dotacion') return parseDotacion(book);
  if (source === 'cancellations') return parseRankingCancellations(book,period);
  if (source === 'ranking_annual' || source === 'ranking_monthly') return parsePreparedRanking(book, source, period) ?? parseCantoRanking(book,source,period);
  if (source === 'production_sellers' || source === 'production_coordinators') {
    const commercial = parseCommercialProductivity(book,source);
    if (commercial) return commercial;
    const revised = parseRevisedProduction(book,source);
    if (revised) return revised;
  }
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
  const debtWithoutContract=debt&&searchName(ws.B1?.v)==='fecha contrato'&&searchName(ws.D1?.v)==='valor venta uf';
  // Several source versions retain old headings while moving actual data.
  const debtRutCol = ['K', 'L', 'M', 'N'].find(c => debt && Array.from({ length: Math.min(maxRow - 1, 12) }, (_, i) => i + 2)
    .filter(r => isValidRut(normalizeRut(ws[`${c}${r}`]?.v))).length >= 2) ?? 'L';
  const debtNameCol = String.fromCharCode(debtRutCol.charCodeAt(0) + 1);
  const shiftedDebt = debt && debtRutCol !== 'L';
  const shiftedCoordinator = source === 'production_coordinators' && Array.from({ length: 10 }, (_, i) => i + 3)
    .some(r => text(ws[`A${r}`]?.v) && searchName(ws[`A${r}`]?.v) === searchName(ws[`B${r}`]?.v) && number(ws[`C${r}`]?.v) === undefined && number(ws[`D${r}`]?.v) !== undefined);
  const sauceLoad = source === 'sauce' && searchName(sheet).startsWith('carga sau');
  const first = source === 'category' ? header('G', ['ejecutivo']) : source === 'senior' ? header('D', ['rut vendedor'])
    : source === 'production_sellers' ? header('A', ['rut vendedor']) : source === 'production_coordinators' ? header('A', ['coordinador'])
    : debt ? debtWithoutContract ? 1 : header('L', ['rut']) : source === 'sauce' ? header(sauceLoad ? 'B' : 'A', ['rut agente']) : header('A', ['puesto']);
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
    } else if(searchName(ws.N3?.v)!=='uf emitida') {
      result.warnings.push('Senior: falta la columna UF Emitida en la hoja de carga.');
    }
  }
  for (let r = first + 1; r <= maxRow; r++) {
    const rowDebtRutCol = debt ? ['K','L','M','N'].find(c=>isValidRut(normalizeRut(ws[`${c}${r}`]?.v))) ?? debtRutCol : debtRutCol;
    const rowDebtNameCol=String.fromCharCode(rowDebtRutCol.charCodeAt(0)+1);
    const nameCol = source === 'category' ? 'G' : source === 'senior' ? 'C' : source === 'production_coordinators' ? 'A' : debt ? rowDebtNameCol : source === 'sauce' && sauceLoad ? 'C' : source.startsWith('ranking_') ? 'C' : 'B';
    const name = text(get(nameCol, r, true));
    if(source==='category'&&searchName(name)==='sin dato en dotacion'){
      if(['I','M'].some(c=>Number(ws[`${c}${r}`]?.v??0)!==0))result.errors.push(`${sheet}, fila ${r}: UF sin identidad en dotación.`);
      else result.warnings.push(`${sheet}, fila ${r}: no hay una persona identificada ni UF; se omite.`);
      continue;
    }
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
      // New exports omit the operation identifier. Dates are NOT unique contract IDs.
      const contract = debtWithoutContract ? `row:${r}` : text(get('B', r));
      if (!contract) { result.errors.push(`${sheet}, fila ${r}: falta contrato para evitar duplicados.`); continue; }
      const ufCol=debtWithoutContract?'D':'E',quotaCol=debtWithoutContract?'E':'F';
      const status = searchName(get(debtWithoutContract?'G':rowDebtRutCol === 'L' ? 'G' : 'H', r));
      const fingerprint = JSON.stringify([rut,number(get(ufCol,r)),text(get(quotaCol,r)),status]);
      if (contracts.has(contract)) { if (contracts.get(contract) !== fingerprint) result.errors.push(`${sheet}, fila ${r}: contrato repetido con valores distintos.`); continue; }
      contracts.set(contract, fingerprint);
      const a = aggregated.get(rut!) ?? { rut, name, role: 'seller' as const, row: r, values: { debtSales: 0, debtUf: 0, debtInstallments: 0, debtUf08: 0, debtSales08: 0 } };
      if (status === 'mora') {
        const uf = number(get(ufCol, r)); if (uf === undefined || uf < 0) { result.errors.push(`${sheet}!${ufCol}${r}: UF inválida.`); continue; }
        a.values.debtSales = Number(a.values.debtSales) + 1; a.values.debtUf = Number(a.values.debtUf) + uf;
        const q = number(get(quotaCol,r));
        if (/^0\s*[-–]\s*8\s*%?$/.test(text(get(quotaCol,r)))) {
          a.values.debtUf08 = Number(a.values.debtUf08) + uf; a.values.debtSales08 = Number(a.values.debtSales08) + 1;
        } else if (q === undefined || q < 0 || !Number.isInteger(q)) result.errors.push(`${sheet}!${quotaCol}${r}: cuotas morosas inválidas.`);
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
    if(debtWithoutContract)result.warnings.push('Formato sin número de operación: cada fila de mora cuenta como un contrato. UF en D, cuotas/grupo 0–8% en E y mora en G; no se deduplica por fecha.');
    else if (shiftedDebt) result.warnings.push(`Formato detectado: RUT en ${debtRutCol}, vendedor en ${debtNameCol} y mora en H; grupo 0–8% en F.`);
  }
  if (source === 'category') {
    result.warnings.push('Catego: UF bruta emitida se toma directamente de la columna M de Carga Catego; sin emitir es UF bruta menos UF emitida, con mínimo cero.');
    for (let r = 1; r < first; r++) {
      const uf = number(get('C',r)), smad = number(get('E',r)), prize = number(get('F',r));
      if (uf !== undefined && smad !== undefined && prize !== undefined) result.rules.push({ label: text(get('B',r)).replace(/^[^A-Za-zÁÉÍÓÚÑ]+/u,''), uf, smad, prize });
    }
  }
  if(source==='senior'){
    const tramos=book.Sheets[book.SheetNames.find(n=>searchName(n)==='tramos')??''];
    if(tramos&&searchName(tramos.E4?.v)==='categoria'&&searchName(tramos.G4?.v)==='smad'){
      let label='';
      for(let r=5;r<=30;r++){
        if(tramos[`E${r}`]?.v)label=text(tramos[`E${r}`].v);
        const uf=number(tramos[`F${r}`]?.v),smad=number(tramos[`G${r}`]?.v),rest=number(tramos[`H${r}`]?.v),ssff=number(tramos[`I${r}`]?.v),prize=number(tramos[`J${r}`]?.v);
        if(label&&uf!==undefined&&smad!==undefined&&rest!==undefined&&ssff!==undefined&&prize!==undefined&&prize>0)result.rules.push({label,uf,smad,rest,ssff,prize});
      }
    }
  }
  if (!result.records.length) result.errors.push('No hay trabajadores válidos en la hoja seleccionada.');
  if (source === 'sauce') result.warnings.push(sauceLoad ? 'Riesgo Sauce tomado de PORC RIESGO (columna E) de Carga Sauce.' : `Riesgo tomado de ${searchName(ws[`G${first}`]?.v).startsWith('actualizado') ? 'G' : 'D'} del formato anterior.`);
  if (source.startsWith('production_')) result.warnings.push('Se conserva la productividad calculada en el Excel. Sus UF históricas no se convierten en ventas emitidas anuales.');
  return result;
}

// Preserve the saved ranking formulas (including monthly resciliations).
// No client/contract column or raw worksheet is included in these records.
function parsePreparedRanking(book: WorkBook, source: 'ranking_annual'|'ranking_monthly', period?: {start:string;end:string}): SheetImport | undefined {
  const names = book.SheetNames.map(name => ({ name, key: searchName(name) }));
  const total = source === 'ranking_annual'
    ? names.find(sheet => sheet.key === 'ranking anual total')
    : names.find(sheet=>sheet.key==='ranking mensual') ?? names.find(sheet => sheet.key === `ranking ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][Number(period?.start.slice(5,7))-1]}`);
  if (!total) return undefined;
  const emitted = names.find(sheet => source === 'ranking_annual' ? ['ranking anual emitido','ranking anual'].includes(sheet.key) : sheet.key === `${total.key} emitido`);
  const result: SheetImport = { source, sheet: total.name, records: [], errors: [], warnings: [], rules: [] };
  if (!period || !/^\d{4}-\d{2}-\d{2}$/.test(period.start) || !/^\d{4}-\d{2}-\d{2}$/.test(period.end) || period.end < period.start) {
    result.errors.push('Indica las fechas del ranking antes de seleccionar el archivo.'); return result;
  }
  const combined = hasCombinedRanking(book.Sheets[total.name]);
  if (!combined && !emitted) { result.errors.push('Falta el ranking emitido para comparar con el ranking total.'); return result; }
  const read = (name: string, columns = {rut:'E', name:'D', uf:'F', count:'G', position:'A'}) => {
    const ws = book.Sheets[name];
    const rows = Object.keys(ws).filter(a => new RegExp(`^${columns.rut}\\d+$`).test(a)).map(a => Number(a.slice(columns.rut.length))).sort((a,b) => a-b);
    const values = new Map<string, SheetRecord>();
    if (searchName(ws[columns.rut+'2']?.v) !== 'rut' || searchName(ws[columns.name+'2']?.v) !== 'vendedor' || !searchName(ws[columns.uf+'2']?.v).startsWith('uf')) {
      result.errors.push(`No se reconocen los encabezados de ${name}.`); return values;
    }
    for (const row of rows.filter(row => row > 2)) {
      const rawRut = ws[columns.rut+row]?.v;
      if (!text(rawRut)) continue;
      const rut = normalizeRut(rawRut), person = text(ws[columns.name+row]?.v);
      const ufCell = ws[columns.uf+row], businessesCell = ws[columns.count+row];
      const uf = number(ufCell?.v), businesses = number(businessesCell?.v);
      if (!isValidRut(rut) || !person || ufCell?.t === 'e' || businessesCell?.t === 'e' || uf === undefined || businesses === undefined || !Number.isInteger(businesses) || businesses < 0) {
        result.errors.push(`${name}, fila ${row}: identidad o resultado guardado inválido. Recalcula y guarda el Excel.`); continue;
      }
      if (values.has(rut)) { result.errors.push(`${name}, fila ${row}: RUT repetido.`); continue; }
      const position = number(ws[columns.position+row]?.v);
      values.set(rut, {rut, name:person, role:'seller', row, values:{uf, businesses, ...(position ? {position} : {})}});
    }
    return values;
  };
  const emittedName = combined ? total.name : emitted!.name;
  const totals = read(total.name), emissions = combined
    ? read(emittedName, {rut:'M', name:'L', uf:'N', count:'O', position:'I'})
    : read(emittedName);
  for (const [rut, row] of totals) {
    const issued = emissions.get(rut);
    if (!issued) { result.errors.push(`${emittedName}: falta el vendedor de la fila ${row.row} del ranking total.`); continue; }
    const totalUf = Number(row.values.uf), emittedUf = Number(issued.values.uf);
    result.records.push({...row, values:{totalUf, emittedUf, notEmittedUf:Math.max(totalUf-emittedUf,0), businesses:row.values.businesses,
      position:row.values.position??1+[...totals.values()].filter(other => Number(other.values.uf)>totalUf).length}});
  }
  if ([...emissions.keys()].some(rut => !totals.has(rut))) result.errors.push('Los rankings total y emitido no tienen la misma nómina.');
  if (!result.records.length) result.errors.push('No hay resultados válidos en los rankings.');
  if (source === 'ranking_annual') readAnnualHomeTotals(book.Sheets[total.name], result);
  if (source === 'ranking_monthly' && combined) readMonthlyHomeTotals(book, book.Sheets[total.name], period, result);
  return result;
}

const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function hasCombinedRanking(sheet: WorkBook['Sheets'][string]) {
  return searchName(sheet?.M2?.v) === 'rut' && searchName(sheet?.N2?.v) === 'uf emitidas';
}

export function parseRankingWorkbook(book: WorkBook, fallback: {start:string;end:string;year:string}): RankingImport[] {
  const annualSheet = book.SheetNames.find(name => searchName(name) === 'ranking anual total');
  const annualStart = annualSheet ? date(book.Sheets[annualSheet].B1?.v) : undefined;
  const year = annualStart?.slice(0,4) ?? fallback.year;
  const annual = {start:`${year}-01-01`,end:`${year}-12-31`};
  const monthlySheets = book.SheetNames.filter(name => months.some(month => searchName(name) === `ranking ${month}`) && hasCombinedRanking(book.Sheets[name]));
  const monthly = monthlySheets.map(name => {
    const ws = book.Sheets[name];
    const start = date(ws.B1?.v) ?? '';
    const end = date(ws.D1?.v) ?? '';
    const month = searchName(name).slice('ranking '.length);
    const parsed = parsePreparedRanking({...book, SheetNames:book.SheetNames.filter(candidate => !monthlySheets.includes(candidate) || candidate===name)},'ranking_monthly',{start,end});
    if (!parsed || months[Number(start.slice(5,7))-1] !== month || end < start) throw Error(`Revisa las fechas Desde / Hasta en «${name}».`);
    return {parsed,start,end,label:`${month[0].toUpperCase()+month.slice(1)} comercial ${start.slice(0,4)}`};
  }).sort((a,b)=>b.start.localeCompare(a.start));
  if (monthly[1] && monthly[1].end >= monthly[0].start) throw Error('El mes vigente y el anterior se superponen.');
  return [
    ...monthly.slice(0,2).map((item,index):RankingImport=>({...item,slot:index===0?'current':'previous'})),
    ...(!monthly.length?[{parsed:parseIndividualSheet(book,'ranking_monthly',fallback),start:fallback.start,end:fallback.end,label:'Mes comercial vigente',slot:'current' as const}]:[]),
    {parsed:parseIndividualSheet(book,'ranking_annual',annual),...annual,label:`Ranking anual ${year}`,slot:'current'},
    {parsed:parseRankingCancellations(book,annual),...annual,label:`Anulaciones ${year}`,slot:'current'},
  ];
}

function readMonthlyHomeTotals(book: WorkBook, ws: WorkBook['Sheets'][string], period:{start:string;end:string}, result:SheetImport) {
  const base = book.Sheets[book.SheetNames.find(n=>searchName(n)==='base anual')??''];
  if (!base || searchName(base.AN1?.v)!=='fecha de ranking' || searchName(base.AQ1?.v)!=='emitida' ||
    searchName(base.AR1?.v)!=='jefe de ventas normalizado' || searchName(base.AS1?.v)!=='coordinador normalizado') {
    result.errors.push('Faltan las columnas de fecha, emisión y alcance de BASE ANUAL.'); return;
  }
  const summary = new Map<string,{gross:number;emitted:number}>();
  const counts = Object.keys(base).filter(a=>/^AN\d+$/.test(a));
  for (const a of counts) {
    const row = Number(a.slice(2)), day = date(base[a]?.v);
    if (!day || day<period.start || day>period.end) continue;
    const uf = number(base['F'+row]?.v);
    const emission = number(base['AQ'+row]?.v);
    if (uf===undefined || (emission!==0 && emission!==1)) {
      result.errors.push(`BASE ANUAL, fila ${row}: UF o emisión sin resultado guardado.`); continue;
    }
    for (const col of ['AR','AS']) {
      const key = col+':'+searchName(base[col+row]?.v);
      const value = summary.get(key)??{gross:0,emitted:0};
      value.gross+=uf;
      if (emission===1) value.emitted+=uf;
      summary.set(key,value);
    }
  }
  const readMap = (person:string, label:string) => new Map(Array.from({length:30},(_,i)=>i+2).flatMap(row=>{
    const name=text(base[person+row]?.v);
    if (!name) return [];
    return [[searchName(base[label+row]?.v||name),name] as const];
  }));
  result.homeTotals = [];
  const rosterKey = (name: string) => searchName(name).replace(/\bguissela\b/g,'guisela');
  for (const {first,last,role,names,col} of [
    {first:3,last:10,role:'sales_manager',names:readMap('BM','BN'),col:'AR'},
    {first:14,last:43,role:'coordinator',names:readMap('BP','BQ'),col:'AS'},
  ] as const) {
    const included = new Set<string>();
    const emitRow = (name:string,row:number,gross:number,summaryFallback = false,teamName?:string) => {
      const key = searchName(name);
      const emitted = summary.get(col+':'+key)?.emitted??0;
      included.add(rosterKey(name));
      result.homeTotals!.push({name,role,row,summaryFallback,...(teamName?{teamName}:{}),values:{homeMonthlyGrossUf:gross,homeMonthlyEmittedUf:Math.round(emitted*100)/100}});
    };
    for (let row=first;row<=last;row++) {
      const label=text(ws['R'+row]?.v);
      if (!label) continue;
      const name=names.get(searchName(label))??label;
      const gross=number(ws['S'+row]?.v);
      const computed=summary.get(col+':'+searchName(name))?.gross;
      if (gross===undefined || computed===undefined || included.has(rosterKey(name))) {
        result.errors.push(`${result.sheet}, fila ${row}: falta un resultado de «${label}» o se repite el nombre.`); continue;
      }
      if (Math.abs(gross-computed)>0.011) {
        result.warnings.push(`${result.sheet}, fila ${row}: se conserva el bruto guardado para «${label}» (${gross} UF); BASE ANUAL suma ${Math.round(computed*100)/100} UF.`);
      }
      emitRow(name,row,gross,false,role==='coordinator'?label:undefined);
    }
    for (const name of new Set(names.values())) {
      if (included.has(rosterKey(name))) continue;
      const gross=summary.get(col+':'+searchName(name))?.gross??0;
      const teamName=role==='coordinator'?[...names.entries()].find(([,person])=>person===name)?.[0]:undefined;
      emitRow(name,first,Math.round(gross*100)/100,true,teamName);
    }
  }
}

// Read only the explicitly labelled worker-summary blocks. Never serialize raw
// worksheet columns, formulas, operation IDs or customer information.
function readAnnualHomeTotals(ws: WorkBook['Sheets'][string], result: SheetImport): void {
  const cells = Object.keys(ws).filter(a => /^[A-Z]+\d+$/.test(a));
  const titles = ['jefes','jefes de ventas','coordinadores'];
  const blocks = cells.filter(a => titles.includes(searchName(ws[a]?.v)));
  if (!blocks.length) {
    result.warnings.push('Sin tabla de totales de Inicio: se usarán las sumas del ranking para jefes y coordinadores.');
    return;
  }
  result.homeTotals = [];
  const seen = new Set<string>();
  for (const address of blocks) {
    const col = address.replace(/\d/g, ''), first = Number(address.replace(/\D/g, ''));
    const index = [...col].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
    const column = (n: number): string => n > 26 ? column(Math.floor((n - 1) / 26)) + String.fromCharCode(65 + (n - 1) % 26) : String.fromCharCode(64 + n);
    const grossCol = column(index + 1), emittedCol = column(index + 2);
    const role = searchName(ws[address]?.v) === 'coordinadores' ? 'coordinator' : 'sales_manager';
    const header = searchName(ws[grossCol+first]?.v)==='bruto' ? first : first+1;
    if (searchName(ws[grossCol+header]?.v) !== 'bruto' || searchName(ws[emittedCol+header]?.v) !== 'emitido') {
      result.errors.push(`Totales de Inicio: encabezados Bruto / Emitido inválidos junto a ${address}.`); continue;
    }
    let count = 0;
    for (let row = header + 1; row <= header + 501; row++) {
      const name = text(ws[`${col}${row}`]?.v);
      if (!name) break;
      if (titles.includes(searchName(name))) break;
      const gross = ws[`${grossCol}${row}`], emitted = ws[`${emittedCol}${row}`];
      const homeAnnualGrossUf = number(gross?.v), homeAnnualEmittedUf = number(emitted?.v);
      if (gross?.t === 'e' || emitted?.t === 'e' || homeAnnualGrossUf === undefined || homeAnnualEmittedUf === undefined) {
        result.errors.push(`Totales de Inicio, fila ${row}: recalcula y guarda los valores Bruto / Emitido.`); continue;
      }
      const key = role + ':' + searchName(name);
      if (seen.has(key)) { result.errors.push(`Totales de Inicio, fila ${row}: nombre repetido.`); continue; }
      seen.add(key); count++;
      result.homeTotals.push({name, role, row, values:{homeAnnualGrossUf, homeAnnualEmittedUf}});
    }
    if (!count) result.errors.push(`Totales de Inicio: tabla vacía junto a ${address}.`);
  }
  if (result.homeTotals.length) result.warnings.push(`Inicio: ${result.homeTotals.length} totales anuales de jefes y coordinadores tomados de Bruto / Emitido, sin descontar nuevamente anulaciones.`);
}

// Independent worker-only tables share a worksheet, not a business meaning.
// D/G:H/K measures annual annulments. M:N supplies last-sale dates, including
// workers with NO annulments. Never infer a last sale from a cancelled contract.
export function parseRankingCancellations(book:WorkBook,period?:{start:string;end:string}):SheetImport{
 const sheet=book.SheetNames.find(n=>searchName(n)==='anulaciones');
 const result:SheetImport={source:'cancellations',sheet:sheet??'anulaciones',records:[],errors:[],warnings:[],rules:[]};
 if(!sheet){result.errors.push('Falta la hoja anulaciones de Ranking Plataforma.');return result;}
 const ws=book.Sheets[sheet],year=Number(period?.start.slice(0,4));
 if(year&&searchName(ws.J1?.v)==='rut vendedor'&&searchName(ws.AC1?.v)==='fecha del descuento'&&searchName(ws.AD1?.v)==='uf a descontar'){
  const workers=new Map<string,SheetRecord>();
  for(const a of Object.keys(ws).filter(a=>/^AC\d+$/.test(a))){
   const row=Number(a.slice(2)),day=date(ws[a]?.v);
   if(!day?.startsWith(String(year)+'-'))continue;
   const rut=normalizeRut(ws['J'+row]?.v),name=text(ws['K'+row]?.v),amount=number(ws['AD'+row]?.v);
   if(!isValidRut(rut)||!name||amount===undefined||amount<0){result.errors.push(`${sheet}, fila ${row}: descuento o vendedor inválido.`);continue;}
   const record=workers.get(rut)??{rut,name,role:'seller' as const,row,values:{cancellationUf:0}};
   record.values.cancellationUf=Number(record.values.cancellationUf)+amount;
   workers.set(rut,record);
  }
  const bs=book.Sheets[book.SheetNames.find(n=>searchName(n)==='base anual')??''];
  if(bs&&searchName(bs.A1?.v)==='canto'&&searchName(bs.AV1?.v)==='operacion anulada'){
   for(const a of Object.keys(bs).filter(a=>/^A\d+$/.test(a))){
    const row=Number(a.slice(1)),day=date(bs[a]?.v);
    if(!day||day>period!.end||number(bs['AV'+row]?.v)!==0||(number(bs['F'+row]?.v)??0)<=0)continue;
    const rut=normalizeRut(bs['D'+row]?.v),name=text(bs['E'+row]?.v);
    if(!isValidRut(rut)||!name)continue;
    const record=workers.get(rut)??{rut,name,role:'seller' as const,row,values:{cancellationUf:0}};
    if(day>String(record.values.lastSaleDate??''))record.values.lastSaleDate=day;
    workers.set(rut,record);
   }
  }else result.warnings.push('Última venta queda a cargo de la carga de Producción.');
  result.records=[...workers.values()];
  if(!result.records.length)result.errors.push('No hay descuentos ni fechas de última venta para publicar.');
  return result;
 }
 if(!year||searchName(ws.G1?.v)!=='rut vendedor'||searchName(ws.M1?.v)!=='ejecutivo'||searchName(ws.N1?.v)!=='ultima venta'){
  result.errors.push('Anulaciones debe incluir RUT_VENDEDOR, VENDEDOR, UF, mes de envío, Ejecutivo y Última venta.');return result;
 }
 const last=Object.keys(ws).filter(a=>/^[A-Z]+\d+$/.test(a)).reduce((m,a)=>Math.max(m,Number(a.replace(/\D/g,''))),1);
 if(last>100000){result.errors.push('Anulaciones excede 100.000 filas.');return result;}
 const workers=new Map<string,SheetRecord>();
 const namesToRut=new Map<string,string>();
 const totals=book.Sheets[book.SheetNames.find(n=>searchName(n)==='ranking anual total')??''];
 if(totals)for(const address of Object.keys(totals).filter(a=>/^E\d+$/.test(a)&&Number(a.slice(1))>2)){
  const row=Number(address.slice(1)),rut=normalizeRut(totals[address]?.v),name=text(totals['D'+row]?.v);
  if(isValidRut(rut)&&name){namesToRut.set(searchName(name),rut);workers.set(rut,{rut,name,role:'seller',row,values:{cancellationUf:0}});}
 }
 // Resolve names against the complete worker table before reading M:N. The
 // table can precede its matching cancellation row; row order is not identity.
 for(let r=2;r<=last;r++){
  const rut=normalizeRut(ws['G'+r]?.v),name=text(ws['H'+r]?.v);
  if(isValidRut(rut)&&name)namesToRut.set(searchName(name),rut);
 }
 for(let r=2;r<=last;r++){
  const rut=normalizeRut(ws['G'+r]?.v),name=text(ws['H'+r]?.v);
  if(isValidRut(rut)&&name){
   const record=workers.get(rut)??{rut,name,role:'seller' as const,row:r,values:{cancellationUf:0}};
   const rawMonth=ws['K'+r]?.v,day=date(rawMonth),month=text(rawMonth);
   const monthYear=day?Number(day.slice(0,4)):/20\d{2}$/.test(month)?Number(month.slice(-4)):/\d{2}$/.test(month)?2000+Number(month.slice(-2)):undefined;
   if(monthYear===year){
    const amount=number(ws['D'+r]?.v);if(amount===undefined||amount<0)result.errors.push(`${sheet}!D${r}: UF de anulación inválida.`);
    else record.values.cancellationUf=Number(record.values.cancellationUf)+amount;
   }
   workers.set(rut,record);namesToRut.set(searchName(name),rut);
  }
  if(ws['M'+r]?.t==='e'){result.warnings.push(`${sheet}!M${r}: nombre de última venta no disponible.`);continue;}
  const seller=text(ws['M'+r]?.v);if(!seller||/^(total|ejecutivo)/i.test(seller))continue;
  const sellerRut=namesToRut.get(searchName(seller)),id=sellerRut??searchName(seller);
  const record=workers.get(id)??{rut:sellerRut,name:seller,role:'seller' as const,row:r,values:{cancellationUf:0}};
  const value=ws['N'+r];const lastSale=value?.t==='e'?undefined:date(value?.v);
  if(lastSale&&lastSale>String(record.values.lastSaleDate??''))record.values.lastSaleDate=lastSale;
  if(!lastSale&&!record.values.lastSaleDate)record.values.daysWithoutSaleText=searchName(value?.v)==='sin ventas'?'Sin ventas':'Sin fecha de última venta';
  workers.set(id,record);
 }
 result.records=[...workers.values()];
 if(!result.records.length)result.errors.push('Anulaciones no contiene resultados de trabajadores.');
 result.warnings.push('Dos tablas independientes: anulaciones anuales (D/G:H/K) y última venta (M:N). Los días sin vender se calculan con la fecha actual de Chile; «Sin ventas» se conserva sin inventar una fecha. Solo se publican datos agregados de trabajadores.');
 return result;
}

function parseCommercialProductivity(book: WorkBook, source: 'production_sellers' | 'production_coordinators'): SheetImport | undefined {
  const sellers = source === 'production_sellers';
  const sheet = sellers ? 'Ejecutivos' : 'Equipos';
  const ws = book.Sheets[sheet];
  if (!ws || searchName(ws[sellers ? 'M8' : 'N8']?.v) !== 'negocios mes') return;

  const dashboard = book.Sheets.Dashboard;
  const month = date(dashboard?.D5?.v), end = date(dashboard?.D4?.v);
  const firstDay = number(book.Sheets.Criterios?.B10?.v);
  const start = month && firstDay && Number.isInteger(firstDay) && firstDay <= 28 && firstDay >= 1
    ? month.slice(0,8)+String(firstDay).padStart(2,'0') : undefined;
  const result: SheetImport = { source, sheet, records: [], errors: [], warnings: [], rules: [] };
  if (searchName(dashboard?.C5?.v) !== 'mes en curso' || searchName(dashboard?.C4?.v) !== 'corte actual' || !start || !end || start > end) {
    result.errors.push('Dashboard debe indicar el inicio del mes en curso y la fecha de corte.');
    return result;
  }
  result.period = { start, end };
  const seen = new Set<string>();
  for (const address of Object.keys(ws).filter(a => /^A\d+$/.test(a) && Number(a.slice(1)) > 8)) {
    const row = Number(address.slice(1));
    const type = searchName(ws[address]?.v);
    if (sellers ? number(ws['U'+row]?.v) !== 1 : !['coordinador','jefe'].includes(type)) continue;
    const role = sellers ? 'seller' : type === 'jefe' ? 'sales_manager' : 'coordinator';
    const rut = normalizeRut(ws[(sellers ? 'A' : 'Z')+row]?.v);
    const name = text(ws['B'+row]?.v);
    const productivity = number(ws[(sellers ? 'I' : 'H')+row]?.v);
    const businesses = number(ws[(sellers ? 'M' : 'N')+row]?.v);
    const key = role+':'+rut;
    if (!isValidRut(rut) || !name || seen.has(key) || productivity === undefined || productivity < 0 || businesses === undefined || !Number.isInteger(businesses) || businesses < 0) {
      result.errors.push(`${sheet}, fila ${row}: identidad repetida o resultado inválido.`);
      continue;
    }
    const values: SheetMetrics = { productivity, businesses };
    if (sellers) {
      const lastSale = ws['O'+row];
      const lastSaleDate = date(lastSale?.v);
      const uf = number(ws['T'+row]?.v);
      const zeroFlag = searchName(ws['N'+row]?.v);
      if (uf === undefined || !['cero venta','ventas'].includes(zeroFlag) ||
          (lastSaleDate ? lastSaleDate > end : !/^sin ventas?$/.test(searchName(lastSale?.v)))) {
        result.errors.push(`${sheet}, fila ${row}: revisa negocios del mes, UF y última venta válida.`);
        continue;
      }
      values.uf = uf;
      values.zeroSales = zeroFlag === 'cero venta' ? 1 : 0;
      if (lastSaleDate) values.lastSaleDate = lastSaleDate;
      else values.daysWithoutSaleText = 'Sin ventas';
    }
    seen.add(key);
    result.records.push({ rut, name, role, row, values });
  }
  if (!result.records.length) result.errors.push(`${sheet} no contiene resultados de productividad.`);
  return result;
}

function parseRevisedProduction(book:WorkBook, source:'production_sellers'|'production_coordinators'):SheetImport|undefined {
 const summary=book.SheetNames.find(n=>searchName(n)==='resumen coordinadores');
 const selected=summary&&text(book.Sheets[summary].B3?.v);
 const sheet=source==='production_coordinators'?summary:book.SheetNames.find(n=>searchName(n)===searchName(selected));
 if(!sheet)return;
 const ws=book.Sheets[sheet];
 const seller=source==='production_sellers';
 if(searchName(ws.A8?.v)!==(seller?'rut vendedor':'coordinador')||
   searchName(ws[seller?'P8':'H8']?.v)!==(seller?'productividad':'prod por ejecutivo'))return;
 const result:SheetImport={source,sheet,records:[],errors:[],warnings:[],rules:[]};
 const lastSaleCol='L',role=seller?'seller':'coordinator';
 for(const a of Object.keys(ws).filter(a=>/^A\d+$/.test(a)&&Number(a.slice(1))>8)){
  const row=Number(a.slice(1)),name=text(ws[(seller?'B':'A')+row]?.v);
  if(!name||/^(total|sin coordinador)/i.test(name))continue;
  const rut=seller?normalizeRut(ws[a]?.v):undefined;
  const productivity=number(ws[(seller?'P':'H')+row]?.v),businesses=number(ws[(seller?'K':'D')+row]?.v);
  if(seller&&!ws['F'+row]?.v&&businesses===undefined&&productivity===undefined)continue;
  const notApplicable=!seller&&number(ws['C'+row]?.v)===0&&searchName(ws['H'+row]?.v)==='n a';
  if((seller&&!isValidRut(rut!))||(!notApplicable&&productivity===undefined)||businesses===undefined){
   result.errors.push(`${sheet}, fila ${row}: identidad o productividad inválida.`);continue;
  }
  const lastSaleDate=date(ws[lastSaleCol+row]?.v);
  const uf=number(ws[(seller?'J':'E')+row]?.v);
  result.records.push({rut,name,role,row,values:{businesses,...(productivity!==undefined?{productivity}:{}),...(uf!==undefined?{uf}:{}),...(lastSaleDate?{lastSaleDate}:{})}});
 }
 if(!result.records.length)result.errors.push('La hoja no contiene resultados de productividad.');
 return result;
}

// Canto supplies date, seller and UF. TRIO alone supplies emission status.
// Canto can have several UF movements for an operation (e.g. an increase).
// They all contribute to total UF. The TRIO join never multiplies these rows.
function parseCantoRanking(book: WorkBook, source: 'ranking_annual'|'ranking_monthly', period?: {start:string;end:string}): SheetImport {
  const month=period?.start?new Date(`${period.start}T12:00:00Z`).toLocaleDateString('es-CL',{month:'long',timeZone:'UTC'}):'';
  const expected=source==='ranking_annual'?['BASE ANUAL']:[`${month} Comercial ${period?.start.slice(2,4)}`,'BASE ANUAL'];
  const sheet=expected.map(name=>book.SheetNames.find(n=>searchName(n)===searchName(name))).find(Boolean);
  const result:SheetImport={source,sheet:sheet??sheetSources[source].sheet,records:[],errors:[],warnings:[],rules:[]};
  if(!sheet){result.errors.push(`Falta la base de canto «${result.sheet}».`);return result;}
  if(!period||!/^\d{4}-\d{2}-\d{2}$/.test(period.start)||!/^\d{4}-\d{2}-\d{2}$/.test(period.end)||period.end<period.start){result.errors.push('Indica las fechas del ranking antes de seleccionar el archivo.');return result;}
  const trioName=book.SheetNames.find(n=>searchName(n)==='trio');
  if(!trioName){result.errors.push('Falta TRIO para obtener la emisión por operación.');return result;}
  const ws=book.Sheets[sheet],trio=book.Sheets[trioName];
  const columns=(s:WorkBook['Sheets'][string])=>Object.fromEntries(Object.entries(s).filter(([a])=>/^[A-Z]+1$/.test(a)).map(([a,cell])=>[searchName(cell.v),a.replace(/1$/,'')]));
  const cantoCols=columns(ws),trioCols=columns(trio);
  cantoCols['fecha canto'] ??= cantoCols.canto;
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
